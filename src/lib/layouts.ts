import { nanoid } from "nanoid";
import { hashSeed } from "./palettes";
import type { Slide, SlideElement, Theme } from "./schema";

/**
 * Snap generated slides onto proven 16:9 layouts. Variants are chosen from
 * the slide id + theme so two decks don't get the same silhouette.
 */

type Box = { x: number; y: number; w: number; h: number };

const WIDGET = new Set([
  "chart",
  "table",
  "comparison",
  "timeline",
  "tabs",
  "accordion",
  "quiz",
  "flipcards",
  "flow",
  "cards",
  "callout",
  "map",
  "video",
  "image",
]);

const LIVE = new Set([
  "flipcards",
  "tabs",
  "accordion",
  "quiz",
  "flow",
  "cards",
  "timeline",
  "callout",
]);

const TRANSITIONS = ["fade", "slide", "zoom"] as const;

function box(el: SlideElement, slot: Box, z = 2): SlideElement {
  return { ...el, x: slot.x, y: slot.y, w: slot.w, h: slot.h, z, rotation: 0, opacity: el.opacity ?? 1 };
}

function isKicker(el: SlideElement): boolean {
  if (el.type !== "text") return false;
  const t = el.props.text.trim();
  if (!t || t.length > 52) return false;
  if ((el.style?.letterSpacing ?? 0) >= 1) return true;
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  return el.h <= 7 && el.y < 18;
}

function take<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

function kickerStyle(theme: Theme): SlideElement["style"] {
  return {
    color: theme.colors.accent,
    fontSize: 13,
    letterSpacing: 1.6,
    fontWeight: 600,
  };
}

function headingStyle(level: number, compact = false): SlideElement["style"] {
  const size = compact ? (level === 1 ? 32 : 28) : level === 1 ? 50 : 36;
  return {
    fontSize: size,
    fontWeight: 700,
    letterSpacing: -0.8,
    lineHeight: 1.08,
  };
}

function shape(
  id: string,
  slot: Box,
  fill: string,
  kind: "circle" | "rect",
  opacity: number
): SlideElement {
  return {
    id,
    type: "shape",
    ...slot,
    z: 0,
    opacity,
    rotation: 0,
    props: { shape: kind, fill },
  };
}

function decorations(slideId: string, theme: Theme, seed: number): SlideElement[] {
  const fill = theme.colors.accent;
  const v = seed % 5;
  if (v === 0) return [shape(`${slideId}-blob`, { x: 62, y: -18, w: 50, h: 80 }, fill, "circle", 0.14)];
  if (v === 1) return [shape(`${slideId}-blob`, { x: -16, y: 52, w: 44, h: 64 }, fill, "circle", 0.1)];
  if (v === 2)
    return [shape(`${slideId}-bar`, { x: 0, y: 0, w: 100, h: 1.4 }, fill, "rect", 0.85)];
  if (v === 3)
    return [
      shape(`${slideId}-rail`, { x: 0, y: 0, w: 1.2, h: 100 }, fill, "rect", 0.7),
      shape(`${slideId}-blob`, { x: 70, y: -18, w: 40, h: 56 }, fill, "circle", 0.1),
    ];
  return [];
}

function classify(slide: Slide, index: number, total: number): "title" | "stats-chart" | "widget" | "split" | "close" {
  const types = slide.elements.map((e) => e.type);
  const stats = types.filter((t) => t === "stat").length;
  const charts = types.filter((t) => t === "chart").length;
  const widgets = slide.elements.filter((e) => WIDGET.has(e.type));
  const live = slide.elements.filter((e) => LIVE.has(e.type));
  const last = index === total - 1;
  const first = index === 0;

  if (first && live.length === 0 && (stats >= 2 || types.includes("button"))) return "title";
  if (last && (types.includes("cards") || types.includes("quiz") || types.includes("list"))) return "close";
  if (live.length >= 1) return widgets.length >= 2 || live.length >= 2 ? "split" : "widget";
  if (stats >= 2 && charts >= 1) return "stats-chart";
  if (widgets.length >= 2) return "split";
  return "widget";
}

function ensureKicker(slide: Slide, theme: Theme): SlideElement {
  const existing = slide.elements.find(isKicker);
  if (existing) return { ...existing, style: { ...existing.style, ...kickerStyle(theme) } };
  return {
    id: nanoid(8),
    type: "text",
    x: 6,
    y: 5,
    w: 40,
    h: 4,
    z: 2,
    opacity: 1,
    rotation: 0,
    props: { text: slide.name.toUpperCase() },
    style: kickerStyle(theme),
  };
}

