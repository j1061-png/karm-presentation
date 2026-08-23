import { nanoid } from "nanoid";
import {
  ChatTurnSchema,
  ElementSchema,
  PresentationSchema,
  ProjectKindSchema,
  SlideSchema,
  ThemeSchema,
  isWebKind,
  type ChatTurn,
  type Presentation,
  type ProjectFile,
  type Slide,
  type SlideElement,
  type Theme,
} from "./schema";

/**
 * Robust validation + repair layer for AI-generated content.
 * DeepSeek does not always return perfect JSON, so nothing reaches the
 * renderer without passing through here.
 */

/** Extract a JSON object from a raw model response (handles markdown fences, chatter). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* keep trying */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* keep trying */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairTruncatedJson(candidate));
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error("The AI response did not contain valid JSON.");
}

/** Best-effort close of a truncated JSON string (unclosed strings/brackets). */
function repairTruncatedJson(input: string): string {
  let out = "";
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of input) {
    out += ch;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}

const SAFE_URL = /^(https:\/\/|\/)/i;

/** Sanitise a single element: drop unsafe URLs, clamp geometry, ensure id. */
function sanitiseElement(el: SlideElement): SlideElement {
  const e = { ...el, id: el.id || nanoid(8) };
  e.x = clamp(e.x, -20, 120);
  e.y = clamp(e.y, -20, 120);
  e.w = clamp(e.w, 1, 120);
  e.h = clamp(e.h, 1, 120);
  if (e.type === "image" && e.props.src && !SAFE_URL.test(e.props.src)) {
    e.props = { ...e.props, src: "" };
  }
  if (e.type === "button" && e.props.href && !/^https:\/\//i.test(e.props.href)) {
    e.props = { ...e.props, href: undefined, action: "next-slide" };
  }
  if (e.type === "video" && e.props.videoId && !/^[\w-]{5,20}$/.test(e.props.videoId)) {
    e.props = { ...e.props, videoId: "" };
  }
  if (e.type === "chart") {
    // Series data arrays must match the labels length.
    const n = e.props.labels.length;
    e.props = {
      ...e.props,
      series: e.props.series.map((s) => ({
        ...s,
        data: Array.from({ length: n }, (_, i) => toNumber(s.data[i])),
      })),
    };
  }
  if (e.type === "table") {
    const cols = e.props.columns.length;
    e.props = {
      ...e.props,
      rows: e.props.rows.map((r) =>
        Array.from({ length: cols }, (_, i) => String(r[i] ?? ""))
      ),
    };
  }
  if (e.type === "quiz") {
    e.props = {
      ...e.props,
      correctIndex: clamp(Math.round(e.props.correctIndex), 0, e.props.options.length - 1),
    };
  }
  return e;
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Validate a single element leniently: parse with the schema and drop it if
 * unrecoverable, rather than failing the whole presentation.
 */
export function repairElement(input: unknown): SlideElement | null {
  const candidate = coerceElement(input);
  const parsed = ElementSchema.safeParse(candidate);
  if (parsed.success) return sanitiseElement(parsed.data);
  return null;
}

/** Fill common gaps the model leaves (missing ids, numeric strings, etc). */
function coerceElement(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const el = { ...(input as Record<string, unknown>) };
  if (!el.id || typeof el.id !== "string") el.id = nanoid(8);
  for (const key of ["x", "y", "w", "h", "z", "opacity", "rotation"]) {
    if (typeof el[key] === "string") el[key] = Number(el[key]);
  }
  if (typeof el.props !== "object" || el.props === null) el.props = {};

  // Charts: models often emit numbers as strings — coerce before validation.
  if (el.type === "chart") {
    const props = el.props as Record<string, unknown>;
    if (Array.isArray(props.series)) {
      props.series = props.series.map((s) => {
        if (typeof s !== "object" || s === null) return s;
        const series = { ...(s as Record<string, unknown>) };
        if (Array.isArray(series.data)) series.data = series.data.map((v) => toNumber(v));
        return series;
      });
    }
    if (Array.isArray(props.labels)) props.labels = props.labels.map((l) => String(l));
  }

  // Tables: coerce all cells to strings.
  if (el.type === "table") {
    const props = el.props as Record<string, unknown>;
    if (Array.isArray(props.columns)) props.columns = props.columns.map((c) => String(c));
    if (Array.isArray(props.rows)) {
      props.rows = props.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : r));
    }
  }

  // Stats/progress: numeric fields sometimes arrive as numbers or strings.
  if (el.type === "stat") {
    const props = el.props as Record<string, unknown>;
    if (typeof props.value === "number") props.value = String(props.value);
  }
  if (el.type === "progress") {
    const props = el.props as Record<string, unknown>;
    if (typeof props.value === "string") props.value = toNumber(props.value);
  }

  return el;
}

