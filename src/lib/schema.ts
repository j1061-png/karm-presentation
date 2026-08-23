import { z } from "zod";

/**
 * The structured presentation model.
 *
 * DeepSeek never generates raw HTML — it generates this JSON model, which is
 * validated, repaired and then rendered by a controlled component system.
 * Every element has a stable id so individual elements can be edited without
 * regenerating the presentation.
 */

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export const ThemeSchema = z.object({
  name: z.string().default("Karm Dark"),
  mode: z.enum(["dark", "light"]).default("dark"),
  colors: z
    .object({
      background: z.string().default("#0c0d10"),
      surface: z.string().default("#16181d"),
      text: z.string().default("#f4f5f7"),
      muted: z.string().default("#9ba1ab"),
      accent: z.string().default("#f5a623"),
      accentText: z.string().default("#101114"),
    })
    .default({}),
  headingFont: z.string().default("inherit"),
  bodyFont: z.string().default("inherit"),
  radius: z.number().min(0).max(32).default(12),
});
export type Theme = z.infer<typeof ThemeSchema>;

// ---------------------------------------------------------------------------
// Shared element pieces
// ---------------------------------------------------------------------------

export const AnimationSchema = z.object({
  type: z
    .enum(["none", "fade", "fade-up", "fade-down", "slide-left", "slide-right", "zoom"])
    .default("fade-up"),
  delay: z.number().min(0).max(5).default(0),
  duration: z.number().min(0.1).max(3).default(0.6),
});
export type Animation = z.infer<typeof AnimationSchema>;

export const ElementStyleSchema = z.object({
  color: z.string().optional(),
  background: z.string().optional(),
  fontSize: z.number().min(8).max(200).optional(),
  fontWeight: z.number().min(100).max(900).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  borderRadius: z.number().min(0).max(100).optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().min(0).max(12).optional(),
  padding: z.number().min(0).max(120).optional(),
  shadow: z.boolean().optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  letterSpacing: z.number().min(-2).max(10).optional(),
});
export type ElementStyle = z.infer<typeof ElementStyleSchema>;

/** Positions are percentages of the 1280x720 slide canvas (0-100). */
const pos = z.number().min(-20).max(120);
const size = z.number().min(1).max(120);

const BaseElement = z.object({
  id: z.string(),
  x: pos.default(5),
  y: pos.default(5),
  w: size.default(40),
  h: size.default(20),
  z: z.number().int().min(0).max(200).default(1),
  opacity: z.number().min(0).max(1).default(1),
  rotation: z.number().min(-180).max(180).default(0),
  animation: AnimationSchema.optional(),
  style: ElementStyleSchema.optional(),
  locked: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Element types
// ---------------------------------------------------------------------------

export const HeadingElement = BaseElement.extend({
  type: z.literal("heading"),
  props: z.object({
    text: z.string().default("Heading"),
    level: z.number().int().min(1).max(3).default(1),
  }),
});

export const TextElement = BaseElement.extend({
  type: z.literal("text"),
  props: z.object({
    text: z.string().default("Text"),
  }),
});

export const ListElement = BaseElement.extend({
  type: z.literal("list"),
  props: z.object({
    items: z.array(z.string()).min(1).default(["Item"]),
    ordered: z.boolean().default(false),
    marker: z.enum(["dot", "check", "arrow", "number"]).default("dot"),
  }),
});

export const QuoteElement = BaseElement.extend({
  type: z.literal("quote"),
  props: z.object({
    text: z.string().default("Quote"),
    attribution: z.string().optional(),
  }),
});

export const ImageElement = BaseElement.extend({
  type: z.literal("image"),
  props: z.object({
    src: z.string().default(""),
    alt: z.string().default(""),
    fit: z.enum(["cover", "contain"]).default("cover"),
  }),
});

export const StatElement = BaseElement.extend({
  type: z.literal("stat"),
  props: z.object({
    value: z.string().default("0"),
    label: z.string().default(""),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    trend: z
      .object({ direction: z.enum(["up", "down", "flat"]), value: z.string() })
      .optional(),
    countUp: z.boolean().default(true),
    icon: z.string().optional(),
  }),
});

export const ChartSeriesSchema = z.object({
  name: z.string().default("Series"),
  data: z.array(z.number()),
  color: z.string().optional(),
});

export const ChartElement = BaseElement.extend({
  type: z.literal("chart"),
  props: z.object({
    chartType: z.enum(["bar", "line", "area", "pie", "donut", "radar"]).default("bar"),
    title: z.string().optional(),
    labels: z.array(z.string()).min(1),
    series: z.array(ChartSeriesSchema).min(1),
    stacked: z.boolean().default(false),
    showLegend: z.boolean().default(true),
    showGrid: z.boolean().default(true),
    valueSuffix: z.string().optional(),
    valuePrefix: z.string().optional(),
  }),
});

export const TableElement = BaseElement.extend({
  type: z.literal("table"),
  props: z.object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
    highlightColumn: z.number().int().optional(),
    compact: z.boolean().default(false),
  }),
});