function ensureHeading(slide: Slide): SlideElement {
  const existing = slide.elements.find((e) => e.type === "heading");
  if (existing && existing.type === "heading") {
    return { ...existing, style: { ...existing.style, ...headingStyle(existing.props.level) } };
  }
  return {
    id: nanoid(8),
    type: "heading",
    x: 6,
    y: 10,
    w: 88,
    h: 10,
    z: 2,
    opacity: 1,
    rotation: 0,
    props: { text: slide.name, level: 2 },
    style: headingStyle(2),
  };
}

function slideBeats(slide: Slide): string[] {
  const list = slide.elements.find((e) => e.type === "list");
  const text = slide.elements.find((e) => e.type === "text" && !isKicker(e));
  const items =
    list && list.type === "list"
      ? list.props.items.slice(0, 4)
      : text && text.type === "text"
        ? text.props.text
            .split(/[.!?]\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4)
        : [slide.name];
  return items.length >= 2 ? items : [items[0] ?? slide.name, "What changes", "What we do next"];
}

function fallbackHero(slide: Slide, seed: number, preferred?: string): SlideElement {
  const filled = slideBeats(slide);
  const kind = preferred && preferred !== "stat" && preferred !== "chart" ? preferred : ["flipcards", "flow", "cards"][seed % 3];
  if (kind === "quiz") {
    return {
      id: nanoid(8),
      type: "quiz",
      x: 6,
      y: 22,
      w: 88,
      h: 70,
      z: 2,
      opacity: 1,
      rotation: 0,
      props: {
        question: slide.name,
        options: filled.slice(0, 4),
        correctIndex: 0,
        explanation: filled[0] ?? slide.name,
      },
    };
  }
  if (kind === "tabs") {
    return {
      id: nanoid(8),
      type: "tabs",
      x: 6,
      y: 22,
      w: 88,
      h: 70,
      z: 2,
      opacity: 1,
      rotation: 0,
      props: {
        tabs: filled.slice(0, 4).map((title, i) => ({
          label: `0${i + 1}`,
          title: title.slice(0, 40),
          content: title,
        })),
      },
    };
  }
  if (kind === "timeline") {
    return {
      id: nanoid(8),
      type: "timeline",
      x: 6,
      y: 22,
      w: 88,
      h: 70,
      z: 2,
      opacity: 1,
      rotation: 0,
      props: {
        orientation: "horizontal",
        items: filled.slice(0, 4).map((title, i) => ({
          date: `Step ${i + 1}`,
          title: title.slice(0, 40),
          description: title,
        })),
      },
    };
  }
  if (kind === "flipcards") {
    return {
      id: nanoid(8),
      type: "flipcards",
      x: 6,
      y: 22,
      w: 88,
      h: 70,
      z: 2,
      opacity: 1,
      rotation: 0,
      props: {
        cards: filled.map((title) => ({
          front: title.slice(0, 48),
          back: title,
        })),
      },
    };
  }
  if (kind === "flow") {
    return {
      id: nanoid(8),
      type: "flow",
      x: 6,
      y: 22,
      w: 88,
      h: 70,
      z: 2,
      opacity: 1,
      rotation: 0,
      props: {
        steps: filled.map((title) => ({ label: title.slice(0, 32), detail: title })),
      },
    };
  }
  return {
    id: nanoid(8),
    type: "cards",
    x: 6,
    y: 22,
    w: 88,
    h: 70,
    z: 2,
    opacity: 1,
    rotation: 0,
    props: {
      cards: filled.map((title, i) => ({
        number: String(i + 1),
        title: title.slice(0, 48),
        body: title,
      })),
    },
  };
}

function defaultButton(): SlideElement {
  return {
    id: nanoid(8),
    type: "button",
    x: 6,
    y: 78,
    w: 22,
    h: 9,
    z: 2,
    opacity: 1,
    rotation: 0,
    props: { label: "Next", action: "next-slide", variant: "primary" },
  };
}

function compactHeading(heading: SlideElement): SlideElement {
  return { ...heading, style: { ...heading.style, ...headingStyle(2, true) } };
}

/**
 * Re-place a repaired slide onto a known-good layout. Content is preserved;
 * coordinates, heading sizes, kickers, and atmosphere are corrected.
 */