/**
 * Guarantee every element animates in. If the model omitted animations,
 * inject a staggered fade-up so slides never feel static.
 */
function ensureAnimations(elements: SlideElement[]): SlideElement[] {
  let stagger = 0;
  return elements.map((el) => {
    if (el.animation && el.animation.type !== "none") return el;
    if (el.type === "shape") return el; // decorative backgrounds stay put
    const animated = {
      ...el,
      animation: {
        type: el.type === "stat" || el.type === "icon" ? ("zoom" as const) : ("fade-up" as const),
        delay: Math.round(stagger * 100) / 100,
        duration: 0.6,
      },
    };
    stagger += 0.15;
    return animated;
  });
}

export function repairSlide(input: unknown, index: number): Slide | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = { ...(input as Record<string, unknown>) };
  if (!raw.id || typeof raw.id !== "string") raw.id = nanoid(8);
  if (!raw.name || typeof raw.name !== "string") raw.name = `Slide ${index + 1}`;

  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  const elements = ensureAnimations(
    rawElements.map((e) => repairElement(e)).filter((e): e is SlideElement => e !== null)
  );

  const parsed = SlideSchema.safeParse({ ...raw, elements });
  if (parsed.success) return parsed.data;

  // Last resort: keep the slide with only its valid elements.
  const fallback = SlideSchema.safeParse({
    id: raw.id,
    name: raw.name,
    elements,
  });
  return fallback.success ? fallback.data : null;
}

export function repairTheme(input: unknown): Theme {
  const parsed = ThemeSchema.safeParse(input ?? {});
  if (parsed.success) return parsed.data;
  return ThemeSchema.parse({});
}

/** Sanitize a web artifact file path: relative, no traversal, safe chars only. */
export function sanitizeFilePath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const path = input.trim().replace(/^\.?\/+/, "").replace(/\\/g, "/");
  if (!path || path.length > 200) return null;
  if (path.includes("..")) return null;
  if (!/^[\w][\w\-./ ]*$/.test(path)) return null;
  if (path.endsWith("/")) return null;
  return path;
}

const MAX_PROJECT_FILES = 40;
const MAX_FILE_BYTES = 600_000;

/** Repair a web artifact file tree: drop bad entries, dedupe paths, cap size. */
export function repairFiles(input: unknown): ProjectFile[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ProjectFile[] = [];
  for (const item of input) {
    if (out.length >= MAX_PROJECT_FILES) break;
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const path = sanitizeFilePath(row.path);
    if (!path || seen.has(path)) continue;
    const content = typeof row.content === "string" ? row.content : null;
    if (content === null || content.length > MAX_FILE_BYTES) continue;
    seen.add(path);
    out.push({ path, content });
  }
  return out;
}

/**
 * Validate and repair a full project document. Throws only if nothing
 * usable can be recovered.
 */
export function repairPresentation(input: unknown, existing?: Partial<Presentation>): Presentation {
  if (typeof input !== "object" || input === null) {
    throw new Error("Generated presentation is not an object.");
  }
  const raw = input as Record<string, unknown>;
  const now = new Date().toISOString();

  const kindParsed = ProjectKindSchema.safeParse(raw.kind);
  const kind = kindParsed.success ? kindParsed.data : existing?.kind ?? "presentation";
  const web = isWebKind(kind);

  const rawSlides = Array.isArray(raw.slides) ? raw.slides : [];
  const slides = rawSlides
    .map((s, i) => repairSlide(s, i))
    .filter((s): s is Slide => s !== null);

  const files = repairFiles(raw.files);
  const fallbackFiles = files.length > 0 ? files : existing?.files ?? [];

  if (!web && slides.length === 0) {
    throw new Error("The AI response contained no valid slides.");
  }
  if (web && fallbackFiles.length === 0) {
    throw new Error("The AI response contained no usable files.");
  }

  const entry =
    sanitizeFilePath(raw.entry) ??
    (fallbackFiles.some((f) => f.path === "index.html") ? "index.html" : fallbackFiles[0]?.path) ??
    "index.html";

  const doc = {
    id: existing?.id ?? (typeof raw.id === "string" ? raw.id : nanoid(12)),
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : existing?.title ?? "Untitled presentation",
    description: typeof raw.description === "string" ? raw.description : "",
    kind,
    theme: repairTheme(raw.theme ?? existing?.theme),
    slides,
    files: web ? fallbackFiles : undefined,
    entry,
    version: 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    chatThread: repairChatThread(raw.chatThread) ?? existing?.chatThread,
  };

  return PresentationSchema.parse(doc);
}

function repairChatThread(input: unknown): ChatTurn[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const turns = input
    .map((item) => ChatTurnSchema.safeParse(item))
    .filter((r): r is { success: true; data: ChatTurn } => r.success)
    .map((r) => r.data);
  return turns.length > 0 ? turns : undefined;
}
