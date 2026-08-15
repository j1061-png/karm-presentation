export type Effort = "fast" | "standard" | "high";

export const EFFORT_LEVELS: Effort[] = ["fast", "standard", "high"];

export function parseEffort(value: unknown): Effort {
  return value === "fast" || value === "high" || value === "standard" ? value : "standard";
}

export interface EffortConfig {
  label: string;
  hint: string;
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
  fast: {
    label: "Fast",
    hint: "Shorter deck, quicker",
    model: "deepseek-chat",
    temperature: 0.35,
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
    hint: "Balanced quality",
    model: "deepseek-chat",
    temperature: 0.2,
    jsonMode: true,
    minSlides: 6,
    maxSlides: 8,
    batchSize: 1,
    concurrency: 2,
    maxTokensPlan: 3000,
    maxTokensSlides: 4500,
  },
  high: {
    label: "High",
    hint: "Slower, more careful",
    model: "deepseek-reasoner",
    temperature: 0.2,
    jsonMode: false,
    minSlides: 7,
    maxSlides: 10,
    batchSize: 1,
    concurrency: 1,
    maxTokensPlan: 6000,
    maxTokensSlides: 14000,
  },
};
