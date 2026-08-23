import { nanoid } from "nanoid";
import { chatJson } from "./deepseek";
import { EFFORT, parseEffort, type Effort } from "./effort";
import { ensureInteractive, fallbackSlide, layoutSlide } from "./layouts";
import { resolveDeckTheme } from "./palettes";
import { editSystemPrompt, planSystemPrompt, slidesSystemPrompt } from "./prompts";
import {
  PlanSchema,
  type AIEditResponse,
  type Plan,
  type Presentation,
  type Slide,
} from "./schema";
import { extractJson, repairElement, repairPresentation, repairSlide, repairTheme } from "./validate";

export type GenerationStage =
  | { stage: "analysing"; detail?: string }
  | { stage: "planning"; detail?: string }
  | { stage: "designing"; detail?: string; done?: number; total?: number }
  | { stage: "interactive"; detail?: string }
  | { stage: "finalising"; detail?: string }
  | { stage: "complete"; presentationId: string }
  | { stage: "error"; message: string };

export interface SourceFile {
  name: string;
  kind: string;
  content: string;
}

const HERO_ROTATION = [
  "chart",
  "flipcards",
  "tabs",
  "quiz",
  "flow",
  "cards",
  "timeline",
  "comparison",
  "accordion",
];

function parsePlan(raw: unknown): Plan {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const slides = Array.isArray(obj.slides)
    ? obj.slides
        .map((s) => {
          if (typeof s !== "object" || s === null) return null;
          const row = s as Record<string, unknown>;
          const name = typeof row.name === "string" ? row.name.trim() : "";
          if (!name) return null;
          return {
            name,
            goal: typeof row.goal === "string" ? row.goal : "",
            suggestedComponents: Array.isArray(row.suggestedComponents)
              ? row.suggestedComponents.filter((c): c is string => typeof c === "string")
              : [],
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
    : [];
  return PlanSchema.parse({
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "Untitled presentation",
    description: typeof obj.description === "string" ? obj.description : "",
    audience: typeof obj.audience === "string" ? obj.audience : "",
    theme: repairTheme(obj.theme),
    slides: slides.length > 0 ? slides : [{ name: "The stake", goal: "", suggestedComponents: ["stat"] }],
  });
}

function diversifyPlan(plan: Plan): Plan {
  const used = new Set<string>();
  const slides = plan.slides.map((s, i) => {
    if (i === 0) return { ...s, suggestedComponents: ["stat", "button"] };
    if (i === plan.slides.length - 1) {
      const close = s.suggestedComponents.find((c) => c === "quiz" || c === "cards") ?? "quiz";
      return { ...s, suggestedComponents: [close] };
    }
    const preferred = s.suggestedComponents.find((c) => HERO_ROTATION.includes(c) && !used.has(c));
    const hero = preferred ?? HERO_ROTATION.find((h) => !used.has(h)) ?? "cards";
    used.add(hero);
    return { ...s, suggestedComponents: [hero] };
  });
  return { ...plan, slides };
}

function sourceContext(files: SourceFile[]): string {
  if (files.length === 0) return "";
  const parts = files.map(
    (f) =>
      `--- SOURCE FILE: ${f.name} (${f.kind}) ---\n${f.content.slice(0, 8000)}\n--- END OF ${f.name} ---`
  );
  return `\n\nSOURCE MATERIAL (ground every fact in this):\n${parts.join("\n\n")}`;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

export async function generatePlan(prompt: string, files: SourceFile[], effort: Effort): Promise<Plan> {
  const cfg = EFFORT[effort];
  const plan = await chatJson(
    [
      { role: "system", content: planSystemPrompt(cfg.minSlides, cfg.maxSlides) },
      {
        role: "user",
        content: `Plan a ${cfg.minSlides}–${cfg.maxSlides} slide interactive presentation for:\n\n"${prompt}"${sourceContext(files)}`,
      },
    ],
    (raw) => parsePlan(extractJson(raw)),
    {
      maxTokens: cfg.maxTokensPlan,
      temperature: cfg.temperature,
      model: cfg.model,
      json: cfg.jsonMode,
    }
  );
  return {
    ...plan,
    slides: plan.slides.slice(0, cfg.maxSlides),
  };
}

async function generateSlideBatch(
  plan: Plan,
  batch: { index: number; name: string; goal: string; suggestedComponents: string[] }[],
  prompt: string,
  files: SourceFile[],
  effort: Effort
): Promise<Slide[]> {
  const cfg = EFFORT[effort];
  const briefs = batch
    .map((s) => {
      const role =
        s.index === 0 ? "title" : s.index === plan.slides.length - 1 ? "close" : "content";
      return `SLIDE ${s.index + 1} — "${s.name}" (layout hint: ${role})\nGoal: ${s.goal}\nREQUIRED hero widget: ${s.suggestedComponents[0] || "cards"} — do not reuse a widget from another slide`;
    })
    .join("\n\n");

  const parsed = await chatJson(
    [
      { role: "system", content: slidesSystemPrompt() },
      {
        role: "user",
        content: `Presentation: "${plan.title}" — ${plan.description}
Audience: ${plan.audience}
Theme: ${JSON.stringify(plan.theme)}
Total slides: ${plan.slides.length}
Request: "${prompt}"${sourceContext(files)}

Design ONLY these slides, in this order. One layout each. Copy the layout coordinates from the system prompt.

${briefs}`,
      },
    ],
    (raw) => {
      const obj = extractJson(raw) as { slides?: unknown[] };
      if (!Array.isArray(obj.slides)) throw new Error("Response missing 'slides' array.");
      return obj.slides;
    },
    {
      maxTokens: cfg.maxTokensSlides,
      temperature: cfg.temperature,
      model: cfg.model,
      json: cfg.jsonMode,
    }
  );

  const theme = repairTheme(plan.theme);
  const slides = parsed
    .map((s, i) => repairSlide(s, batch[i]?.index ?? i))
    .filter((s): s is Slide => s !== null)
    .map((s, i) => {
      const idx = batch[i]?.index ?? i;
      const hero = batch[i]?.suggestedComponents[0];
      try {
        return ensureInteractive(layoutSlide(s, idx, plan.slides.length, theme), hero, idx, plan.slides.length, theme);
      } catch {
        return fallbackSlide(s.name, s.notes ?? "", idx, theme);
      }
    });

  while (slides.length < batch.length) {
    const missing = batch[slides.length];
    slides.push(fallbackSlide(missing.name, missing.goal, missing.index, theme));
  }

  return slides.slice(0, batch.length);
}

export async function generatePresentation(
  prompt: string,
  files: SourceFile[],
  onStage: (s: GenerationStage) => void,
  effortInput: unknown = "standard"
): Promise<Presentation> {
  const effort = parseEffort(effortInput);
  const cfg = EFFORT[effort];

  onStage({
    stage: "analysing",
    detail: files.length
      ? `Reading ${files.length} source file${files.length > 1 ? "s" : ""}`
      : "Understanding your request",
  });

  onStage({ stage: "planning", detail: `${cfg.label} pass — structuring the narrative` });
  let rawPlan: Plan;
  try {
    rawPlan = await generatePlan(prompt, files, effort);
  } catch {
    rawPlan = parsePlan({
      title: prompt.slice(0, 72) || "Untitled presentation",
      description: prompt,
      slides: Array.from({ length: cfg.minSlides }, (_, i) => ({
        name: ["The stake", "The numbers", "How it works", "The proof", "The argument", "The ask"][i] ?? `Slide ${i + 1}`,
        goal: prompt,
        suggestedComponents: [],
      })),
    });
  }
  const theme = resolveDeckTheme(prompt, repairTheme(rawPlan.theme));
  const plan = diversifyPlan({ ...rawPlan, theme });

  onStage({
    stage: "designing",
    detail: `Designing ${plan.slides.length} slides`,
    done: 0,
    total: plan.slides.length,
  });

  const indexed = plan.slides.map((s, index) => ({ index, ...s }));
  const batches: (typeof indexed)[] = [];
  for (let i = 0; i < indexed.length; i += cfg.batchSize) {
    batches.push(indexed.slice(i, i + cfg.batchSize));
  }

  let done = 0;
  const results = await mapPool(batches, cfg.concurrency, async (batch) => {
    const slides = await generateSlideBatch(plan, batch, prompt, files, effort);
    done += batch.length;
    onStage({
      stage: "designing",
      detail: `Designed ${Math.min(done, plan.slides.length)} of ${plan.slides.length} slides`,
      done,
      total: plan.slides.length,
    });
    return slides;
  });

  onStage({ stage: "interactive", detail: "Snapping layouts and wiring interactions" });

  const merged = results.flat();
  const allSlides = merged.map((s, i) => {
    const hero = plan.slides[i]?.suggestedComponents[0];
    try {
      return ensureInteractive(layoutSlide(s, i, merged.length, theme), hero, i, merged.length, theme);
    } catch {
      return fallbackSlide(s.name, s.notes ?? "", i, theme);
    }
  });
  onStage({ stage: "finalising", detail: "Polishing and validating" });

  const now = new Date().toISOString();
  return repairPresentation(
    {
      id: nanoid(12),
      title: plan.title,
      description: plan.description,
      theme,
      slides: allSlides,
      createdAt: now,
      updatedAt: now,
      chatThread: [
        { id: nanoid(8), role: "user", text: prompt },
        {
          id: nanoid(8),
          role: "assistant",
          text: "Created the presentation. Click around — then ask for a change.",
          kind: "result",
        },
      ],
    },
    {}
  );
}

function presentationContext(p: Presentation, selectedSlideId?: string, selectedElementId?: string): string {
  const slides = p.slides.map((s, i) => {
    const isSelected = s.id === selectedSlideId;
    return `Slide ${i + 1} ${isSelected ? "[SELECTED BY USER] " : ""}(id ${s.id}): ${JSON.stringify({
      id: s.id,
      name: s.name,
      elements: s.elements,
      notes: s.notes?.slice(0, 240),
    })}`;
  });
  let selection = "";
  if (selectedElementId && selectedSlideId) {
    const slide = p.slides.find((s) => s.id === selectedSlideId);
    const el = slide?.elements.find((e) => e.id === selectedElementId);
    if (el) selection = `\nThe user currently has this ELEMENT selected: ${JSON.stringify(el)}`;
  }
  return `PRESENTATION "${p.title}" (id ${p.id})\nTheme: ${JSON.stringify(p.theme)}\nSlides:\n${slides.join("\n")}${selection}`;
}

function parseEditResponse(raw: unknown, presentation: Presentation): AIEditResponse {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const operations: AIEditResponse["operations"] = [];
  const opsIn = Array.isArray(obj.operations) ? obj.operations : [];

  for (const item of opsIn) {
    if (typeof item !== "object" || item === null) continue;
    const op = item as Record<string, unknown>;
    try {
      if (op.op === "replaceSlide" && typeof op.slideId === "string") {
        const slide = repairSlide(op.slide, 0);
        if (slide) operations.push({ op: "replaceSlide", slideId: op.slideId, slide });
      } else if (op.op === "addSlide") {
        const slide = repairSlide(op.slide, presentation.slides.length);
        if (slide)
          operations.push({
            op: "addSlide",
            index: typeof op.index === "number" ? op.index : undefined,
            slide,
          });
      } else if (op.op === "deleteSlide" && typeof op.slideId === "string") {
        operations.push({ op: "deleteSlide", slideId: op.slideId });
      } else if (op.op === "updateElement" && typeof op.slideId === "string" && typeof op.elementId === "string") {
        const element = repairElement(op.element);
        if (element) operations.push({ op: "updateElement", slideId: op.slideId, elementId: op.elementId, element });
      } else if (op.op === "addElement" && typeof op.slideId === "string") {
        const element = repairElement(op.element);
        if (element) operations.push({ op: "addElement", slideId: op.slideId, element });
      } else if (op.op === "deleteElement" && typeof op.slideId === "string" && typeof op.elementId === "string") {
        operations.push({ op: "deleteElement", slideId: op.slideId, elementId: op.elementId });
      } else if (op.op === "updateTheme") {
        operations.push({ op: "updateTheme", theme: repairTheme(op.theme) });
      } else if (op.op === "setTitle" && typeof op.title === "string") {
        operations.push({ op: "setTitle", title: op.title });
      }
    } catch {
      /* skip a bad operation instead of failing the whole edit */
    }
  }

  if (operations.length === 0 && Array.isArray(obj.slides)) {
    obj.slides.forEach((rawSlide, i) => {
      const slide = repairSlide(rawSlide, i);
      if (!slide) return;
      const existing = presentation.slides[i];
      if (existing) operations.push({ op: "replaceSlide", slideId: existing.id, slide: { ...slide, id: existing.id } });
      else operations.push({ op: "addSlide", index: i, slide });
    });
  }

  return {
    summary:
      typeof obj.summary === "string" && obj.summary.trim()
        ? obj.summary.trim()
        : operations.length
          ? "Updated the presentation."
          : "I couldn't find a safe change for that request.",
    operations,
  };
}

export async function generateEdit(
  presentation: Presentation,
  instruction: string,
  selectedSlideId?: string,
  selectedElementId?: string,
  files: SourceFile[] = []
): Promise<AIEditResponse> {
  return chatJson(
    [
      { role: "system", content: editSystemPrompt() },
      {
        role: "user",
        content: `${presentationContext(presentation, selectedSlideId, selectedElementId)}\n\nUSER REQUEST: "${instruction}"${sourceContext(files)}`,
      },
    ],
    (raw) => parseEditResponse(extractJson(raw), presentation),
    { maxTokens: 10000, temperature: 0.2, model: "deepseek-chat", json: true }
  );
}

export function applyOperations(p: Presentation, response: AIEditResponse): Presentation {
  let next: Presentation = { ...p, slides: [...p.slides] };
  for (const op of response.operations) {
    switch (op.op) {
      case "replaceSlide": {
        const repaired = repairSlide(op.slide, 0);
        if (!repaired) break;
        const idx = next.slides.findIndex((s) => s.id === op.slideId);
        const laid = ensureInteractive(
          layoutSlide(repaired, idx, next.slides.length, next.theme),
          undefined,
          idx,
          next.slides.length,
          next.theme
        );
        next.slides = next.slides.map((s) => (s.id === op.slideId ? { ...laid, id: s.id } : s));
        break;
      }
      case "addSlide": {
        const repaired = repairSlide(op.slide, next.slides.length);
        if (!repaired) break;
        const idx = op.index !== undefined ? Math.min(op.index, next.slides.length) : next.slides.length;
        const laid = ensureInteractive(
          layoutSlide(repaired, idx, next.slides.length + 1, next.theme),
          undefined,
          idx,
          next.slides.length + 1,
          next.theme
        );
        next.slides = [...next.slides.slice(0, idx), laid, ...next.slides.slice(idx)];
        break;
      }
      case "deleteSlide": {
        if (next.slides.length <= 1) break;
        next.slides = next.slides.filter((s) => s.id !== op.slideId);
        break;
      }
      case "updateElement": {
        const repaired = repairElement(op.element);
        if (!repaired) break;
        next.slides = next.slides.map((s) =>
          s.id !== op.slideId
            ? s
            : {
                ...s,
                elements: s.elements.map((e) =>
                  e.id === op.elementId ? { ...repaired, id: e.id } : e
                ),
              }
        );
        break;
      }
      case "addElement": {
        const repaired = repairElement(op.element);
        if (!repaired) break;
        next.slides = next.slides.map((s) =>
          s.id !== op.slideId ? s : { ...s, elements: [...s.elements, repaired] }
        );
        break;
      }
      case "deleteElement": {
        next.slides = next.slides.map((s) =>
          s.id !== op.slideId
            ? s
            : { ...s, elements: s.elements.filter((e) => e.id !== op.elementId) }
        );
        break;
      }
      case "updateTheme":
        next = { ...next, theme: op.theme };
        break;
      case "setTitle":
        next = { ...next, title: op.title };
        break;
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
