export type Effort = "instant" | "fast" | "standard" | "think" | "max";

export const EFFORT_LEVELS: Effort[] = ["instant", "fast", "standard", "think", "max"];

export function parseEffort(value: unknown): Effort {
  if (value === "high") return "think";
  return EFFORT_LEVELS.includes(value as Effort) ? (value as Effort) : "standard";
}

export interface EffortConfig {
  label: string;
  hint: string;
  detail: string;
  eta: string;
  model: "deepseek-chat" | "deepseek-reasoner";
  temperature: number;
  jsonMode: boolean;
  minSlides: number;
  maxSlides: number;
  batchSize: number;
  concurrency: number;
  maxTokensPlan: number;
  maxTokensSlides: number;
}

export const EFFORT: Record<Effort, EffortConfig> = {
  instant: {
    label: "Instant",
    hint: "Rough cut, right now",
    detail: "A short first pass when you just need something on the board.",
    eta: "~20s",
    model: "deepseek-chat",
    temperature: 0.55,
    jsonMode: true,
    minSlides: 4,
    maxSlides: 5,
    batchSize: 2,
    concurrency: 3,
    maxTokensPlan: 2000,
    maxTokensSlides: 4000,
  },
  fast: {
    label: "Fast",
    hint: "Quick draft",
    detail: "Smaller scope, still interactive. Good for a first look.",
    eta: "~40s",
    model: "deepseek-chat",
    temperature: 0.4,
    jsonMode: true,
    minSlides: 5,
    maxSlides: 6,
    batchSize: 2,
    concurrency: 2,
    maxTokensPlan: 2500,
    maxTokensSlides: 5000,
  },
  standard: {
    label: "Standard",
    hint: "Balanced",
    detail: "The everyday setting. Solid structure and detail.",
    eta: "~1 min",
    model: "deepseek-chat",
    temperature: 0.35,
    jsonMode: true,
    minSlides: 6,
    maxSlides: 8,
    batchSize: 1,
    concurrency: 2,
    maxTokensPlan: 3000,
    maxTokensSlides: 4500,
  },
  think: {
    label: "Think",
    hint: "More careful",
    detail: "Slower pass. Tighter reasoning, better content, less filler.",
    eta: "~2 min",
    model: "deepseek-reasoner",
    temperature: 0.3,
    jsonMode: false,
    minSlides: 7,
    maxSlides: 10,
    batchSize: 1,
    concurrency: 1,
    maxTokensPlan: 6000,
    maxTokensSlides: 14000,
  },
  max: {
    label: "Max",
    hint: "Full treatment",
    detail: "Longest run. Bigger, more interactive, built to ship.",
    eta: "~3 min",
    model: "deepseek-reasoner",
    temperature: 0.28,
    jsonMode: false,
    minSlides: 8,
    maxSlides: 12,
    batchSize: 1,
    concurrency: 1,
    maxTokensPlan: 7000,
    maxTokensSlides: 16000,
  },
};
