/**
 * Prompts for structured slide JSON. Short, few-shot, layout-locked.
 * The renderer snaps coordinates anyway — the model must get types + copy right.
 */

export const ELEMENT_REFERENCE = `
Each element: { "id": "a1", "type": "...", "x": 0-100, "y": 0-100, "w": 1-100, "h": 1-100, "z": 1, "opacity": 1, "props": {...} }
Canvas is 1280×16:9. Use the EXACT coordinates from the layout you pick. Do not invent new positions.

LAYOUTS — pick one per slide and copy its boxes:
- "title": kicker text (6,12,50,5), heading (6,20,54,26), stake text (6,50,50,12), button (6,78,22,9), three stats at (64,22,30,22) (64,47,30,22) (64,72,30,20)
- "stats-chart": kicker (6,5,50,4), heading (6,10,88,8), three stats (6,22,28,24) (36,22,28,24) (66,22,28,24), chart (6,50,88,44)
- "widget": kicker (6,5,50,4), heading (6,10,88,8), ONE big interactive (6,22,88,70) — chart, tabs, flipcards, quiz, flow, cards, timeline, comparison, accordion, or map
- "split": kicker + heading as widget, left widget (6,22,54,70), right widget (64,22,30,70)
- "close": kicker (6,8,50,5), heading (6,14,88,12), cards or quiz (6,30,88,52)

PROPS:
- heading: { "text", "level": 1|2|3 }
- text: { "text" }
- list: { "items": [string], "ordered": false, "marker": "dot|check|arrow|number" }
- stat: { "value": "42", "label": "short label", "prefix": "", "suffix": "%", "countUp": true, "icon": "sun|zap|users|trending-up|globe|leaf|dollar-sign|target|award|calendar|shield", "trend": {"direction":"up|down|flat","value":"12%"} }
- chart: { "chartType": "bar|line|area|donut", "title": "", "labels": ["A","B"], "series": [{"name":"S","data":[1,2]}], "stacked": false, "showLegend": false, "showGrid": true, "valuePrefix": "", "valueSuffix": "" }
- tabs: { "tabs": [{"label","title","content"}] }  (3-4)
- accordion: { "items": [{"title","content"}] }
- quiz: { "question", "options": [string], "correctIndex": 0, "explanation" }
- flipcards: { "cards": [{"front","back","icon"}] }  (3)
- cards: { "cards": [{"number":"1","title","body"}] }  (3)
- flow: { "steps": [{"label","detail"}] }  (3-4)
- comparison: { "items": [{"title","points":[string],"highlighted":bool,"badge":""}] }  (2)
- timeline: { "orientation": "horizontal|vertical", "items": [{"date","title","description"}] }
- callout: { "kicker":"Where this is weak", "title":"", "body":"", "variant":"weak|insight", "startOpen": false }
- button: { "label", "action":"next-slide", "variant":"primary" }
- map: { "lat", "lng", "zoom": 5, "label" }
- table: { "columns":[string], "rows":[[string]], "compact": false }
- embed: { "html": "<div>...</div>" } — raw HTML/CSS rendered in a sandboxed frame (no scripts ever run). Use ONLY when the user supplied their own HTML/CSS and asked to keep it as-is, or explicitly asked for a "custom HTML" block. Never use embed to sidestep the structured element types for ordinary content.

SLIDE: { "id", "name", "layout": "title|stats-chart|widget|split|close", "transition":"fade", "background": {"type":"gradient","gradientFrom":"#0b0d12","gradientTo":"#161a22","gradientAngle":148,"particles":false}, "elements":[...], "notes":"what the presenter says" }
`;

