import type { Theme } from "./schema";
import { ThemeSchema } from "./schema";

export interface Palette {
  name: string;
  mode: "dark" | "light";
  keywords: RegExp;
  colors: Theme["colors"];
  radius: number;
}

export const PALETTES: Palette[] = [
  {
    name: "Ember",
    mode: "dark",
    keywords: /solar|energy|karm|grid|microgrid|desert|amber|gold/,
    colors: {
      background: "#0c0d10",
      surface: "#17161a",
      text: "#f4f5f7",
      muted: "#9ba1ab",
      accent: "#f5a623",
      accentText: "#101114",
    },
    radius: 16,
  },
  {
    name: "Midnight",
    mode: "dark",
    keywords: /tech|product|saas|software|launch|platform/,
    colors: {
      background: "#070b14",
      surface: "#121826",
      text: "#eef2ff",
      muted: "#8b97b0",
      accent: "#4f9cf9",
      accentText: "#071018",
    },
    radius: 14,
  },
  {
    name: "Forest",
    mode: "dark",
    keywords: /health|wellbeing|care|climate|green|nature|agri/,
    colors: {
      background: "#07110c",
      surface: "#122018",
      text: "#eef6f0",
      muted: "#8aa394",
      accent: "#43c98a",
      accentText: "#062016",
    },
    radius: 18,
  },
  {
    name: "Studio",
    mode: "dark",
    keywords: /brand|campaign|market|hello|social|culture|story|creative/,
    colors: {
      background: "#120814",
      surface: "#1d1222",
      text: "#f7f0fb",
      muted: "#b09ab8",
      accent: "#e66df2",
      accentText: "#1a0b1c",
    },
    radius: 20,
  },
  {
    name: "Signal",
    mode: "dark",
    keywords: /safety|hazard|risk|alert|crisis|incident/,
    colors: {
      background: "#140808",
      surface: "#221212",
      text: "#fff5f4",
      muted: "#c4a3a0",
      accent: "#f0554d",
      accentText: "#fff8f7",
    },
    radius: 12,
  },
  {
    name: "Ink",
    mode: "dark",
    keywords: /invest|financ|board|arr|revenue|series|pitch/,
    colors: {
      background: "#0a0a0a",
      surface: "#161616",
      text: "#f3f1ec",
      muted: "#9a968c",
      accent: "#e8e4dc",
      accentText: "#111111",
    },
    radius: 10,
  },
  {
    name: "Copper",
    mode: "dark",
    keywords: /industrial|ops|construct|manufactur|logistics/,
    colors: {
      background: "#12100c",
      surface: "#1d1913",
      text: "#f6efe6",
      muted: "#b3a89a",
      accent: "#d9774a",
      accentText: "#1a100a",
    },
    radius: 14,
  },
  {
    name: "Paper",
    mode: "light",
    keywords: /report|memo|policy|legal|brief/,
    colors: {
      background: "#f4f1ea",
      surface: "#ffffff",
      text: "#1a1916",
      muted: "#6b675f",
      accent: "#1d4ed8",
      accentText: "#ffffff",
    },
    radius: 12,
  },
  {
    name: "Daylight",
    mode: "light",
    keywords: /school|train|lesson|educat|workshop|onboard/,
    colors: {
      background: "#f6f7f4",
      surface: "#ffffff",
      text: "#15201c",
      muted: "#5c6b66",
      accent: "#0f7a72",
      accentText: "#ffffff",
    },
    radius: 16,
  },
  {
    name: "Arctic",
    mode: "light",
    keywords: /data|research|analys|science|lab/,
    colors: {
      background: "#eef4f7",
      surface: "#ffffff",
      text: "#0f1720",
      muted: "#5b6b75",
      accent: "#0e7490",
      accentText: "#ffffff",
    },
    radius: 14,
  },
];

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pickPalette(prompt: string): Palette {
  const text = prompt.toLowerCase();
  const hit = PALETTES.find((p) => p.keywords.test(text));
  if (hit) return hit;
  return PALETTES[hashSeed(text) % PALETTES.length];
}

export function themeFromPalette(palette: Palette): Theme {
  return ThemeSchema.parse({
    name: palette.name,
    mode: palette.mode,
    colors: palette.colors,
    radius: palette.radius,
  });
}

/** Ignore the model when it copies the default orange example. */
export function resolveDeckTheme(prompt: string, planned?: Theme): Theme {
  const copiedDefault =
    !planned?.colors?.accent ||
    planned.colors.accent.toLowerCase() === "#f5a623" ||
    planned.name === "Karm Dark" ||
    planned.name === "default";
  if (!copiedDefault && planned) return ThemeSchema.parse(planned);
  return themeFromPalette(pickPalette(prompt));
}
