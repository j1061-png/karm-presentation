import { nanoid } from "nanoid";
import type { Slide, SlideElement, Theme } from "./schema";
import { INTERACTIVITY, type InteractivityLevel } from "./interactivity";

/**
 * Snap generated slides onto proven 16:9 layouts. The model is bad at
 * freeform x/y — this is what stops overlapping, clipped, empty-looking decks.
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
  "map",
  "video",
  "image",
]);

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

function headingStyle(level: number): SlideElement["style"] {
  return {
    fontSize: level === 1 ? 50 : 36,
    fontWeight: 700,
    letterSpacing: -0.8,
  };
}

function blob(id: string, fill: string): SlideElement {
  return {
    id,
    type: "shape",
    x: 66,
    y: -26,
    w: 46,
    h: 76,
    z: 0,
    opacity: 0.09,
    rotation: 0,
    props: { shape: "circle", fill },
  };
}

function classify(slide: Slide, index: number, total: number): "title" | "stats-chart" | "widget" | "split" | "close" {
  const types = slide.elements.map((e) => e.type);
  const stats = types.filter((t) => t === "stat").length;
  const charts = types.filter((t) => t === "chart").length;
  const widgets = slide.elements.filter((e) => WIDGET.has(e.type));
  const last = index === total - 1;
  const first = index === 0;

  // Bookends are structural, not content-dependent. Previously an opening
  // slide only got the title treatment if it happened to carry two stats or a
  // button, so most decks opened on a generic content slide.
  if (first) return "title";
  if (last) return "close";
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

function fallbackCards(slide: Slide): SlideElement {
  const list = slide.elements.find((e) => e.type === "list");
  const text = slide.elements.find((e) => e.type === "text" && !isKicker(e));
  const items =
    list && list.type === "list"
      ? list.props.items.slice(0, 3)
      : text && text.type === "text"
        ? text.props.text
            .split(/[.!?]\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [slide.name];
  const cards = (items.length >= 2 ? items : [items[0] ?? slide.name, "What changes", "What we do next"]).map(
    (title, i) => ({
      number: String(i + 1),
      title: title.slice(0, 48),
      body: title,
    })
  );
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
    props: { cards },
  };
}

/**
 * Re-place a repaired slide onto a known-good layout. Content is preserved;
 * coordinates, heading sizes, kickers, and atmosphere are corrected.
 */
