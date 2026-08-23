import type { DeepSeekModel } from "./deepseek";

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
  model: DeepSeekModel;
  temperature: number;
  /**
   * Let the model reason before answering. Only worth the latency on the
   * top levels — every level asks for JSON, which thinking makes slower
   * without making it more valid.
   */
  thinking: boolean;
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
    model: "deepseek-v4-flash",
    temperature: 0.55,
    thinking: false,
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
    model: "deepseek-v4-flash",
    temperature: 0.4,
    thinking: false,
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
    model: "deepseek-v4-flash",
    temperature: 0.35,
    thinking: false,
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
    model: "deepseek-v4-pro",
    temperature: 0.3,
    thinking: true,
    minSlides: 7,
    maxSlides: 10,
    batchSize: 1,
    concurrency: 1,
    maxTokensPlan: 12000,
    maxTokensSlides: 24000,
  },
  max: {
    label: "Max",
    hint: "Full treatment",
    detail: "Longest run. Bigger, more interactive, built to ship.",
    eta: "~3 min",
    model: "deepseek-v4-pro",
    temperature: 0.28,
    thinking: true,
    minSlides: 8,
    maxSlides: 12,
    batchSize: 1,
    concurrency: 1,
    maxTokensPlan: 14000,
    maxTokensSlides: 28000,
  },
};