export const ComparisonElement = BaseElement.extend({
  type: z.literal("comparison"),
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          subtitle: z.string().optional(),
          badge: z.string().optional(),
          points: z.array(z.string()).default([]),
          highlighted: z.boolean().default(false),
        })
      )
      .min(2),
  }),
});

export const TimelineElement = BaseElement.extend({
  type: z.literal("timeline"),
  props: z.object({
    orientation: z.enum(["horizontal", "vertical"]).default("vertical"),
    items: z
      .array(
        z.object({
          date: z.string(),
          title: z.string(),
          description: z.string().optional(),
        })
      )
      .min(2),
  }),
});

export const TabsElement = BaseElement.extend({
  type: z.literal("tabs"),
  props: z.object({
    tabs: z
      .array(z.object({ label: z.string(), title: z.string().optional(), content: z.string() }))
      .min(2),
  }),
});

export const AccordionElement = BaseElement.extend({
  type: z.literal("accordion"),
  props: z.object({
    items: z.array(z.object({ title: z.string(), content: z.string() })).min(1),
  }),
});

export const QuizElement = BaseElement.extend({
  type: z.literal("quiz"),
  props: z.object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correctIndex: z.number().int().min(0),
    explanation: z.string().optional(),
  }),
});

export const ProgressElement = BaseElement.extend({
  type: z.literal("progress"),
  props: z.object({
    label: z.string().default(""),
    value: z.number().min(0).max(100),
    suffix: z.string().default("%"),
    showValue: z.boolean().default(true),
  }),
});

export const ButtonElement = BaseElement.extend({
  type: z.literal("button"),
  props: z.object({
    label: z.string().default("Button"),
    action: z.enum(["next-slide", "prev-slide", "goto-slide", "link"]).default("next-slide"),
    targetSlide: z.number().int().min(0).optional(),
    href: z.string().optional(),
    variant: z.enum(["primary", "secondary", "ghost"]).default("primary"),
  }),
});

export const ShapeElement = BaseElement.extend({
  type: z.literal("shape"),
  props: z.object({
    shape: z.enum(["rect", "circle", "line"]).default("rect"),
    fill: z.string().default("#f5a623"),
  }),
});

export const VideoElement = BaseElement.extend({
  type: z.literal("video"),
  props: z.object({
    provider: z.literal("youtube").default("youtube"),
    videoId: z.string().default(""),
  }),
});

export const MapElement = BaseElement.extend({
  type: z.literal("map"),
  props: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    zoom: z.number().min(1).max(18).default(6),
    label: z.string().optional(),
  }),
});

export const IconElement = BaseElement.extend({
  type: z.literal("icon"),
  props: z.object({
    name: z.string().default("sun"),
    color: z.string().optional(),
  }),
});

export const FlipCardsElement = BaseElement.extend({
  type: z.literal("flipcards"),
  props: z.object({
    cards: z
      .array(
        z.object({
          front: z.string(),
          back: z.string(),
          icon: z.string().optional(),
        })
      )
      .min(1)
      .max(6),
  }),
});

export const CalloutElement = BaseElement.extend({
  type: z.literal("callout"),
  props: z.object({
    kicker: z.string().default("Where this is weak"),
    title: z.string().default(""),
    body: z.string().default(""),
    variant: z.enum(["weak", "insight", "warning", "note"]).default("weak"),
    startOpen: z.boolean().default(false),
  }),
});

export const FlowElement = BaseElement.extend({
  type: z.literal("flow"),
  props: z.object({
    steps: z
      .array(
        z.object({
          label: z.string(),
          detail: z.string().optional(),
        })
      )
      .min(2)
      .max(6),
  }),
});

export const CardsElement = BaseElement.extend({
  type: z.literal("cards"),
  props: z.object({
    cards: z
      .array(
        z.object({
          number: z.string().optional(),
          title: z.string(),
          body: z.string().default(""),
          icon: z.string().optional(),
        })
      )
      .min(2)
      .max(6),
  }),
});

