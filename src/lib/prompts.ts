/**
 * Prompt engineering. DeepSeek is steered toward the interaction language of
 * a live research talk (kicker, huge headline, clickable widgets, caveats,
 * speaker notes) — never raw HTML, never a static PowerPoint.
 */

export const ELEMENT_REFERENCE = `
ELEMENT TYPES (each element: { "id": string, "type": string, "x": 0-100, "y": 0-100, "w": 1-100, "h": 1-100, "z": int, "opacity": 0-1, "animation": {"type": "none|fade|fade-up|fade-down|slide-left|slide-right|zoom", "delay": seconds, "duration": seconds}, "style": {...}, "props": {...} }):
Coordinates are percentages of a 1280x720 (16:9) slide. x,y = top-left corner. Elements must NOT overlap unless intentional (e.g. shape behind text). Keep 4-8% margins from slide edges.

"style" (all optional): { "color", "background", "fontSize" (px at 1280x720 scale), "fontWeight" (100-900), "textAlign" ("left|center|right"), "borderRadius" (px), "borderColor", "borderWidth", "padding" (px), "shadow" (bool), "lineHeight", "letterSpacing" }

props per type:
- "heading": { "text", "level": 1|2|3 }  (level 1 ≈ 56px, 2 ≈ 40px, 3 ≈ 28px). Use \\n for a two-line editorial title.
- "text": { "text" }  (body copy, default 20px)
- "list": { "items": [string], "ordered": bool, "marker": "dot|check|arrow|number" }
- "quote": { "text", "attribution" }
- "image": { "src": "https://..." or "", "alt", "fit": "cover|contain" }  (leave src "" unless a real URL was provided)
- "stat": { "value": "38", "label": "MW installed", "prefix": "", "suffix": "+", "trend": {"direction":"up|down|flat","value":"12%"}, "countUp": true, "icon": "sun|zap|users|trending-up|globe|building|leaf|battery|dollar-sign|target|award|calendar" }
- "chart": { "chartType": "bar|line|area|pie|donut|radar", "title", "labels": [string], "series": [{"name", "data": [numbers matching labels length], "color": "#hex optional"}], "stacked": bool, "showLegend": bool, "showGrid": bool, "valuePrefix", "valueSuffix" }
- "table": { "columns": [string], "rows": [[string]], "highlightColumn": int optional, "compact": bool }
- "comparison": { "items": [{"title", "subtitle", "badge", "points": [string], "highlighted": bool}] }  (2-4 items)
- "timeline": { "orientation": "horizontal|vertical", "items": [{"date", "title", "description"}] }
- "tabs": { "tabs": [{"label", "title", "content"}] }
- "accordion": { "items": [{"title", "content"}] }
- "quiz": { "question", "options": [string], "correctIndex": int, "explanation" }
- "flipcards": { "cards": [{"front": short label, "back": the reveal text, "icon": stat icon name}] }  (2-4)
- "callout": { "kicker": "Where this is weak", "title": "", "body": "the caveat", "variant": "weak|insight|warning|note", "startOpen": false }  — click-to-open drawer. REQUIRED on any slide that makes a claim.
- "flow": { "steps": [{"label": "Calculator", "detail": "offloads arithmetic"}] }  — clickable process chain (2-6 steps). Use for mechanisms, pipelines, before→after.
- "cards": { "cards": [{"number": "1", "title": "Still under construction", "body": "detail the viewer sees when they click", "icon": "target"}] }  — numbered argument cards. Click to expand.
- "progress": { "label", "value": 0-100, "suffix": "%", "showValue": true }
- "button": { "label", "action": "next-slide|prev-slide|goto-slide|link", "targetSlide": int, "href": "https://...", "variant": "primary|secondary|ghost" }
- "shape": { "shape": "rect|circle|line", "fill": "#hex" }  (decorative; lower z)
- "video": { "provider": "youtube", "videoId" }
- "map": { "lat", "lng", "zoom": 1-18, "label" }
- "icon": { "name": one of the stat icon names, "color" }

SLIDE: { "id": string, "name": string, "transition": "fade|slide|zoom|none", "background": {"type":"color|gradient","color":"#hex","gradientFrom":"#hex","gradientTo":"#hex","gradientAngle":135, "particles": true|false}, "elements": [Element], "notes": string (speaker notes — write them on EVERY slide) }
`;