const FEW_SHOT = `
EXAMPLE (copy this structure, change the words and numbers):
{
  "slides": [
    {
      "id": "s1",
      "name": "Title",
      "layout": "title",
      "transition": "fade",
      "background": { "type": "gradient", "gradientFrom": "#0b0d12", "gradientTo": "#1a1408", "gradientAngle": 148, "particles": true },
      "notes": "Open with the stake. Point at the three numbers. Then click Start.",
      "elements": [
        { "id": "k", "type": "text", "x": 6, "y": 12, "w": 50, "h": 5, "z": 2, "opacity": 1, "props": { "text": "SERIES A  ·  2026" }, "style": { "color": "#f5a623", "fontSize": 13, "letterSpacing": 1.6, "fontWeight": 600 } },
        { "id": "h", "type": "heading", "x": 6, "y": 20, "w": 54, "h": 26, "z": 2, "opacity": 1, "props": { "text": "Power what\\nthe grid can't.", "level": 1 } },
        { "id": "t", "type": "text", "x": 6, "y": 50, "w": 50, "h": 12, "z": 2, "opacity": 1, "props": { "text": "Independent solar for sites that cannot wait on the utility." } },
        { "id": "b", "type": "button", "x": 6, "y": 78, "w": 22, "h": 9, "z": 2, "opacity": 1, "props": { "label": "Start the story", "action": "next-slide", "variant": "primary" } },
        { "id": "a", "type": "stat", "x": 64, "y": 22, "w": 30, "h": 22, "z": 2, "opacity": 1, "props": { "value": "42", "suffix": "MW", "label": "operating today", "countUp": true, "icon": "sun" } },
        { "id": "c", "type": "stat", "x": 64, "y": 47, "w": 30, "h": 22, "z": 2, "opacity": 1, "props": { "value": "3.1", "prefix": "$", "suffix": "M", "label": "ARR", "countUp": true, "icon": "dollar-sign", "trend": { "direction": "up", "value": "64%" } } },
        { "id": "d", "type": "stat", "x": 64, "y": 72, "w": 30, "h": 20, "z": 2, "opacity": 1, "props": { "value": "18", "suffix": " mo", "label": "payback", "countUp": true, "icon": "target" } }
      ]
    }
  ]
}
`;

export const DESIGN_RULES = `
RULES — this deck is judged like a designed keynote, not a slideshow template:
- One layout per slide. Copy its coordinates exactly. 4-8 elements. Never pile widgets on top of each other, never leave a layout slot empty and blank.
- Every content slide has exactly one hero interactive (chart, stats row, flipcards, tabs, quiz, flow, cards, timeline, comparison, map). Do not duplicate the same widget type on consecutive slides — vary the deck's rhythm.
- Title slide = layout "title". Last slide = layout "close".
- Real, specific copy from the user's request or sources. No lorem ipsum, no generic "Overview"/"Agenda"/"Thank You" filler, no placeholder brackets. Every number must trace back to the request or source material.
- Headlines are editorial and confident — a real claim, not a topic label (e.g. "Solar undercuts diesel by 40%" beats "Cost Comparison"). Two lines allowed with \\n, keep each line under ~34 characters so it never wraps awkwardly. Kickers are short (<40 chars) UPPERCASE eyebrow labels, never a restatement of the heading.
- Numbers in charts/stats must be internally consistent with each other and with the source. If the user gave no numbers, use clearly labelled illustrative figures and say so in notes — never invent false precision.
- TYPOGRAPHY & HIERARCHY: exactly one dominant focal point per slide (the heading or the hero number). Body copy stays short — bullets under 12 words, stat labels under 4 words. Prefer a few large, confident elements over many small crowded ones.
- COLOR: dark theme unless the topic clearly calls for light. Pick ONE accent color for the whole deck and use it sparingly — for the kicker, the hero number, one highlighted state — never as a background flood. Background/surface colors should sit close in tone (a restrained gradient of 1-2 steps), not clash.
- SPACING: respect the whitespace already built into each layout's coordinates — do not shrink boxes to cram in extra copy. Trim the copy instead.
- Charts: 4 series maximum, legible labels, only show a legend when there is more than one series.
- notes on every slide (2 sentences: what the presenter says + what to physically point at).
`;

/**
 * How closely generation should hew to source material the user supplied
 * (an uploaded deck, doc, or their own HTML) versus reimagining it.
 * - "creative"  — default. Restructure freely for the best possible deck.
 * - "faithful"  — the user uploaded their own presentation and wants it kept
 *                 close to the original: same slide order, wording, and
 *                 emphasis, just cleaned up and made interactive.
 */
export type GenerationMode = "creative" | "faithful";