export const ElementSchema = z.discriminatedUnion("type", [
  HeadingElement,
  TextElement,
  ListElement,
  QuoteElement,
  ImageElement,
  StatElement,
  ChartElement,
  TableElement,
  ComparisonElement,
  TimelineElement,
  TabsElement,
  AccordionElement,
  QuizElement,
  ProgressElement,
  ButtonElement,
  ShapeElement,
  VideoElement,
  MapElement,
  IconElement,
  FlipCardsElement,
  CalloutElement,
  FlowElement,
  CardsElement,
]);
export type SlideElement = z.infer<typeof ElementSchema>;
export type ElementType = SlideElement["type"];

// ---------------------------------------------------------------------------
// Slide + presentation
// ---------------------------------------------------------------------------

export const SlideBackgroundSchema = z.object({
  type: z.enum(["color", "gradient", "image"]).default("color"),
  color: z.string().optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  gradientAngle: z.number().min(0).max(360).default(135),
  imageSrc: z.string().optional(),
  overlayOpacity: z.number().min(0).max(1).default(0.5),
  /** Live constellation / particle field — use on title and thesis slides. */
  particles: z.boolean().default(false),
});
export type SlideBackground = z.infer<typeof SlideBackgroundSchema>;

export const SlideSchema = z.object({
  id: z.string(),
  name: z.string().default("Slide"),
  background: SlideBackgroundSchema.optional(),
  transition: z.enum(["fade", "slide", "zoom", "none"]).default("fade"),
  elements: z.array(ElementSchema).default([]),
  notes: z.string().optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

export const ChatTurnSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string().default(""),
  files: z.array(z.string()).optional(),
  kind: z.enum(["text", "result", "edit", "error"]).optional(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const PresentationSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled presentation"),
  description: z.string().default(""),
  theme: ThemeSchema.default({}),
  slides: z.array(SlideSchema).min(1),
  version: z.number().int().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  chatThread: z.array(ChatTurnSchema).optional(),
});
export type Presentation = z.infer<typeof PresentationSchema>;

// ---------------------------------------------------------------------------
// Listing metadata (stored in the per-user index)
// ---------------------------------------------------------------------------

export interface PresentationMeta {
  id: string;
  title: string;
  description: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
  themeColors: { background: string; accent: string; text: string; surface: string };
  preview: Slide | null;
  /** Set when the presentation has a live published version. */
  publishedAt?: string;
  visibility?: "private" | "link" | "public";
  /** Owner of this row, or editor if it was shared with the current user. */
  role?: "owner" | "editor";
  ownerName?: string;
}

// ---------------------------------------------------------------------------
// AI edit operations — the AI edits the model through these, never raw HTML
// ---------------------------------------------------------------------------

export const AIOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replaceSlide"), slideId: z.string(), slide: SlideSchema }),
  z.object({
    op: z.literal("addSlide"),
    index: z.number().int().min(0).optional(),
    slide: SlideSchema,
  }),
  z.object({ op: z.literal("deleteSlide"), slideId: z.string() }),
  z.object({
    op: z.literal("updateElement"),
    slideId: z.string(),
    elementId: z.string(),
    element: ElementSchema,
  }),
  z.object({ op: z.literal("addElement"), slideId: z.string(), element: ElementSchema }),
  z.object({ op: z.literal("deleteElement"), slideId: z.string(), elementId: z.string() }),
  z.object({ op: z.literal("updateTheme"), theme: ThemeSchema }),
  z.object({ op: z.literal("setTitle"), title: z.string() }),
]);
export type AIOperation = z.infer<typeof AIOperationSchema>;

export const AIEditResponseSchema = z.object({
  summary: z.string().default("Done."),
  operations: z.array(AIOperationSchema).default([]),
});
export type AIEditResponse = z.infer<typeof AIEditResponseSchema>;

// ---------------------------------------------------------------------------
// Plan (phase 1 of generation)
// ---------------------------------------------------------------------------

export const PlanSlideSchema = z.object({
  name: z.string(),
  goal: z.string(),
  suggestedComponents: z.array(z.string()).default([]),
});

export const PlanSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  audience: z.string().default(""),
  theme: ThemeSchema.default({}),
  slides: z.array(PlanSlideSchema).min(1).max(16),
});
export type Plan = z.infer<typeof PlanSchema>;