export function layoutSlide(slide: Slide, index: number, total: number, theme: Theme): Slide {
  const kind = classify(slide, index, total);
  const seed = hashSeed(`${slide.id}|${theme.name}|${index}|${kind}`);
  const kicker = ensureKicker(slide, theme);
  const heading = ensureHeading(slide);
  const stats = slide.elements.filter((e) => e.type === "stat");
  const charts = slide.elements.filter((e) => e.type === "chart");
  const callouts = slide.elements.filter((e) => e.type === "callout");
  const buttons = slide.elements.filter((e) => e.type === "button");
  const texts = slide.elements.filter((e) => e.type === "text" && !isKicker(e));
  const widgets = slide.elements.filter((e) => WIDGET.has(e.type));
  const lists = slide.elements.filter((e) => e.type === "list");
  const hero = widgets[0] ?? charts[0] ?? lists[0] ?? fallbackHero(slide, seed);

  const placed: SlideElement[] = [...decorations(slide.id, theme, seed)];
  const firstLast = index === 0 || index === total - 1;
  const angles = [148, 112, 200, 90, 168, 132];
  const background = {
    type: "gradient" as const,
    gradientFrom: theme.colors.background,
    gradientTo: theme.colors.surface,
    gradientAngle: angles[seed % angles.length],
    overlayOpacity: 0.5,
    particles: firstLast || seed % 7 === 0,
  };

  if (kind === "title") {
    const variant = seed % 3;
    if (variant === 1) {
      placed.push(
        box(kicker, { x: 6, y: 8, w: 88, h: 4 }),
        box({ ...heading, style: { ...heading.style, ...headingStyle(1), textAlign: "center" } }, { x: 10, y: 16, w: 80, h: 24 })
      );
      if (texts[0]) placed.push(box({ ...texts[0], style: { ...texts[0].style, textAlign: "center" } }, { x: 16, y: 42, w: 68, h: 10 }));
      if (stats.length === 0 && widgets[0]) {
        placed.push(box(widgets[0], { x: 10, y: 56, w: 80, h: 38 }));
      } else {
        placed.push(box(buttons[0] ?? defaultButton(), { x: 39, y: 54, w: 22, h: 8 }));
        const slots: Box[] = [
          { x: 6, y: 72, w: 28, h: 20 },
          { x: 36, y: 72, w: 28, h: 20 },
          { x: 66, y: 72, w: 28, h: 20 },
        ];
        take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
      }
    } else if (variant === 2) {
      placed.push(
        box(kicker, { x: 6, y: 10, w: 50, h: 5 }),
        box(heading, { x: 6, y: 18, w: 70, h: 26 })
      );
      if (texts[0]) placed.push(box(texts[0], { x: 6, y: 46, w: 55, h: 12 }));
      if (stats.length === 0 && widgets[0]) {
        placed.push(box(widgets[0], { x: 6, y: 60, w: 88, h: 34 }));
      } else {
        placed.push(box(buttons[0] ?? defaultButton(), { x: 6, y: 60, w: 22, h: 8 }));
        const slots: Box[] = [
          { x: 6, y: 74, w: 28, h: 20 },
          { x: 36, y: 74, w: 28, h: 20 },
          { x: 66, y: 74, w: 28, h: 20 },
        ];
        take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
      }
    } else {
      placed.push(
        box(kicker, { x: 6, y: 12, w: 50, h: 5 }),
        box(heading, { x: 6, y: 20, w: 54, h: 26 })
      );
      if (texts[0]) placed.push(box(texts[0], { x: 6, y: 50, w: 50, h: 12 }));
      placed.push(box(buttons[0] ?? defaultButton(), { x: 6, y: 78, w: 22, h: 9 }));
      const slots: Box[] = [
        { x: 64, y: 22, w: 30, h: 22 },
        { x: 64, y: 47, w: 30, h: 22 },
        { x: 64, y: 72, w: 30, h: 20 },
      ];
      take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
      if (stats.length === 0 && widgets[0]) placed.push(box(widgets[0], { x: 64, y: 22, w: 30, h: 70 }));
    }
  } else if (kind === "stats-chart") {
    const variant = seed % 2;
    if (variant === 1) {
      placed.push(
        box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
        box(compactHeading(heading), { x: 6, y: 10, w: 88, h: 8 })
      );
      if (charts[0]) placed.push(box(charts[0], { x: 6, y: 22, w: 58, h: 70 }));
      else placed.push(box(hero, { x: 6, y: 22, w: 58, h: 70 }));
      const slots: Box[] = [
        { x: 68, y: 22, w: 26, h: 22 },
        { x: 68, y: 47, w: 26, h: 22 },
        { x: 68, y: 72, w: 26, h: 20 },
      ];
      take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
    } else {
      placed.push(
        box(kicker, { x: 6, y: 4, w: 50, h: 4 }),
        box(compactHeading(heading), { x: 6, y: 8.5, w: 88, h: 7 })
      );
      const slots: Box[] = [
        { x: 6, y: 17, w: 28, h: 20 },
        { x: 36, y: 17, w: 28, h: 20 },
        { x: 66, y: 17, w: 28, h: 20 },
      ];
      take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
      if (charts[0]) placed.push(box(charts[0], { x: 6, y: 40, w: 88, h: 54 }));
      else placed.push(box(hero, { x: 6, y: 40, w: 88, h: 54 }));
    }
  } else if (kind === "split") {
    const variant = seed % 3;
    placed.push(
      box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
      box(compactHeading(heading), { x: 6, y: 10, w: 88, h: 8 })
    );
    const left = widgets[0] ?? charts[0] ?? lists[0];
    const right = widgets[1] ?? callouts[0] ?? stats[0] ?? texts[0];
    if (variant === 1) {
      if (left) placed.push(box(left, { x: 6, y: 22, w: 88, h: 32 }));
      if (right) placed.push(box(right, { x: 6, y: 58, w: 88, h: 34 }));
    } else if (variant === 2) {
      if (left) placed.push(box(left, { x: 38, y: 22, w: 56, h: 70 }));
      if (right) placed.push(box(right, { x: 6, y: 22, w: 30, h: 70 }));
    } else {
      if (left) placed.push(box(left, { x: 6, y: 22, w: 54, h: 70 }));
      if (right) placed.push(box(right, { x: 64, y: 22, w: 30, h: 70 }));
    }
  } else if (kind === "close") {
    placed.push(
      box(kicker, { x: 6, y: 8, w: 50, h: 5 }),
      box(compactHeading(heading), { x: 6, y: 14, w: 88, h: 12 })
    );
    placed.push(box(hero, { x: seed % 2 === 0 ? 6 : 10, y: 30, w: seed % 2 === 0 ? 88 : 80, h: 52 }));
    if (buttons[0]) placed.push(box(buttons[0], { x: 6, y: 86, w: 20, h: 8 }));
  } else {
    const variant = seed % 3;
    placed.push(
      box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
      box(compactHeading(heading), { x: 6, y: 10, w: 88, h: 8 })
    );
    if (variant === 1 && (texts[0] || lists[0] || callouts[0])) {
      const side = texts[0] ?? lists[0] ?? callouts[0];
      if (side) placed.push(box(side, { x: 6, y: 22, w: 30, h: 70 }));
      placed.push(box(hero, { x: 38, y: 22, w: 56, h: 70 }));
    } else if (variant === 2 && callouts[0]) {
      placed.push(box(hero, { x: 6, y: 22, w: 88, h: 48 }));
      placed.push(box(callouts[0], { x: 6, y: 74, w: 88, h: 18 }));
    } else if (callouts[0]) {
      placed.push(box(hero, { x: 6, y: 22, w: 88, h: 52 }));
      placed.push(box(callouts[0], { x: 6, y: 78, w: 88, h: 16 }));
    } else {
      placed.push(box(hero, { x: 6, y: 22, w: 88, h: 70 }));
    }
  }

  return {
    ...slide,
    transition: slide.transition && slide.transition !== "fade" ? slide.transition : TRANSITIONS[seed % TRANSITIONS.length],
    background,
    elements: placed,
  };
}

