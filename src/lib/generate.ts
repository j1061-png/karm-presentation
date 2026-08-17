import { nanoid } from "nanoid";
import { chatJson } from "./deepseek";
import { EFFORT, parseEffort, type Effort } from "./effort";
import { fallbackSlide, layoutSlide } from "./layouts";
import {
  editSystemPrompt, planSystemPrompt, slidesSystemPrompt,
  type GenerationMode,
} from "./prompts";
import {
  AIEditResponseSchema,
  PlanSchema,
  type AIEditResponse,
  type Plan,
  type Presentation,
  type Slide,
} from "./schema";
import { extractJson, repairPresentation, repairSlide, repairTheme } from "./validate";

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

export async function generatePlan(
  prompt: string,
  files: SourceFile[],
  effort: Effort,
  mode: GenerationMode = "creative"
): Promise<Plan> {
  const cfg = EFFORT[effort];
  const plan = await chatJson(
    [
      { role: "system", content: planSystemPrompt(cfg.minSlides, cfg.maxSlides, mode) },
      {
        role: "user",
        content: `Plan a ${cfg.minSlides}–${cfg.maxSlides} slide interactive presentation for:\n\n"${prompt}"${sourceContext(files)}`,
      },
    ],
    (raw) => PlanSchema.parse(extractJson(raw)),
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
  effort: Effort,
  mode: GenerationMode = "creative"
): Promise<Slide[]> {
  const cfg = EFFORT[effort];
  const briefs = batch
    .map((s) => {
      const role =
        s.index === 0 ? "title" : s.index === plan.slides.length - 1 ? "close" : "content";
      return `SLIDE ${s.index + 1} — "${s.name}" (layout hint: ${role})\nGoal: ${s.goal}\nHero widget: ${s.suggestedComponents.join(", ") || "stat or cards"}`;
    })
    .join("\n\n");

  const parsed = await chatJson(
    [
      { role: "system", content: slidesSystemPrompt(mode) },
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
    .map((s, i) => layoutSlide(s, batch[i]?.index ?? i, plan.slides.length, theme));

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
  effortInput: unknown = "standard",
  modeInput: unknown = "creative"
): Promise<Presentation> {
  const effort = parseEffort(effortInput);
  const cfg = EFFORT[effort];
  const mode: GenerationMode = modeInput === "faithful" ? "faithful" : "creative";

  onStage({
    stage: "analysing",
    detail: files.length
      ? `Reading ${files.length} source file${files.length > 1 ? "s" : ""}`
      : "Understanding your request",
  });

  onStage({ stage: "planning", detail: `${cfg.label} pass — structuring the narrative` });
  const plan = await generatePlan(prompt, files, effort, mode);
  const theme = repairTheme(plan.theme);

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
    const slides = await generateSlideBatch(plan, batch, prompt, files, effort, mode);
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
  const allSlides = merged.map((s, i) => layoutSlide(s, i, merged.length, theme));
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
    },
    {}
  );
}

function presentationContext(p: Presentation, selectedSlideId?: string, selectedElementId?: string): string {
  const slides = p.slides.map((s, i) => {
    const isSelected = s.id === selectedSlideId;
    const full = isSelected || p.slides.length <= 6;
    if (full) return `Slide ${i + 1} ${isSelected ? "[SELECTED BY USER] " : ""}: ${JSON.stringify(s)}`;
    return `Slide ${i + 1}: { "id": "${s.id}", "name": "${s.name}", elements: [${s.elements
      .map((e) => `{"id":"${e.id}","type":"${e.type}"}`)
      .join(",")}] }`;
  });
  let selection = "";
  if (selectedElementId && selectedSlideId) {
    const slide = p.slides.find((s) => s.id === selectedSlideId);
    const el = slide?.elements.find((e) => e.id === selectedElementId);
    if (el) selection = `\nThe user currently has this ELEMENT selected: ${JSON.stringify(el)}`;
  }
  return `PRESENTATION "${p.title}" (id ${p.id})\nTheme: ${JSON.stringify(p.theme)}\nSlides:\n${slides.join("\n")}${selection}`;
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
    (raw) => AIEditResponseSchema.parse(extractJson(raw)),
    { maxTokens: 6000, temperature: 0.25, model: "deepseek-chat", json: true }
  );
}

export function applyOperations(p: Presentation, response: AIEditResponse): Presentation {
  let next: Presentation = { ...p, slides: [...p.slides] };
  for (const op of response.operations) {
    switch (op.op) {
      case "replaceSlide": {
        const repaired = repairSlide(op.slide, 0);
        if (!repaired) break;
        const laid = layoutSlide(repaired, next.slides.findIndex((s) => s.id === op.slideId), next.slides.length, next.theme);
        next.slides = next.slides.map((s) => (s.id === op.slideId ? { ...laid, id: s.id } : s));
        break;
      }
      case "addSlide": {
        const repaired = repairSlide(op.slide, next.slides.length);
        if (!repaired) break;
        const idx = op.index !== undefined ? Math.min(op.index, next.slides.length) : next.slides.length;
        const laid = layoutSlide(repaired, idx, next.slides.length + 1, next.theme);
        next.slides = [...next.slides.slice(0, idx), laid, ...next.slides.slice(idx)];
        break;
      }
      case "deleteSlide": {
        if (next.slides.length <= 1) break;
        next.slides = next.slides.filter((s) => s.id !== op.slideId);
        break;
      }
      case "updateElement": {
        next.slides = next.slides.map((s) =>
          s.id !== op.slideId
            ? s
            : {
                ...s,
                elements: s.elements.map((e) =>
                  e.id === op.elementId ? { ...op.element, id: e.id } : e
                ),
              }
        );
        break;
      }
      case "addElement": {
        next.slides = next.slides.map((s) =>
          s.id !== op.slideId ? s : { ...s, elements: [...s.elements, op.element] }
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