function modeInstructions(mode: GenerationMode): string {
  if (mode === "faithful") {
    return `
IMPORT MODE — FAITHFUL: the user attached their own presentation/document and wants it preserved, not reimagined.
- Keep the same slide count, order, and wording as the source as closely as the layouts allow. Do not invent new arguments, sections, or numbers that are not in the source.
- Light editorial cleanup is fine (tightening a sentence, fixing a heading), but do not change what a slide says or its position in the deck.
- If the source content is itself HTML you were given verbatim and the user asked to keep it exactly as-is, use an "embed" element holding that HTML unchanged instead of decomposing it into structured elements.
- Still apply the visual RULES below (layouts, spacing, one accent color) — "faithful" means faithful to the content, not to how it looked in PowerPoint.`;
  }
  return `
IMPORT MODE — INTERACTIVE (default): if source material was supplied, treat it as raw material, not a script. Restructure it into the strongest possible interactive deck — pick the best hero widget per slide, cut filler, sharpen claims. Maximize genuine interactivity (charts, flip cards, tabs, quizzes, timelines) wherever the content supports it.`;
}

export function planSystemPrompt(
  minSlides: number,
  maxSlides: number,
  mode: GenerationMode = "creative"
): string {
  return `You plan interactive presentations as JSON only. You are a presentation designer with taste, not a template filler — think keynote deck, not corporate slideshow.

Respond with ONLY:
{
  "title": string,
  "description": string,
  "audience": string,
  "theme": { "name": string, "mode": "dark"|"light", "colors": { "background": "#0b0d12", "surface": "#161a22", "text": "#f4f5f7", "muted": "#9aa3b2", "accent": "#f5a623", "accentText": "#101114" }, "radius": 16 },
  "slides": [ { "name": string, "goal": string, "suggestedComponents": [string] } ]
}

Plan ${minSlides}-${maxSlides} slides. Arc: title → numbers or stake → mechanism or evidence → argument → close. Every slide's "goal" is a specific claim it must prove, not a topic.
suggestedComponents is the hero widget for that slide (stat, chart, flow, cards, flipcards, tabs, quiz, timeline, comparison, map) — vary these across the deck so no two adjacent slides use the same widget.

THEME: pick colors that feel like a single considered palette, not defaults. background and surface should be close, muted tones (near-black/near-white with a whisper of hue, not pure #000/#fff); text/muted must have strong contrast against background; accent is one deliberate, saturated color that suits the subject (e.g. warm amber for energy/solar, deep teal for climate/water, violet for tech/AI, forest green for sustainability) — never leave it at a generic default unless the request is generic. accentText must be readable on top of accent.
Slide names are editorial claims, not "Introduction" or "Agenda".
${modeInstructions(mode)}
${DESIGN_RULES}`;
}

export function slidesSystemPrompt(mode: GenerationMode = "creative"): string {
  return `You design slides as JSON only. Never raw HTML except through the "embed" element type described below, and only when the rules for it apply.

${ELEMENT_REFERENCE}
${modeInstructions(mode)}
${DESIGN_RULES}
${FEW_SHOT}

Respond with ONLY: { "slides": [Slide, ...] } — exactly the slides asked for, in order, each with a "layout" field.`;
}

export function editSystemPrompt(): string {
  return `You edit a structured presentation by returning operations. Never HTML, never the full document.

${ELEMENT_REFERENCE}
${DESIGN_RULES}

Respond with ONLY:
{
  "summary": string,
  "operations": [
    { "op": "replaceSlide", "slideId": string, "slide": Slide } |
    { "op": "addSlide", "index": int, "slide": Slide } |
    { "op": "deleteSlide", "slideId": string } |
    { "op": "updateElement", "slideId": string, "elementId": string, "element": Element } |
    { "op": "addElement", "slideId": string, "element": Element } |
    { "op": "deleteElement", "slideId": string, "elementId": string } |
    { "op": "updateTheme", "theme": object } |
    { "op": "setTitle", "title": string }
  ]
}

Prefer the smallest change. Keep ids when updating. If asked to make a slide better, switch it to one of the five layouts and fill real content — do not add overlapping elements.`;
}