export function hasLiveWidget(slide: Slide): boolean {
  return slide.elements.some((e) => LIVE.has(e.type) || e.type === "button" || e.type === "quiz");
}

/** After snap, guarantee the slide can be clicked, flipped, or answered. */
export function ensureInteractive(
  slide: Slide,
  preferredHero: string | undefined,
  index: number,
  total: number,
  theme: Theme
): Slide {
  if (hasLiveWidget(slide)) return slide;
  const extra = fallbackHero(slide, hashSeed(slide.id + (preferredHero ?? "")), preferredHero);
  return layoutSlide({ ...slide, elements: [...slide.elements, extra] }, index, total, theme);
}

export function fallbackSlide(name: string, goal: string, index: number, theme: Theme): Slide {
  const id = nanoid(8);
  const slide: Slide = {
    id,
    name,
    transition: "fade",
    elements: [
      {
        id: nanoid(8),
        type: "heading",
        x: 6,
        y: 10,
        w: 88,
        h: 10,
        z: 2,
        opacity: 1,
        rotation: 0,
        props: { text: name, level: 2 },
      },
      {
        id: nanoid(8),
        type: "cards",
        x: 6,
        y: 22,
        w: 88,
        h: 70,
        z: 2,
        opacity: 1,
        rotation: 0,
        props: {
          cards: [
            { number: "1", title: "The point", body: goal.slice(0, 180) || name },
            { number: "2", title: "The proof", body: "Replace with the evidence that makes this slide true." },
            { number: "3", title: "The ask", body: "What the room should do after this slide." },
          ],
        },
      },
    ],
    notes: goal,
  };
  return layoutSlide(slide, index, Math.max(index + 1, 3), theme);
}
