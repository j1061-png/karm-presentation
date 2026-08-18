import { nanoid } from "nanoid";
import type { Presentation, Slide, SlideElement, Theme } from "./schema";
import { INTERACTIVITY, type InteractivityLevel } from "./interactivity";
import { sanitizeEmbedHtml } from "./sanitize-html";
import { repairPresentation } from "./validate";
import type { SourceFile } from "./generate";

/**
 * Deterministic "convert my deck as-is" import — NO model call at all.
 *
 * The AI paths (creative/faithful) rewrite wording and can fail, rate-limit or
 * hallucinate. This path exists for the case where the user already has a
 * finished presentation and just wants it turned into the interactive HTML
 * player: every source slide becomes one deck slide, verbatim, instantly.
 */

const MAX_SLIDES = 60;
const MAX_BULLETS = 8;

const DEFAULT_THEME: Theme = {
  name: "Imported",
  mode: "dark",
  colors: {
    background: "#0b0d12",
    surface: "#161a22",
    text: "#f4f5f7",
    muted: "#9aa3b2",
    accent: "#f5a623",
    accentText: "#101114",
  },
  radius: 16,
} as Theme;

interface Section {
  title: string;
  body: string[];
  /** Raw user HTML, kept byte-for-byte inside a sandboxed embed. */
  html?: string;
  imageUrl?: string;
}

/** PPTX extraction emits "[Slide N]" markers — one section per source slide. */
function pptxSections(content: string): Section[] {
  return content
    .split(/\[Slide \d+\]/g)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return { title: lines[0] ?? "Slide", body: lines.slice(1, 1 + MAX_BULLETS) };
    });
}

/** Prose (PDF/DOCX/TXT): start a new section on a short, heading-like line. */
function proseSections(content: string): Section[] {
  const lines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const out: Section[] = [];
  for (const line of lines) {
    const looksLikeHeading = line.length <= 70 && !/[.!?;,]$/.test(line);
    if (out.length === 0 || (looksLikeHeading && out[out.length - 1].body.length > 0)) {
      out.push({ title: line, body: [] });
    } else if (out[out.length - 1].body.length < MAX_BULLETS) {
      out[out.length - 1].body.push(line);
    } else {
      out.push({ title: line.slice(0, 70), body: [] });
    }
  }
  return out.filter((s) => s.title || s.body.length);
}

