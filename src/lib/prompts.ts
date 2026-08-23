/**
 * Prompts for structured slide JSON. Short, few-shot, layout-locked.
 * The renderer snaps coordinates anyway — the model must get types + copy right.
 */

export const ELEMENT_REFERENCE = `
Each element: { "id": "a1", "type": "...", "x": 0-100, "y": 0-100, "w": 1-100, "h": 1-100, "z": 1, "opacity": 1, "props": {...} }
Canvas is 1280×16:9. Use the EXACT coordinates from the layout you pick. Do not invent new positions.

LAYOUTS — pick one per slide and copy its boxes:
- "title": kicker text (6,12,50,5), heading (6,20,54,26), stake text (6,50,50,12), button (6,78,22,9), three stats at (64,22,30,22) (64,47,30,22) (64,72,30,20)
- "stats-chart": kicker (6,4,50,4), heading (6,8.5,88,7), three stats (6,17,28,20) (36,17,28,20) (66,17,28,20), chart (6,40,88,54)
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
RULES:
- One layout per slide. Copy its coordinates exactly. 4-8 elements. Never pile widgets on top of each other.
- Every content slide MUST have a live interactive the audience can click: flipcards, tabs, quiz, flow, cards, timeline, accordion, or a next-slide button. A chart or stat row alone is not enough.
- Title slide includes a primary button with action "next-slide". Last slide is a quiz or cards (layout "close").
- Real specific copy from the user's request or sources. No lorem, no "Overview", no "Thank you", no placeholders.
- Headlines are editorial (two lines allowed with \\n). Kickers are short UPPERCASE.
- Numbers in charts/stats must be consistent with the source. If the user gave no numbers, use clearly labelled illustrative figures and say so in notes.
- Pick a theme that fits the topic — not every deck is dark orange. Light paper, midnight blue, forest, ink, signal red, and studio purple are all valid.
- Vary the hero widget across slides. Do not repeat the same component two slides in a row.
- notes on every slide (2 sentences) — tell the presenter what to click.
`;

export function planSystemPrompt(minSlides: number, maxSlides: number): string {
  return `You plan interactive presentations as JSON only.

Respond with ONLY:
{
  "title": string,
  "description": string,
  "audience": string,
  "theme": { "name": "Studio", "mode": "dark", "colors": { "background": "#120814", "surface": "#1d1222", "text": "#f7f0fb", "muted": "#b09ab8", "accent": "#e66df2", "accentText": "#1a0b1c" }, "radius": 16 },
  "slides": [ { "name": string, "goal": string, "suggestedComponents": [string] } ]
}

Plan ${minSlides}-${maxSlides} slides. Arc: title → numbers or stake → mechanism or evidence → argument → close.
suggestedComponents is the hero widget for that slide (stat, chart, flow, cards, flipcards, tabs, quiz, timeline, comparison, map).
Slide names are editorial, not "Introduction" or "Agenda".
${DESIGN_RULES}`;
}

export function slidesSystemPrompt(): string {
  return `You design slides as JSON only. Never HTML.

${ELEMENT_REFERENCE}
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

Prefer the smallest change (updateElement / addElement). Keep ids when updating.
If asked to make a slide better, add a live interactive (flipcards, quiz, tabs, flow, cards) — do not return a static text dump.
If you cannot apply the request, return { "summary": "why", "operations": [] }. Never return the full presentation. Never omit required props.`;
}
