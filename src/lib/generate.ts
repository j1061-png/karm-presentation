import { nanoid } from "nanoid";
import { chatJson } from "./deepseek";
import { editSystemPrompt, planSystemPrompt, slidesSystemPrompt } from "./prompts";
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

const BATCH_SIZE = 3;

function sourceContext(files: SourceFile[]): string {
  if (files.length === 0) return "";
  const parts = files.map(
    (f) =>
      `--- SOURCE FILE: ${f.name} (${f.kind}) ---\n${f.content.slice(0, 12000)}\n--- END OF ${f.name} ---`
  );
  return `\n\nSOURCE MATERIAL provided by the user (ground the presentation in this content):\n${parts.join("\n\n")}`;
}

export async function generatePlan(prompt: string, files: SourceFile[]): Promise<Plan> {
  return chatJson(
    [
      { role: "system", content: planSystemPrompt() },
      {
        role: "user",
        content: `Plan an interactive presentation for this request:\n\n"${prompt}"${sourceContext(files)}`,
      },
    ],
    (raw) => PlanSchema.parse(extractJson(raw)),
    { maxTokens: 4000, temperature: 0.7 }
  );
}

async function generateSlideBatch(
  plan: Plan,
  batch: { index: number; name: string; goal: string; suggestedComponents: string[] }[],
  prompt: string,
  files: SourceFile[]
): Promise<Slide[]> {
  const briefs = batch
    .map(
      (s) =>
        `SLIDE ${s.index + 1} — "${s.name}"\nGoal: ${s.goal}\nSuggested components: ${s.suggestedComponents.join(", ") || "your choice"}`
    )
    .join("\n\n");

  const parsed = await chatJson(
    [
      { role: "system", content: slidesSystemPrompt() },
      {
        role: "user",
        content: `Presentation: "${plan.title}" — ${plan.description}
Audience: ${plan.audience}
Theme: ${JSON.stringify(plan.theme)}
Total slides in deck: ${plan.slides.length}
Original request: "${prompt}"${sourceContext(files)}

Design these slides now (return them in this exact order):

${briefs}`,
      },
    ],
    (raw) => {
      const obj = extractJson(raw) as { slides?: unknown[] };
      if (!Array.isArray(obj.slides)) throw new Error("Response missing 'slides' array.");
      return obj.slides;
    },
    { maxTokens: 8000, temperature: 0.7 }
  );

  const slides = parsed
    .map((s, i) => repairSlide(s, batch[i]?.index ?? i))
    .filter((s): s is Slide => s !== null);

  // If the model dropped slides, synthesise simple fallbacks so the deck
  // structure survives; the user can regenerate individual slides later.
  while (slides.length < batch.length) {
    const missing = batch[slides.length];
    slides.push({
      id: nanoid(8),
      name: missing.name,
      transition: "fade",
      elements: [
        {
          id: nanoid(8),
          type: "heading",
          x: 6,
          y: 10,
          w: 88,
          h: 14,
          z: 1,
          opacity: 1,
          rotation: 0,
          props: { text: missing.name, level: 1 },
        },
        {
          id: nanoid(8),
          type: "text",
          x: 6,
          y: 30,
          w: 70,
          h: 20,
          z: 1,
          opacity: 1,
          rotation: 0,
          props: { text: missing.goal },
        },
      ],
    });
  }

  return slides.slice(0, batch.length);
}

/**
 * Full generation pipeline:
 * prompt/files → plan (DeepSeek) → batched slide generation (DeepSeek, parallel)
 * → validation/repair → assembled Presentation.
 */
export async function generatePresentation(
  prompt: string,
  files: SourceFile[],
  onStage: (s: GenerationStage) => void
): Promise<Presentation> {
  onStage({ stage: "analysing", detail: files.length ? `Reading ${files.length} source file${files.length > 1 ? "s" : ""}` : "Understanding your request" });

  onStage({ stage: "planning", detail: "Structuring the narrative" });
  const plan = await generatePlan(prompt, files);

  onStage({
    stage: "designing",
    detail: `Designing ${plan.slides.length} slides`,
    done: 0,
    total: plan.slides.length,
  });

  const indexed = plan.slides.map((s, index) => ({ index, ...s }));
  const batches: (typeof indexed)[] = [];
  for (let i = 0; i < indexed.length; i += BATCH_SIZE) {
    batches.push(indexed.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  const results = await Promise.all(
    batches.map(async (batch) => {
      const slides = await generateSlideBatch(plan, batch, prompt, files);
      done += batch.length;
      onStage({
        stage: "designing",
        detail: `Designed ${Math.min(done, plan.slides.length)} of ${plan.slides.length} slides`,
        done,
        total: plan.slides.length,
      });
      return slides;
    })
  );

  onStage({ stage: "interactive", detail: "Wiring up interactive elements" });

  const allSlides = results.flat();
  onStage({ stage: "finalising", detail: "Polishing and validating" });

  const now = new Date().toISOString();
  return repairPresentation(
    {
      id: nanoid(12),
      title: plan.title,
      description: plan.description,
      theme: repairTheme(plan.theme),
      slides: allSlides,
      createdAt: now,
      updatedAt: now,
    },
    {}
  );
}

/** Compact representation of the presentation for AI-edit context. */
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
  selectedElementId?: string
): Promise<AIEditResponse> {
  return chatJson(
    [
      { role: "system", content: editSystemPrompt() },
      {
        role: "user",
        content: `${presentationContext(presentation, selectedSlideId, selectedElementId)}\n\nUSER REQUEST: "${instruction}"`,
      },
    ],
    (raw) => AIEditResponseSchema.parse(extractJson(raw)),
    { maxTokens: 8000, temperature: 0.6 }
  );
}

/** Apply validated AI operations to a presentation immutably. */
export function applyOperations(p: Presentation, response: AIEditResponse): Presentation {
  let next: Presentation = { ...p, slides: [...p.slides] };
  for (const op of response.operations) {
    switch (op.op) {
      case "replaceSlide": {
        const repaired = repairSlide(op.slide, 0);
        if (!repaired) break;
        next.slides = next.slides.map((s) => (s.id === op.slideId ? { ...repaired, id: s.id } : s));
        break;
      }
      case "addSlide": {
        const repaired = repairSlide(op.slide, next.slides.length);
        if (!repaired) break;
        const idx = op.index !== undefined ? Math.min(op.index, next.slides.length) : next.slides.length;
        next.slides = [...next.slides.slice(0, idx), repaired, ...next.slides.slice(idx)];
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