function delimitedSection(file: SourceFile): Section | null {
  const rows = file.content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 9)
    .map((l) => l.split(/,|\t/).map((c) => c.trim().replace(/^["']|["']$/g, "")).slice(0, 6));
  if (rows.length < 2) return null;
  return { title: file.name.replace(/\.[^.]+$/, ""), body: [], html: undefined, ...{ rows } } as Section & {
    rows?: string[][];
  };
}

function sectionsFor(file: SourceFile): Section[] {
  if (file.kind === "html") {
    return [{ title: file.name.replace(/\.[^.]+$/, ""), body: [], html: file.content }];
  }
  if (file.kind === "image") {
    const url = file.imageUrl ?? file.content.match(/https?:\/\/\S+?(?=\s|\)|$)/)?.[0];
    return url ? [{ title: file.name.replace(/\.[^.]+$/, ""), body: [], imageUrl: url }] : [];
  }
  if (file.kind === "powerpoint") return pptxSections(file.content);
  if (file.kind === "data") {
    const s = delimitedSection(file);
    return s ? [s] : proseSections(file.content);
  }
  return proseSections(file.content);
}

function el(partial: Partial<SlideElement> & { type: string; props: unknown }): SlideElement {
  return {
    id: nanoid(8),
    x: 6,
    y: 10,
    w: 88,
    h: 12,
    z: 2,
    opacity: 1,
    rotation: 0,
    ...partial,
  } as SlideElement;
}

function sectionToSlide(
  section: Section & { rows?: string[][] },
  index: number,
  total: number,
  interactivity: InteractivityLevel
): Slide {
  const cfg = INTERACTIVITY[interactivity];
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const elements: SlideElement[] = [];

  if (section.html) {
    elements.push(
      el({ type: "embed", x: 4, y: 6, w: 92, h: 88, props: { html: sanitizeEmbedHtml(section.html) } })
    );
  } else if (section.imageUrl) {
    elements.push(
      el({
        type: "heading",
        x: 6,
        y: 8,
        w: 88,
        h: 12,
        props: { text: section.title, level: 2 },
        style: { fontSize: 40, fontWeight: 700, letterSpacing: -0.8 },
      }),
      el({
        type: "image",
        x: 6,
        y: 24,
        w: 88,
        h: 68,
        props: { src: section.imageUrl, alt: section.title, fit: "contain" },
      })
    );
  } else {
    elements.push(
      el({
        type: "heading",
        x: 6,
        y: isFirst ? 30 : 9,
        w: 88,
        h: isFirst ? 24 : 13,
        props: { text: section.title, level: isFirst ? 1 : 2 },
        style: {
          fontSize: isFirst ? 54 : 38,
          fontWeight: 700,
          letterSpacing: -0.8,
        },
      })
    );
    if (section.rows && section.rows.length >= 2) {
      elements.push(
        el({
          type: "table",
          x: 6,
          y: 26,
          w: 88,
          h: 66,
          props: {
            columns: section.rows[0],
            rows: section.rows.slice(1),
            compact: section.rows.length > 5,
          },
        })
      );
    } else if (section.body.length >= 2) {
      elements.push(
        el({
          type: "list",
          x: 6,
          y: 26,
          w: 88,
          h: Math.min(66, 12 + section.body.length * 8),
          props: { items: section.body, ordered: false, marker: "dot" },
          style: { fontSize: 21 },
        })
      );
    } else if (section.body.length === 1) {
      elements.push(
        el({
          type: "text",
          x: 6,
          y: isFirst ? 58 : 26,
          w: 78,
          h: 20,
          props: { text: section.body[0] },
          style: { fontSize: 22 },
        })
      );
    }
  }

  const particles =
    cfg.particleFrequency === "all" ||
    (cfg.particleFrequency === "bookend" && (isFirst || isLast));

  return {
    id: nanoid(8),
    name: section.title.slice(0, 60) || `Slide ${index + 1}`,
    transition: "fade",
    background: {
      type: "gradient",
      gradientFrom: DEFAULT_THEME.colors.background,
      gradientTo: DEFAULT_THEME.colors.surface,
      gradientAngle: 148,
      overlayOpacity: 0.5,
      particles,
      particleDensity: cfg.particleDensity,
      particleSpeed: cfg.particleSpeed,
    },
    elements,
    notes: "",
  } as Slide;
}

/**
 * Convert uploaded source material straight into a presentation document —
 * no planning call, no slide-design call, no model involvement whatsoever.
 */
export function directImport(
  files: SourceFile[],
  interactivity: InteractivityLevel = "balanced",
  titleHint = ""
): Presentation {
  const sections = files.flatMap(sectionsFor).slice(0, MAX_SLIDES);

  if (sections.length === 0) {
    throw new Error(
      "Could not read any slides or text out of the attached file. Try a .pptx, .pdf, .docx, .html or .txt export."
    );
  }

  const title =
    titleHint.trim() ||
    files[0]?.name.replace(/\.[^.]+$/, "") ||
    "Imported presentation";

  const now = new Date().toISOString();
  return repairPresentation(
    {
      id: nanoid(12),
      title,
      description: `Imported as-is from ${files.map((f) => f.name).join(", ")}.`,
      theme: DEFAULT_THEME,
      interactivity,
      slides: sections.map((s, i) => sectionToSlide(s, i, sections.length, interactivity)),
      createdAt: now,
      updatedAt: now,
    },
    {}
  );
}
