/**
 * How much motion and interactive flourish a generated deck should carry —
 * from the constellation/particle backgrounds down to entrance-animation
 * pacing. Chosen once at generation time, stored on the document, and
 * respected by every later AI edit so the deck stays consistent.
 */
export type InteractivityLevel = "calm" | "balanced" | "vivid";

export const INTERACTIVITY_LEVELS: InteractivityLevel[] = ["calm", "balanced", "vivid"];

export interface InteractivityConfig {
  key: InteractivityLevel;
  label: string;
  hint: string;
  /** Swatch color used only in the picker UI + as a live particle-preview tint. */
  color: string;
  /** Which slides get a moving-particle background. */
  particleFrequency: "none" | "bookend" | "all";
  particleDensity: number;
  particleSpeed: number;
  /** Multiplier on entrance-animation duration — vivid decks animate faster/snappier. */
  animationSpeed: number;
}

export const INTERACTIVITY: Record<InteractivityLevel, InteractivityConfig> = {
  calm: {
    key: "calm",
    label: "Calm",
    hint: "Static and clean. Content first, almost no motion.",
    color: "#5fb8e0",
    particleFrequency: "none",
    particleDensity: 0,
    particleSpeed: 1,
    animationSpeed: 1.2,
  },
  balanced: {
    key: "balanced",
    label: "Balanced",
    hint: "Subtle motion — a moving-star field to open and close the deck.",
    color: "#f5a623",
    particleFrequency: "bookend",
    particleDensity: 46,
    particleSpeed: 1,
    animationSpeed: 1,
  },
  vivid: {
    key: "vivid",
    label: "Vivid",
    hint: "Moving stars throughout, snappier transitions, maximum interactivity.",
    color: "#c586f5",
    particleFrequency: "all",
    particleDensity: 85,
    particleSpeed: 1.7,
    animationSpeed: 0.8,
  },
};

export function parseInteractivity(value: unknown): InteractivityLevel {
  return value === "calm" || value === "vivid" || value === "balanced" ? value : "balanced";
}