export function layoutSlide(
  slide: Slide,
  index: number,
  total: number,
  theme: Theme,
  interactivity: InteractivityLevel = "balanced"
): Slide {
  const cfg = INTERACTIVITY[interactivity];
  const kind = classify(slide, index, total);
  const kicker = ensureKicker(slide, theme);
  const heading = ensureHeading(slide);
  const stats = slide.elements.filter((e) => e.type === "stat");
  const charts = slide.elements.filter((e) => e.type === "chart");
  const callouts = slide.elements.filter((e) => e.type === "callout");
  const buttons = slide.elements.filter((e) => e.type === "button");
  const texts = slide.elements.filter((e) => e.type === "text" && !isKicker(e));
  const widgets = slide.elements.filter((e) => WIDGET.has(e.type));
  const lists = slide.elements.filter((e) => e.type === "list");

  const placed: SlideElement[] = [blob(`${slide.id}-blob`, theme.colors.accent)];
  const firstLast = index === 0 || index === total - 1;
  const showParticles =
    cfg.particleFrequency === "all" || (cfg.particleFrequency === "bookend" && firstLast);
  const background = {
    type: "gradient" as const,
    gradientFrom: theme.colors.background,
    gradientTo: theme.colors.surface,
    gradientAngle: 148,
    overlayOpacity: 0.5,
    particles: showParticles,
    particleDensity: cfg.particleDensity,
    particleSpeed: cfg.particleSpeed,
  };

  if (kind === "title") {
    placed.push(
      box(kicker, { x: 6, y: 12, w: 50, h: 5 }),
      box(heading, { x: 6, y: 20, w: 54, h: 26 })
    );
    if (texts[0]) placed.push(box(texts[0], { x: 6, y: 50, w: 50, h: 12 }));
    if (buttons[0]) placed.push(box(buttons[0], { x: 6, y: 78, w: 22, h: 9 }));
    const slots: Box[] = [
      { x: 64, y: 22, w: 30, h: 22 },
      { x: 64, y: 47, w: 30, h: 22 },
      { x: 64, y: 72, w: 30, h: 20 },
    ];
    take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
    if (stats.length === 0 && widgets[0]) placed.push(box(widgets[0], { x: 64, y: 22, w: 30, h: 70 }));
  } else if (kind === "stats-chart") {
    placed.push(
      box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
      box(heading, { x: 6, y: 10, w: 88, h: 8 })
    );
    const slots: Box[] = [
      { x: 6, y: 22, w: 28, h: 24 },
      { x: 36, y: 22, w: 28, h: 24 },
      { x: 66, y: 22, w: 28, h: 24 },
    ];
    take(stats, 3).forEach((el, i) => placed.push(box(el, slots[i])));
    if (charts[0]) placed.push(box(charts[0], { x: 6, y: 50, w: 88, h: 44 }));
    else if (widgets[0]) placed.push(box(widgets[0], { x: 6, y: 50, w: 88, h: 44 }));
  } else if (kind === "split") {
    placed.push(
      box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
      box(heading, { x: 6, y: 10, w: 88, h: 8 })
    );
    const left = widgets[0] ?? charts[0] ?? lists[0];
    const right = widgets[1] ?? callouts[0] ?? stats[0] ?? texts[0];
    if (left) placed.push(box(left, { x: 6, y: 22, w: 54, h: 70 }));
    if (right) placed.push(box(right, { x: 64, y: 22, w: 30, h: 70 }));
  } else if (kind === "close") {
    placed.push(
      box(kicker, { x: 6, y: 8, w: 50, h: 5 }),
      box(heading, { x: 6, y: 14, w: 88, h: 12 })
    );
    const hero = widgets[0] ?? lists[0] ?? fallbackCards(slide);
    placed.push(box(hero, { x: 6, y: 30, w: 88, h: 52 }));
    if (buttons[0]) placed.push(box(buttons[0], { x: 6, y: 86, w: 20, h: 8 }));
  } else {
    placed.push(
      box(kicker, { x: 6, y: 5, w: 50, h: 4 }),
      box(heading, { x: 6, y: 10, w: 88, h: 8 })
    );
    const hero = widgets[0] ?? charts[0] ?? lists[0] ?? fallbackCards(slide);
    // A supporting sentence used to be discarded outright, leaving every
    // content slide as bare heading + one big box. Giving it a fixed deck
    // between the heading and the hero keeps the writing and the hierarchy.
    const sub = texts[0];
    const heroTop = sub ? 29 : 22;
    if (sub) {
      placed.push(box(sub, { x: 6, y: 19.5, w: 78, h: 8 }));
    }
    if (callouts[0]) {
      placed.push(box(hero, { x: 6, y: heroTop, w: 88, h: 74 - heroTop }));
      placed.push(box(callouts[0], { x: 6, y: 78, w: 88, h: 16 }));
    } else {
      placed.push(box(hero, { x: 6, y: heroTop, w: 88, h: 92 - heroTop }));
    }
  }

  const seen = new Set(placed.map((e) => e.id));
  // Keep leftover interactive pieces only if the layout still has room — otherwise drop
  // them so they cannot overlap. Content already lives in the hero widget.
  void seen;

  // Pace entrance animations to the chosen interactivity level (vivid = snappier).
  const paced = placed.map((el) =>
    el.animation && el.animation.type !== "none"
      ? {
          ...el,
          animation: {
            ...el.animation,
            duration: Math.round(Math.max(0.15, el.animation.duration * cfg.animationSpeed) * 100) / 100,
            delay: Math.round(el.animation.delay * cfg.animationSpeed * 100) / 100,
          },
        }
      : el
  );

  return {
    ...slide,
    transition: slide.transition ?? "fade",
    background,
    elements: paced,
  };
}

export function fallbackSlide(
  name: string,
  goal: string,
  index: number,
  theme: Theme,
  interactivity: InteractivityLevel = "balanced"
): Slide {
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
  return layoutSlide(slide, index, Math.max(index + 1, 3), theme, interactivity);
}