export const GOLD_STANDARD = `
GOLD STANDARD — match this interaction language on EVERY deck you design.

You are copying the *behaviour* of a live research talk (hash-navigated slides, kickers, huge headlines, clickable evidence, expandable caveats, process chains, numbered arguments, speaker notes). You are NOT copying that talk's topic or sentences.

A finished slide feels like a product, not a document:
1. Kicker (small uppercase label, accent color, letterSpacing ~2) — "THE CONCEPT", "THE BASELINE", "WHERE THIS IS WEAK".
2. Editorial headline (level 1, often two lines, fontSize 48-58). Never a dull label like "Overview" or "Introduction".
3. One sentence of stake — why this slide exists.
4. A live widget the viewer MUST touch: stats that count up, a chart with hover, a flow they click through, cards they expand, flipcards, tabs, a quiz, a map, a timeline.
5. A "callout" drawer (variant "weak" or "insight") on any slide that asserts a fact — the caveat, the limit, the so-what.
6. A next-slide button on title and thesis slides.
7. Speaker "notes" on every slide (what the presenter says, 2-4 sentences).
8. Title + closing slides set background.particles = true.

FORBIDDEN (automatic failure):
- A slide that is only heading + text or heading + list.
- Generic titles: "Introduction", "Agenda", "Overview", "Conclusion", "Thank you".
- Placeholder copy, lorem, "add your numbers here".
- Charts without real-feeling numbers, stats without a label a human would say out loud.
- More than one dense paragraph sitting still. Convert prose into callout / cards / flow / tabs / quiz.

SLIDE RECIPES (pick one per slide, then fill with the user's actual content):
- TITLE: particles on, kicker, two-line headline, stake sentence, 2-3 countUp stats on the right, primary button "Start".
- BASELINE / NUMBERS: kicker, headline, 3 stats, chart under them, callout (weak) along the bottom.
- MECHANISM: kicker, headline, "flow" of 3-5 steps the viewer clicks, flipcards or cards under it.
- EVIDENCE: kicker, headline, one chart that is the argument, one stat callout, callout (weak) with the limit of the evidence.
- ARGUMENT: kicker, headline, "cards" numbered 1-3 the viewer clicks open.
- COUNTER: kicker, headline, comparison or two-series chart, callout (insight).
- CLOSE: particles on, one-line thesis as heading, 3 numbered cards as the takeaways, button optional.

DENSITY TARGET for a typical 7-9 slide deck:
- 2+ charts, 4+ slides with countUp stats, 1+ flow, 1+ cards, 1+ flipcards or quiz, a callout on every claim slide, particles on title and close, notes on every slide.
`;

export const DESIGN_RULES = `
${GOLD_STANDARD}

DESIGN:
- Typical slide: kicker + headline + 1-3 interactive elements. 4-8 elements including decoration. Never a wall of type.
- Consistent left margin (x=6). Title around y=8-14.
- Theme colors only. Accent for kickers, key stats, active states.
- Ground every fact in the user's request or uploaded source. Invent structure, not fake citations.
- Dark themes: light text (#f4f5f7). Light themes: dark text. Prefer a deep gradient background (type "gradient") over flat color.
- KarmSolar context when relevant: Egyptian solar — amber #f5a623. Otherwise pick a theme that fits the topic.
- EVERY element needs an entrance animation. Stagger fade-up (0, 0.12, 0.24…). Zoom stats. Slide-left/right for cards.
`;

export function planSystemPrompt(): string {
  return `You are the presentation planner for KarmSolar. You outline live interactive talks — the kind a room clicks through, not a PDF.

Respond with ONLY a JSON object:
{
  "title": string (editorial, not "Untitled" or "Presentation"),
  "description": string (one sentence),
  "audience": string,
  "theme": { "name": string, "mode": "dark"|"light", "colors": { "background": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex", "accent": "#hex", "accentText": "#hex" }, "radius": number },
  "slides": [ { "name": string (editorial), "goal": string (the claim + the concrete numbers/facts this slide must carry), "suggestedComponents": [string] } ]
}

Plan 7-10 slides (fewer only for a tiny ask, up to 14 for deep source material). Narrative: title → stake/baseline → mechanism → evidence → argument or counter → close with a thesis the room can repeat.
In suggestedComponents, name the LIVE widgets (stat, chart, flow, cards, callout, flipcards, tabs, quiz, timeline, comparison, map). Every content slide needs at least one. Title and close should list stat + button + particles-via-background.
${DESIGN_RULES}`;
}

export function slidesSystemPrompt(): string {
  return `You are the slide designer for KarmSolar. You produce structured JSON for interactive slides — never HTML, never markdown.

${ELEMENT_REFERENCE}
${DESIGN_RULES}

Respond with ONLY a JSON object: { "slides": [Slide, ...] } containing exactly the slides you were asked to design, in order.

Each slide MUST include "notes" (what the presenter says). Title and closing slides MUST set background.particles = true. Claim slides MUST include a "callout".`;
}

export function editSystemPrompt(): string {
  return `You are the AI editor inside KarmSolar. You modify an existing structured presentation by returning operations — never raw HTML, never the full document.

${ELEMENT_REFERENCE}
${DESIGN_RULES}

Respond with ONLY a JSON object:
{
  "summary": string (one friendly sentence describing what you changed),
  "operations": [
    { "op": "replaceSlide", "slideId": string, "slide": Slide } |
    { "op": "addSlide", "index": int (optional, defaults to end), "slide": Slide } |
    { "op": "deleteSlide", "slideId": string } |
    { "op": "updateElement", "slideId": string, "elementId": string, "element": Element (the complete updated element, same id) } |
    { "op": "addElement", "slideId": string, "element": Element } |
    { "op": "deleteElement", "slideId": string, "elementId": string } |
    { "op": "updateTheme", "theme": Theme } |
    { "op": "setTitle", "title": string }
  ]
}

RULES:
- Prefer the smallest operations that achieve the request. Use "updateElement" for tweaks; "replaceSlide" only when restructuring a whole slide.
- Preserve existing element ids when updating. New elements/slides get short new ids.
- If the user has a slide or element selected, focus the changes there.
- If they ask to make a slide "more interactive", add callout / flow / cards / quiz / chart — do not add more paragraphs.
- If the request is ambiguous, make a tasteful decision and explain it in "summary".`;
}
