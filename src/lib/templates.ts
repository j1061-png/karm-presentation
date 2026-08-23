import type { Presentation, Slide, SlideBackground, SlideElement } from "./schema";

/**
 * Original interactive templates. Each deck is designed as a finished
 * example — gradient canvases, jump buttons, and live widgets on every slide.
 */

type TemplateDoc = Omit<Presentation, "id" | "createdAt" | "updatedAt" | "kind" | "entry"> &
  Partial<Pick<Presentation, "kind" | "entry">>;

export interface Template {
  key: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  doc: TemplateDoc;
}

type Theme = Presentation["theme"];

const dark = (
  accent: string,
  name: string,
  extras?: Partial<Theme["colors"]>
): Theme => ({
  name,
  mode: "dark",
  colors: {
    background: "#0b0d12",
    surface: "#161a22",
    text: "#f4f5f7",
    muted: "#9aa3b2",
    accent,
    accentText: "#101114",
    ...extras,
  },
  headingFont: "inherit",
  bodyFont: "inherit",
  radius: 16,
});

const light = (
  accent: string,
  name: string,
  extras?: Partial<Theme["colors"]>
): Theme => ({
  name,
  mode: "light",
  colors: {
    background: "#f4f1ea",
    surface: "#ffffff",
    text: "#14161a",
    muted: "#5c6370",
    accent,
    accentText: "#ffffff",
    ...extras,
  },
  headingFont: "inherit",
  bodyFont: "inherit",
  radius: 16,
});

const b = { opacity: 1 as const, rotation: 0, z: 1 };
const anim = (delay: number, type: "fade-up" | "zoom" | "slide-left" | "slide-right" = "fade-up") =>
  ({ type, delay, duration: 0.55 });

function bg(from: string, to: string, angle = 148, particles = false): SlideBackground {
  return {
    type: "gradient",
    gradientFrom: from,
    gradientTo: to,
    gradientAngle: angle,
    overlayOpacity: 0.5,
    particles,
  };
}

function slide(
  id: string,
  name: string,
  elements: SlideElement[],
  background?: SlideBackground,
  transition: Slide["transition"] = "fade"
): Slide {
  return { id, name, transition, background, elements };
}

function blob(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opacity = 0.2
): SlideElement {
  return {
    id,
    type: "shape",
    x,
    y,
    w,
    h,
    z: 0,
    opacity,
    rotation: 0,
    props: { shape: "circle", fill },
  };
}

function bar(id: string, x: number, y: number, w = 8, fill = "#f5a623"): SlideElement {
  return {
    id,
    type: "shape",
    x,
    y,
    w,
    h: 0.7,
    ...b,
    z: 2,
    props: { shape: "line", fill },
  };
}

export const TEMPLATES: Template[] = [
  {
    key: "pitch",
    name: "Company pitch",
    category: "Business",
    tags: ["Quiz", "Charts", "Flip cards"],
    description: "Investor story you can click through — problem, wedge, traction, ask.",
    doc: {
      title: "Company pitch",
      description: "Interactive investor pitch",
      theme: dark("#f5a623", "Studio Dark"),
      version: 1,
      slides: [
        slide(
          "p1",
          "Title",
          [
            blob("p1g1", 62, -28, 52, 88, "#f5a623", 0.16),
            blob("p1g2", -16, 62, 40, 56, "#f5a623", 0.1),
            { id: "p1k", type: "text", x: 6, y: 14, w: 40, h: 5, ...b, props: { text: "SERIES A  ·  2026" }, style: { color: "#f5a623", fontSize: 14, letterSpacing: 2, fontWeight: 600 }, animation: anim(0) },
            bar("p1bar", 6, 21, 7, "#f5a623"),
            { id: "p1b", type: "heading", x: 6, y: 24, w: 54, h: 28, ...b, props: { text: "Power what\nthe grid can't.", level: 1 }, style: { fontSize: 58, fontWeight: 700, letterSpacing: -1.2 }, animation: anim(0.08) },
            { id: "p1c", type: "text", x: 6, y: 54, w: 48, h: 12, ...b, props: { text: "Independent solar for businesses that can't wait on the utility. Six slides. Every number is live." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.18) },
            { id: "p1d", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "Start the story", action: "next-slide", variant: "primary" }, animation: anim(0.28) },
            { id: "p1e", type: "button", x: 30, y: 78, w: 18, h: 9, ...b, props: { label: "Skip to ask", action: "goto-slide", targetSlide: 5, variant: "ghost" }, animation: anim(0.34) },
            { id: "p1s1", type: "stat", x: 64, y: 22, w: 30, h: 22, ...b, props: { value: "42", suffix: "MW", label: "operating today", countUp: true, icon: "sun" }, animation: anim(0.2, "zoom") },
            { id: "p1s2", type: "stat", x: 64, y: 47, w: 30, h: 22, ...b, props: { value: "3.1", prefix: "$", suffix: "M", label: "ARR, last twelve months", countUp: true, icon: "dollar-sign", trend: { direction: "up", value: "64%" } }, animation: anim(0.3, "zoom") },
            { id: "p1s3", type: "stat", x: 64, y: 72, w: 30, h: 20, ...b, props: { value: "18", suffix: " mo", label: "payback for buyers", countUp: true, icon: "target" }, animation: anim(0.4, "zoom") },
          ],
          bg("#0b0d12", "#1a1408", 148, true)
        ),
        slide(
          "p2",
          "The problem",
          [
            { id: "p2k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "01  —  THE PROBLEM" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "p2a", type: "heading", x: 6, y: 10, w: 80, h: 10, ...b, props: { text: "The grid is the bottleneck", level: 2 } },
            { id: "p2b", type: "stat", x: 6, y: 24, w: 28, h: 28, ...b, props: { value: "68", suffix: "%", label: "of sites wait 18+ months", countUp: true, icon: "target", trend: { direction: "up", value: "12%" } }, animation: anim(0, "zoom") },
            { id: "p2c", type: "stat", x: 36, y: 24, w: 28, h: 28, ...b, props: { value: "4.2", prefix: "$", suffix: "B", label: "lost to diesel each year", countUp: true, icon: "dollar-sign" }, animation: anim(0.12, "zoom") },
            { id: "p2d", type: "stat", x: 66, y: 24, w: 28, h: 28, ...b, props: { value: "3", suffix: "×", label: "slower than they need", countUp: true, icon: "trending-up" }, animation: anim(0.24, "zoom") },
            { id: "p2e", type: "accordion", x: 6, y: 56, w: 88, h: 22, ...b, props: { items: [
              { title: "What the customer feels every day", content: "A plant manager in 10th of Ramadan is running diesel at 3am because the feeder tripped. That is the product." },
              { title: "Why incumbents fail", content: "Utilities sell connection queues. EPCs sell capex. Nobody sells uptime as a service." },
              { title: "Why this year", content: "Diesel is volatile, industrial load is growing, and C&I buyers will sign 15-year offtake if you remove the wait." },
            ] }, animation: anim(0.32) },
            { id: "p2f", type: "callout", x: 6, y: 80, w: 88, h: 16, ...b, props: { kicker: "Where this is weak", title: "", body: "These figures are directional until you drop in your own market study. Treat them as a floor, not a ceiling.", variant: "weak", startOpen: false }, animation: anim(0.4) },
          ],
          bg("#0b0d12", "#141820")
        ),
        slide(
          "p3",
          "Solution",
          [
            { id: "p3k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "02  —  THE WEDGE" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "p3a", type: "heading", x: 6, y: 10, w: 80, h: 9, ...b, props: { text: "Flip a card. That's the product.", level: 2 } },
            { id: "p3b", type: "flipcards", x: 6, y: 22, w: 88, h: 34, ...b, props: { cards: [
              { front: "Product", back: "We own and operate the solar. The buyer pays for kWh, not steel. Live in months, not years.", icon: "zap" },
              { front: "Wedge", back: "Off-grid and weak-grid industrials first — the ones already burning diesel tonight.", icon: "target" },
              { front: "Moat", back: "Site data + offtake contracts + a construction crew that has already built 40MW in-country.", icon: "shield" },
            ] }, animation: anim(0.1) },
            { id: "p3c", type: "flow", x: 6, y: 60, w: 88, h: 34, ...b, props: { steps: [
              { label: "Diesel today", detail: "The site already burns fuel every night. That is the budget you are replacing." },
              { label: "We build & own", detail: "No capex on their books. We carry construction, operations, and the interconnection fight." },
              { label: "They buy kWh", detail: "A 15-year offtake. We get paid when they get power — not when a slide says we shipped." },
            ] }, animation: anim(0.22) },
          ],
          bg("#0b0d12", "#12161c")
        ),
        slide(
          "p4",
          "Traction",
          [
            { id: "p4k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "03  —  TRACTION" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "p4a", type: "heading", x: 6, y: 10, w: 50, h: 8, ...b, props: { text: "The curve is the pitch", level: 2 } },
            { id: "p4b", type: "chart", x: 6, y: 20, w: 58, h: 52, ...b, props: { chartType: "area", title: "Revenue", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Revenue", data: [80, 140, 230, 360] }], stacked: false, showLegend: false, showGrid: true, valuePrefix: "$", valueSuffix: "k" }, animation: anim(0.1) },
            { id: "p4c", type: "progress", x: 68, y: 20, w: 26, h: 14, ...b, props: { label: "ARR target", value: 72, suffix: "%", showValue: true }, animation: anim(0.18) },
            { id: "p4d", type: "progress", x: 68, y: 38, w: 26, h: 14, ...b, props: { label: "NPS", value: 84, suffix: "", showValue: true }, animation: anim(0.26) },
            { id: "p4e", type: "progress", x: 68, y: 56, w: 26, h: 14, ...b, props: { label: "Gross margin", value: 61, suffix: "%", showValue: true }, animation: anim(0.34) },
            { id: "p4f", type: "tabs", x: 6, y: 76, w: 88, h: 20, ...b, props: { tabs: [
              { label: "Customers", title: "Who signed", content: "Three lighthouse industrials. Name them. Say why they switched from diesel." },
              { label: "Pipeline", title: "What's next", content: "$4.8M qualified. Two sites in legal. Close dates on the next slide." },
              { label: "Retention", title: "Who stays", content: "100% logo retention. Expansion is a second array, not a discount." },
            ] }, animation: anim(0.4) },
          ],
          bg("#0b0d12", "#141820")
        ),
        slide(
          "p5",
          "Roadmap",
          [
            { id: "p5k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "04  —  ROADMAP" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "p5a", type: "heading", x: 6, y: 10, w: 80, h: 9, ...b, props: { text: "Hover a milestone", level: 2 } },
            { id: "p5b", type: "timeline", x: 6, y: 24, w: 88, h: 48, ...b, props: { orientation: "horizontal", items: [
              { date: "Now", title: "Ship the core", description: "The product that proves the wedge on live sites." },
              { date: "Q3", title: "Second region", description: "A crew and a pipeline outside the first governorate." },
              { date: "Q4", title: "Repeatable sales", description: "A playbook a new AE can run in 30 days." },
              { date: "Next year", title: "Platform", description: "Storage, water, charge — same offtake motion." },
            ] }, animation: anim(0.1) },
            { id: "p5c", type: "button", x: 6, y: 82, w: 22, h: 9, ...b, props: { label: "The ask →", action: "next-slide", variant: "primary" } },
          ],
          bg("#0b0d12", "#12161c")
        ),
        slide(
          "p6",
          "The ask",
          [
            blob("p6g", 70, -20, 44, 70, "#f5a623", 0.14),
            { id: "p6k", type: "text", x: 6, y: 6, w: 30, h: 4, ...b, props: { text: "05  —  THE ASK" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "p6a", type: "heading", x: 6, y: 12, w: 80, h: 10, ...b, props: { text: "What we need from you", level: 2 } },
            { id: "p6b", type: "stat", x: 6, y: 26, w: 40, h: 30, ...b, props: { value: "4", prefix: "$", suffix: "M", label: "Seed round  ·  18-month runway", countUp: true, icon: "dollar-sign" }, animation: anim(0, "zoom") },
            { id: "p6c", type: "list", x: 50, y: 26, w: 44, h: 30, ...b, props: { items: ["Hire the founding sales pod", "Prove unit economics in one market", "Close two expansion sites"], ordered: false, marker: "check" }, animation: anim(0.12) },
            { id: "p6d", type: "quiz", x: 6, y: 60, w: 88, h: 34, ...b, props: { question: "What should an investor remember when they leave?", options: ["A vague vision and a long feature list", "A clear wedge, live proof, and a precise ask", "A market size slide with no buyer"], correctIndex: 1, explanation: "Wedge + proof + ask. Everything else is decoration." }, animation: anim(0.22) },
          ],
          bg("#0b0d12", "#1a1408", 148, true)
        ),
      ],
    },
  },
  {
    key: "quarterly",
    name: "Quarterly review",
    category: "Business",
    tags: ["Charts", "Tabs", "Timeline"],
    description: "A QBR the room can drive — KPIs count up, tabs hold the story.",
    doc: {
      title: "Q3 2026 Review",
      description: "Internal QBR",
      theme: dark("#f5a623", "Studio Dark"),
      version: 1,
      slides: [
        slide(
          "q1",
          "Title",
          [
            blob("q1g", -18, -30, 50, 80, "#f5a623", 0.12),
            { id: "q1k", type: "text", x: 6, y: 16, w: 40, h: 5, ...b, props: { text: "INTERNAL  ·  Q3 2026" }, style: { color: "#f5a623", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "q1a", type: "heading", x: 6, y: 24, w: 70, h: 18, ...b, props: { text: "The quarter, live.", level: 1 }, style: { fontSize: 58, fontWeight: 700 }, animation: anim(0) },
            { id: "q1b", type: "text", x: 6, y: 46, w: 50, h: 10, ...b, props: { text: "Click a metric. Open a tab. Leave with a plan — not a PDF." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "q1c", type: "button", x: 6, y: 78, w: 20, h: 9, ...b, props: { label: "Open KPIs", action: "next-slide", variant: "primary" } },
            { id: "q1s1", type: "stat", x: 64, y: 22, w: 30, h: 22, ...b, props: { value: "12.4", prefix: "$", suffix: "M", label: "Revenue", countUp: true, icon: "dollar-sign", trend: { direction: "up", value: "18%" } }, animation: anim(0.16, "zoom") },
            { id: "q1s2", type: "stat", x: 64, y: 48, w: 30, h: 22, ...b, props: { value: "38", suffix: "MW", label: "Capacity delivered", countUp: true, icon: "zap", trend: { direction: "up", value: "9%" } }, animation: anim(0.26, "zoom") },
            { id: "q1s3", type: "stat", x: 64, y: 74, w: 30, h: 18, ...b, props: { value: "97", suffix: "%", label: "Uptime", countUp: true, icon: "award" }, animation: anim(0.36, "zoom") },
          ],
          bg("#0b0d12", "#1a1408", 148, true)
        ),
        slide(
          "q2",
          "KPIs",
          [
            { id: "q2k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "PERFORMANCE" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "q2a", type: "heading", x: 6, y: 10, w: 70, h: 8, ...b, props: { text: "Six months on one chart", level: 2 } },
            { id: "q2b", type: "stat", x: 6, y: 22, w: 28, h: 24, ...b, props: { value: "12.4", prefix: "$", suffix: "M", label: "Revenue", trend: { direction: "up", value: "18%" }, countUp: true, icon: "dollar-sign" }, animation: anim(0, "zoom") },
            { id: "q2c", type: "stat", x: 36, y: 22, w: 28, h: 24, ...b, props: { value: "38", suffix: "MW", label: "Capacity delivered", trend: { direction: "up", value: "9%" }, countUp: true, icon: "zap" }, animation: anim(0.1, "zoom") },
            { id: "q2d", type: "stat", x: 66, y: 22, w: 28, h: 24, ...b, props: { value: "97", suffix: "%", label: "Uptime", trend: { direction: "flat", value: "0%" }, countUp: true, icon: "award" }, animation: anim(0.2, "zoom") },
            { id: "q2e", type: "chart", x: 6, y: 50, w: 88, h: 44, ...b, props: { chartType: "bar", labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"], series: [{ name: "Revenue", data: [1.6, 1.8, 2.0, 2.1, 2.3, 2.6] }], stacked: false, showLegend: false, showGrid: true, valuePrefix: "$", valueSuffix: "M" }, animation: anim(0.28) },
          ],
          bg("#0b0d12", "#141820")
        ),
        slide(
          "q3",
          "Deep dive",
          [
            { id: "q3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "CLICK A TAB" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "q3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Where the quarter actually went", level: 2 } },
            { id: "q3b", type: "tabs", x: 6, y: 22, w: 88, h: 70, ...b, props: { tabs: [
              { label: "Wins", title: "What moved the number", content: "Closed Beni Suef 8MW. Renewed the two largest offtakers. Cut diesel runtime 22% on the Farafra microgrid." },
              { label: "Misses", title: "What slipped", content: "Delta interconnection slipped six weeks. One AE ramp missed quota. Fix is already staffed." },
              { label: "Risks", title: "What can break Q4", content: "FX on imported inverters. One key permit. Mitigation: dual-source and a weekly legal stand-up." },
              { label: "Asks", title: "Decisions this month", content: "Approve two extra field techs. Unlock the Q4 marketing hold. Sign the storage pilot." },
            ] }, animation: anim(0.1) },
          ],
          bg("#0b0d12", "#12161c")
        ),
        slide(
          "q4",
          "Plan",
          [
            { id: "q4k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "Q4 PLAN" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "q4a", type: "heading", x: 6, y: 10, w: 70, h: 8, ...b, props: { text: "Hover the months", level: 2 } },
            { id: "q4b", type: "timeline", x: 6, y: 22, w: 54, h: 68, ...b, props: { orientation: "vertical", items: [
              { date: "October", title: "Close the gap", description: "Recover the two slipped deals. Weekly pipeline review." },
              { date: "November", title: "Lock Q1", description: "Qualify early. No sandbagging into January." },
              { date: "December", title: "Plan 2027", description: "Budget, hiring, and the storage bet — locked." },
            ] }, animation: anim(0.1) },
            { id: "q4c", type: "progress", x: 64, y: 24, w: 30, h: 16, ...b, props: { label: "Annual target", value: 74, suffix: "%", showValue: true }, animation: anim(0.18) },
            { id: "q4d", type: "progress", x: 64, y: 44, w: 30, h: 16, ...b, props: { label: "Hiring plan", value: 50, suffix: "%", showValue: true }, animation: anim(0.26) },
            { id: "q4e", type: "progress", x: 64, y: 64, w: 30, h: 16, ...b, props: { label: "NPS recovery", value: 40, suffix: "%", showValue: true }, animation: anim(0.34) },
          ],
          bg("#0b0d12", "#141820")
        ),
      ],
    },
  },
  {
    key: "project",
    name: "Project kickoff",
    category: "Work",
    tags: ["Flip cards", "Timeline", "Tabs"],
    description: "Goals, scope, and owners — flip a card, hover the weeks.",
    doc: {
      title: "Project kickoff",
      description: "Kickoff deck",
      theme: dark("#4f9cf9", "Studio Blue", { accentText: "#071018" }),
      version: 1,
      slides: [
        slide(
          "k1",
          "Title",
          [
            blob("k1g", 68, -24, 48, 80, "#4f9cf9", 0.18),
            { id: "k1k", type: "text", x: 6, y: 16, w: 40, h: 5, ...b, props: { text: "KICKOFF  ·  9 WEEKS" }, style: { color: "#4f9cf9", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "k1a", type: "heading", x: 6, y: 24, w: 58, h: 22, ...b, props: { text: "We're building\nit in the open.", level: 1 }, style: { fontSize: 52, fontWeight: 700 }, animation: anim(0) },
            { id: "k1b", type: "text", x: 6, y: 50, w: 50, h: 12, ...b, props: { text: "What we're shipping, who owns it, and the date it has to be real." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "k1c", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "See success", action: "next-slide", variant: "primary" } },
            { id: "k1s", type: "stat", x: 64, y: 28, w: 30, h: 28, ...b, props: { value: "90", suffix: " days", label: "to the first measurable outcome", countUp: true, icon: "calendar" }, animation: anim(0.2, "zoom") },
            { id: "k1s2", type: "stat", x: 64, y: 60, w: 30, h: 26, ...b, props: { value: "1", label: "number the sponsor will check", countUp: true, icon: "target" }, animation: anim(0.3, "zoom") },
          ],
          bg("#0a1018", "#0d1828", 148, true)
        ),
        slide(
          "k2",
          "Goals",
          [
            { id: "k2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "FLIP TO OPEN" }, style: { color: "#4f9cf9", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "k2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Success looks like this", level: 2 } },
            { id: "k2b", type: "flipcards", x: 6, y: 22, w: 88, h: 38, ...b, props: { cards: [
              { front: "Outcome", back: "One number in 90 days. If the sponsor can't recite it, we don't have a goal.", icon: "target" },
              { front: "User", back: "Who feels the change first — and what they stop doing on day one.", icon: "users" },
              { front: "Constraint", back: "Time, budget, or compliance we will not break. Write it so we can refuse scope.", icon: "shield" },
            ] }, animation: anim(0.1) },
            { id: "k2c", type: "list", x: 6, y: 64, w: 88, h: 28, ...b, props: { items: ["Primary goal with a number and an owner", "Secondary goal we still care about", "What we will explicitly not do this cycle"], ordered: true, marker: "number" }, animation: anim(0.22) },
          ],
          bg("#0a1018", "#101820")
        ),
        slide(
          "k3",
          "Timeline",
          [
            { id: "k3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "HOVER A WEEK" }, style: { color: "#4f9cf9", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "k3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "The only dates that matter", level: 2 } },
            { id: "k3b", type: "timeline", x: 6, y: 24, w: 88, h: 68, ...b, props: { orientation: "horizontal", items: [
              { date: "Wk 1–2", title: "Discover", description: "Research, interviews, scope lock. No building yet." },
              { date: "Wk 3–6", title: "Build", description: "Core path only. Everything else is a later ticket." },
              { date: "Wk 7–8", title: "Prove", description: "QA, a real pilot, polish the path people actually take." },
              { date: "Wk 9", title: "Launch", description: "Ship. Measure the one number. Demo Friday." },
            ] }, animation: anim(0.1) },
          ],
          bg("#0a1018", "#0d1828")
        ),
        slide(
          "k4",
          "Team",
          [
            { id: "k4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "WHO DECIDES" }, style: { color: "#4f9cf9", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "k4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Click a role", level: 2 } },
            { id: "k4b", type: "tabs", x: 6, y: 22, w: 88, h: 70, ...b, props: { tabs: [
              { label: "Sponsor", title: "Decides", content: "Name, decision rights, weekly 20-minute checkpoint. Unblocks budget." },
              { label: "Lead", title: "Runs the work", content: "Day-to-day owner. Escalates a blocker within 24 hours — not at the next standup." },
              { label: "Build", title: "Makes it real", content: "Engineering, design, ops. List the actual people, not the function." },
              { label: "Comms", title: "Keeps the room aligned", content: "Weekly written status. Demo every other Friday. No surprise slides." },
            ] }, animation: anim(0.1) },
          ],
          bg("#0a1018", "#101820")
        ),
      ],
    },
  },
  {
    key: "overview",
    name: "Company overview",
    category: "Business",
    tags: ["Map", "Charts", "Flip cards"],
    description: "Who you are, where you operate, proof the room can explore.",
    doc: {
      title: "Company at a glance",
      description: "Who we are",
      theme: dark("#f5a623", "Studio Dark"),
      version: 1,
      slides: [
        slide(
          "o1",
          "Title",
          [
            blob("o1g", 60, -20, 55, 90, "#f5a623", 0.15),
            { id: "o1k", type: "text", x: 6, y: 16, w: 50, h: 5, ...b, props: { text: "COMPANY OVERVIEW" }, style: { color: "#f5a623", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "o1a", type: "heading", x: 6, y: 24, w: 58, h: 24, ...b, props: { text: "Independent power.\nOn our terms.", level: 1 }, style: { fontSize: 50, fontWeight: 700 }, animation: anim(0) },
            { id: "o1b", type: "text", x: 6, y: 52, w: 50, h: 12, ...b, props: { text: "We build, own, and operate solar for businesses and communities — then we stay." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "o1c", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "See the numbers", action: "next-slide", variant: "primary" } },
            { id: "o1s1", type: "stat", x: 64, y: 24, w: 30, h: 22, ...b, props: { value: "42", suffix: "MW", label: "Installed", countUp: true, icon: "sun" }, animation: anim(0.18, "zoom") },
            { id: "o1s2", type: "stat", x: 64, y: 50, w: 30, h: 22, ...b, props: { value: "45", suffix: "k t", label: "CO₂ offset / year", countUp: true, icon: "leaf" }, animation: anim(0.28, "zoom") },
            { id: "o1s3", type: "stat", x: 64, y: 76, w: 30, h: 16, ...b, props: { value: "2011", label: "Founded", countUp: false, icon: "calendar" }, animation: anim(0.36, "zoom") },
          ],
          bg("#0b0d12", "#1a1408", 148, true)
        ),
        slide(
          "o2",
          "Proof",
          [
            { id: "o2k", type: "text", x: 6, y: 5, w: 30, h: 4, ...b, props: { text: "BY THE NUMBERS" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "o2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Proof, not adjectives", level: 2 } },
            { id: "o2b", type: "stat", x: 6, y: 22, w: 28, h: 26, ...b, props: { value: "42", suffix: "MW", label: "Installed", countUp: true, icon: "sun" }, animation: anim(0, "zoom") },
            { id: "o2c", type: "stat", x: 36, y: 22, w: 28, h: 26, ...b, props: { value: "45", suffix: "k", label: "Tons CO₂ offset / year", countUp: true, icon: "leaf" }, animation: anim(0.1, "zoom") },
            { id: "o2d", type: "stat", x: 66, y: 22, w: 28, h: 26, ...b, props: { value: "17", suffix: "M L", label: "Diesel saved", countUp: true, icon: "zap" }, animation: anim(0.2, "zoom") },
            { id: "o2e", type: "chart", x: 6, y: 52, w: 88, h: 42, ...b, props: { chartType: "bar", labels: ["Generation", "Distribution", "Microgrids"], series: [{ name: "MW", data: [24, 12, 6] }], stacked: false, showLegend: false, showGrid: true, valueSuffix: " MW" }, animation: anim(0.28) },
          ],
          bg("#0b0d12", "#141820")
        ),
        slide(
          "o3",
          "Where",
          [
            { id: "o3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "PAN AND ZOOM" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "o3a", type: "heading", x: 6, y: 10, w: 50, h: 8, ...b, props: { text: "Where we work", level: 2 } },
            { id: "o3b", type: "map", x: 6, y: 22, w: 52, h: 70, ...b, props: { lat: 26.8, lng: 30.8, zoom: 5, label: "Egypt" }, animation: anim(0.1) },
            { id: "o3c", type: "timeline", x: 62, y: 22, w: 32, h: 70, ...b, props: { orientation: "vertical", items: [
              { date: "2011", title: "Founded", description: "The first office." },
              { date: "Sites", title: "Expansion", description: "Remote grids and urban distribution." },
              { date: "Today", title: "Ecosystem", description: "Energy, water, charge, build." },
            ] }, animation: anim(0.18) },
          ],
          bg("#0b0d12", "#12161c")
        ),
        slide(
          "o4",
          "Solutions",
          [
            { id: "o4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "FLIP A SOLUTION" }, style: { color: "#f5a623", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "o4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "What we actually sell", level: 2 } },
            { id: "o4b", type: "flipcards", x: 6, y: 22, w: 88, h: 70, ...b, props: { cards: [
              { front: "Generation", back: "Solar stations we own and operate. The client buys power — no upfront capex.", icon: "sun" },
              { front: "Distribution", back: "Private networks for urban developments and geography the utility will not reach.", icon: "globe" },
              { front: "Microgrids", back: "Solar + storage + diesel, cost-optimised for off-grid sites that cannot go dark.", icon: "battery" },
            ] }, animation: anim(0.1) },
          ],
          bg("#0b0d12", "#1a1408")
        ),
      ],
    },
  },
  {
    key: "education",
    name: "Lesson",
    category: "Education",
    tags: ["Quiz", "Flip cards", "Tabs"],
    description: "Teach it, flip it, then prove it — built for a live classroom.",
    doc: {
      title: "Today's lesson",
      description: "Interactive lesson",
      theme: light("#0f7a72", "Lesson", { accentText: "#ffffff" }),
      version: 1,
      slides: [
        slide(
          "e1",
          "Title",
          [
            blob("e1g", 64, -18, 50, 78, "#0f7a72", 0.12),
            { id: "e1k", type: "text", x: 6, y: 16, w: 40, h: 5, ...b, props: { text: "LESSON  ·  12 MINUTES" }, style: { color: "#0f7a72", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "e1a", type: "heading", x: 6, y: 24, w: 58, h: 22, ...b, props: { text: "Learn it.\nThen prove it.", level: 1 }, style: { fontSize: 54, fontWeight: 700 }, animation: anim(0) },
            { id: "e1b", type: "text", x: 6, y: 50, w: 50, h: 12, ...b, props: { text: "Tabs for the idea. Flip cards for memory. A quiz so the room can't hide." }, style: { color: "#5c6370", fontSize: 18 }, animation: anim(0.12) },
            { id: "e1c", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "Open objectives", action: "next-slide", variant: "primary" } },
            { id: "e1s", type: "stat", x: 64, y: 28, w: 30, h: 28, ...b, props: { value: "12", suffix: " min", label: "Guided time", countUp: true, icon: "calendar" }, animation: anim(0.2, "zoom") },
            { id: "e1s2", type: "stat", x: 64, y: 60, w: 30, h: 26, ...b, props: { value: "1", label: "quiz before you leave", countUp: true, icon: "award" }, animation: anim(0.3, "zoom") },
          ],
          bg("#f4f1ea", "#e4efe9", 148, true)
        ),
        slide(
          "e2",
          "Objectives",
          [
            { id: "e2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "BY THE END" }, style: { color: "#0f7a72", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "e2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "You will be able to", level: 2 } },
            { id: "e2b", type: "list", x: 6, y: 22, w: 52, h: 42, ...b, props: { items: ["Explain the core idea in your own words", "Apply it to a real example with numbers", "Spot the two common mistakes"], ordered: true, marker: "number" }, animation: anim(0.1) },
            { id: "e2c", type: "progress", x: 62, y: 24, w: 32, h: 14, ...b, props: { label: "Lesson", value: 20, suffix: "%", showValue: true } },
            { id: "e2d", type: "progress", x: 62, y: 42, w: 32, h: 14, ...b, props: { label: "Practice", value: 0, suffix: "%", showValue: true } },
            { id: "e2e", type: "stat", x: 62, y: 60, w: 32, h: 30, ...b, props: { value: "3", label: "things you must leave with", countUp: true, icon: "target" }, animation: anim(0.2, "zoom") },
          ],
          bg("#f4f1ea", "#efeae0")
        ),
        slide(
          "e3",
          "Concept",
          [
            { id: "e3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "CLICK A LENS" }, style: { color: "#0f7a72", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "e3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "The idea, four ways", level: 2 } },
            { id: "e3b", type: "tabs", x: 6, y: 22, w: 88, h: 70, ...b, props: { tabs: [
              { label: "Explain", title: "In one minute", content: "Write the concept as if you were teaching a sharp 16-year-old. No jargon without a translation." },
              { label: "Example", title: "See it", content: "A concrete example with numbers. What changed before vs after — one sentence each." },
              { label: "So what", title: "Why it matters", content: "The decision this idea unlocks in the real world. If there's no decision, cut the slide." },
              { label: "Watch-outs", title: "Common mistakes", content: "The two ways people usually get this wrong. Put the trap on the quiz." },
            ] }, animation: anim(0.1) },
          ],
          bg("#f4f1ea", "#e4efe9")
        ),
        slide(
          "e4",
          "Practice",
          [
            { id: "e4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "FLIP TO REMEMBER" }, style: { color: "#0f7a72", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "e4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Three terms. No peeking.", level: 2 } },
            { id: "e4b", type: "flipcards", x: 6, y: 22, w: 88, h: 70, ...b, props: { cards: [
              { front: "Term one", back: "Definition in plain language, plus a tiny example the room will actually remember.", icon: "sun" },
              { front: "Term two", back: "Definition — and the contrast with term one. That's how it sticks.", icon: "zap" },
              { front: "Term three", back: "When you would actually use this. If you can't say when, it isn't a term yet.", icon: "target" },
            ] }, animation: anim(0.1) },
          ],
          bg("#f4f1ea", "#efeae0")
        ),
        slide(
          "e5",
          "Check",
          [
            { id: "e5k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "NO PHONES. PICK ONE." }, style: { color: "#0f7a72", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "e5a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Check your understanding", level: 2 } },
            { id: "e5b", type: "quiz", x: 6, y: 22, w: 88, h: 70, ...b, props: { question: "Which statement is actually true?", options: ["The first plausible-sounding wrong answer", "The correct, precise answer", "A common misconception dressed as insight", "Something unrelated that sounds smart"], correctIndex: 1, explanation: "Replace this with the real explanation so the room learns — not just scores." }, animation: anim(0.1) },
          ],
          bg("#f4f1ea", "#e4efe9")
        ),
      ],
    },
  },
  {
    key: "training",
    name: "Safety training",
    category: "Training",
    tags: ["Quiz", "Flip cards", "Accordion"],
    description: "Rules, live scenarios, and a pass/fail check for the room.",
    doc: {
      title: "Site safety briefing",
      description: "Interactive safety briefing",
      theme: dark("#f0554d", "Safety", { accentText: "#fff" }),
      version: 1,
      slides: [
        slide(
          "s1",
          "Title",
          [
            blob("s1g", 66, -22, 50, 82, "#f0554d", 0.16),
            { id: "s1k", type: "text", x: 6, y: 16, w: 50, h: 5, ...b, props: { text: "REQUIRED  ·  BEFORE YOU ENTER" }, style: { color: "#f0554d", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "s1a", type: "heading", x: 6, y: 24, w: 58, h: 24, ...b, props: { text: "Nobody steps\non site cold.", level: 1 }, style: { fontSize: 50, fontWeight: 700 }, animation: anim(0) },
            { id: "s1b", type: "text", x: 6, y: 52, w: 50, h: 12, ...b, props: { text: "Open the rules. Flip the scenarios. Pass the check. Then you get a badge." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "s1c", type: "button", x: 6, y: 78, w: 24, h: 9, ...b, props: { label: "Read the rules", action: "next-slide", variant: "primary" } },
            { id: "s1s", type: "stat", x: 64, y: 28, w: 30, h: 28, ...b, props: { value: "4", label: "non-negotiables", countUp: true, icon: "shield" }, animation: anim(0.2, "zoom") },
            { id: "s1s2", type: "stat", x: 64, y: 60, w: 30, h: 26, ...b, props: { value: "100", suffix: "%", label: "must pass to enter", countUp: true, icon: "award" }, animation: anim(0.3, "zoom") },
          ],
          bg("#14090a", "#1c0e10", 148, true)
        ),
        slide(
          "s2",
          "Rules",
          [
            { id: "s2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "OPEN EACH RULE" }, style: { color: "#f0554d", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "s2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Non-negotiables", level: 2 } },
            { id: "s2b", type: "accordion", x: 6, y: 22, w: 88, h: 70, ...b, props: { items: [
              { title: "PPE is on before you enter", content: "Helmet, boots, vest, glasses. No exceptions for “just five minutes.” If you see someone without it, you stop them." },
              { title: "Lockout / tagout", content: "Never service live equipment. Confirm isolation with the site lead. If you didn't lock it, don't touch it." },
              { title: "Report near-misses the same day", content: "A near-miss is a free lesson. Log it before you leave the gate — not in the weekly report." },
              { title: "Anyone can stop the job", content: "You will never be penalised for stopping an unsafe act. If you walk past it, you own it." },
            ] }, animation: anim(0.1) },
          ],
          bg("#14090a", "#1a1012")
        ),
        slide(
          "s3",
          "Scenarios",
          [
            { id: "s3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "WHAT WOULD YOU DO?" }, style: { color: "#f0554d", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "s3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Flip the card. Say it out loud.", level: 2 } },
            { id: "s3b", type: "flipcards", x: 6, y: 22, w: 88, h: 70, ...b, props: { cards: [
              { front: "A colleague has no harness", back: "Stop the work. Speak up. Inform the supervisor. Do not look away and keep walking.", icon: "users" },
              { front: "A panel looks damaged after wind", back: "Do not approach. Cordon. Call the electrical lead. Photograph only from a safe distance.", icon: "zap" },
              { front: "You feel heat exhaustion", back: "Stop. Shade. Water. Tell someone. Heat is a safety incident — not toughness.", icon: "sun" },
            ] }, animation: anim(0.1) },
          ],
          bg("#14090a", "#1c0e10")
        ),
        slide(
          "s4",
          "Quiz",
          [
            { id: "s4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "PASS TO ENTER" }, style: { color: "#f0554d", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "s4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Who can stop unsafe work?", level: 2 } },
            { id: "s4b", type: "quiz", x: 6, y: 22, w: 88, h: 70, ...b, props: { question: "Who is allowed to stop unsafe work on this site?", options: ["Only the site manager", "Only HSE", "Anyone on site", "Only the client"], correctIndex: 2, explanation: "Anyone can stop the job. That is the rule. If you walk past it, you own it." }, animation: anim(0.1) },
          ],
          bg("#14090a", "#1a1012")
        ),
      ],
    },
  },
  {
    key: "marketing",
    name: "Campaign brief",
    category: "Marketing",
    tags: ["Charts", "Tabs", "Timeline"],
    description: "Audience, line, mix, and dates — click through the brief live.",
    doc: {
      title: "Campaign brief",
      description: "Marketing campaign",
      theme: dark("#e66df2", "Campaign", { accentText: "#1a0b1c" }),
      version: 1,
      slides: [
        slide(
          "m1",
          "Title",
          [
            blob("m1g", 62, -26, 52, 88, "#e66df2", 0.16),
            { id: "m1k", type: "text", x: 6, y: 16, w: 44, h: 5, ...b, props: { text: "CAMPAIGN  ·  30 DAYS" }, style: { color: "#e66df2", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "m1a", type: "heading", x: 6, y: 24, w: 56, h: 22, ...b, props: { text: "One line.\nOne action.", level: 1 }, style: { fontSize: 54, fontWeight: 700 }, animation: anim(0) },
            { id: "m1b", type: "text", x: 6, y: 50, w: 50, h: 12, ...b, props: { text: "Who it's for, what we say, where it runs. If they remember two things, we failed." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "m1c", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "Meet the audience", action: "next-slide", variant: "primary" } },
            { id: "m1s", type: "stat", x: 64, y: 28, w: 30, h: 28, ...b, props: { value: "1", label: "promise they can repeat", countUp: true, icon: "target" }, animation: anim(0.2, "zoom") },
            { id: "m1s2", type: "stat", x: 64, y: 60, w: 30, h: 26, ...b, props: { value: "30", suffix: " days", label: "from lock to readout", countUp: true, icon: "calendar" }, animation: anim(0.3, "zoom") },
          ],
          bg("#120814", "#1a0c1c", 148, true)
        ),
        slide(
          "m2",
          "Audience",
          [
            { id: "m2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "WHO WE TALK TO" }, style: { color: "#e66df2", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "m2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Win one person first", level: 2 } },
            { id: "m2b", type: "comparison", x: 6, y: 22, w: 88, h: 70, ...b, props: { items: [
              { title: "Primary", subtitle: "Must win this month", badge: "Must win", points: ["The job they are hiring us to do", "Where they already pay attention", "The objection we have to kill on sight"], highlighted: true },
              { title: "Secondary", subtitle: "Do not dilute the line", points: ["Nice-to-have reach, not the brief", "Partners and amplifiers", "If the line changes for them, cut them"], highlighted: false },
            ] }, animation: anim(0.1) },
          ],
          bg("#120814", "#160a18")
        ),
        slide(
          "m3",
          "Message",
          [
            { id: "m3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "THE LINE" }, style: { color: "#e66df2", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "m3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Click through the brief", level: 2 } },
            { id: "m3b", type: "tabs", x: 6, y: 22, w: 88, h: 70, ...b, props: { tabs: [
              { label: "Promise", title: "One sentence", content: "If they remember one line, it is this. No adjective we cannot prove in a screenshot." },
              { label: "Proof", title: "Why it's true", content: "A number, a customer, or a 12-second demo. Proof first. Poetry second." },
              { label: "CTA", title: "What they do next", content: "One action. Book, try, or share — not all three on the same creative." },
              { label: "Don'ts", title: "Off-limits", content: "Claims legal hasn't cleared. Tone that doesn't sound like us. Competitor-bashing." },
            ] }, animation: anim(0.1) },
          ],
          bg("#120814", "#1a0c1c")
        ),
        slide(
          "m4",
          "Plan",
          [
            { id: "m4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "WHERE IT RUNS" }, style: { color: "#e66df2", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "m4a", type: "heading", x: 6, y: 10, w: 70, h: 8, ...b, props: { text: "Mix, readiness, dates", level: 2 } },
            { id: "m4b", type: "chart", x: 6, y: 20, w: 54, h: 48, ...b, props: { chartType: "donut", labels: ["Paid", "Owned", "Partner", "Field"], series: [{ name: "Mix", data: [40, 25, 20, 15] }], stacked: false, showLegend: true, showGrid: false }, animation: anim(0.1) },
            { id: "m4c", type: "progress", x: 64, y: 22, w: 30, h: 14, ...b, props: { label: "Creative ready", value: 60, suffix: "%", showValue: true }, animation: anim(0.18) },
            { id: "m4d", type: "progress", x: 64, y: 40, w: 30, h: 14, ...b, props: { label: "Media booked", value: 35, suffix: "%", showValue: true }, animation: anim(0.26) },
            { id: "m4e", type: "progress", x: 64, y: 58, w: 30, h: 14, ...b, props: { label: "Landing page", value: 80, suffix: "%", showValue: true }, animation: anim(0.34) },
            { id: "m4f", type: "timeline", x: 6, y: 72, w: 88, h: 22, ...b, props: { orientation: "horizontal", items: [
              { date: "T-14", title: "Lock", description: "Creative freeze." },
              { date: "T-0", title: "Launch", description: "Go live." },
              { date: "T+14", title: "Optimise", description: "Kill losers." },
              { date: "T+30", title: "Readout", description: "What we learned." },
            ] }, animation: anim(0.4) },
          ],
          bg("#120814", "#160a18")
        ),
      ],
    },
  },
  {
    key: "report",
    name: "Research report",
    category: "Report",
    tags: ["Charts", "Table", "Quiz"],
    description: "Findings the audience can interrogate — charts, table, next bets.",
    doc: {
      title: "Research readout",
      description: "Findings readout",
      theme: light("#1d4ed8", "Report", { accentText: "#ffffff", background: "#eef2f7" }),
      version: 1,
      slides: [
        slide(
          "r1",
          "Title",
          [
            blob("r1g", 64, -20, 50, 80, "#1d4ed8", 0.1),
            { id: "r1k", type: "text", x: 6, y: 16, w: 44, h: 5, ...b, props: { text: "RESEARCH  ·  n = 260" }, style: { color: "#1d4ed8", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "r1a", type: "heading", x: 6, y: 24, w: 58, h: 22, ...b, props: { text: "What we learned.\nWhat we do.", level: 1 }, style: { fontSize: 50, fontWeight: 700 }, animation: anim(0) },
            { id: "r1b", type: "text", x: 6, y: 50, w: 50, h: 12, ...b, props: { text: "Three findings, the evidence, and a recommendation with an owner." }, style: { color: "#5c6370", fontSize: 18 }, animation: anim(0.12) },
            { id: "r1c", type: "button", x: 6, y: 78, w: 22, h: 9, ...b, props: { label: "Open findings", action: "next-slide", variant: "primary" } },
            { id: "r1s1", type: "stat", x: 64, y: 24, w: 30, h: 22, ...b, props: { value: "81", suffix: "%", label: "Finding one", countUp: true, icon: "users" }, animation: anim(0.18, "zoom") },
            { id: "r1s2", type: "stat", x: 64, y: 50, w: 30, h: 22, ...b, props: { value: "2.4", suffix: "×", label: "Finding two", countUp: true, icon: "trending-up" }, animation: anim(0.28, "zoom") },
            { id: "r1s3", type: "stat", x: 64, y: 76, w: 30, h: 16, ...b, props: { value: "14", suffix: " days", label: "Finding three", countUp: true, icon: "calendar" }, animation: anim(0.36, "zoom") },
          ],
          bg("#eef2f7", "#e4ebf5", 148, true)
        ),
        slide(
          "r2",
          "Findings",
          [
            { id: "r2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "THREE SIGNALS" }, style: { color: "#1d4ed8", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "r2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "The numbers, then the curve", level: 2 } },
            { id: "r2b", type: "stat", x: 6, y: 22, w: 28, h: 24, ...b, props: { value: "81", suffix: "%", label: "Would switch for proof", countUp: true, icon: "users" }, animation: anim(0, "zoom") },
            { id: "r2c", type: "stat", x: 36, y: 22, w: 28, h: 24, ...b, props: { value: "2.4", suffix: "×", label: "More likely to renew", countUp: true, icon: "trending-up" }, animation: anim(0.1, "zoom") },
            { id: "r2d", type: "stat", x: 66, y: 22, w: 28, h: 24, ...b, props: { value: "14", suffix: " days", label: "To first value", countUp: true, icon: "calendar" }, animation: anim(0.2, "zoom") },
            { id: "r2e", type: "chart", x: 6, y: 50, w: 88, h: 44, ...b, props: { chartType: "line", title: "Signal over time", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: [{ name: "Signal", data: [20, 28, 26, 40, 48, 61] }], stacked: false, showLegend: false, showGrid: true }, animation: anim(0.28) },
          ],
          bg("#eef2f7", "#e8edf4")
        ),
        slide(
          "r3",
          "Evidence",
          [
            { id: "r3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "THE TABLE" }, style: { color: "#1d4ed8", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "r3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Who said what", level: 2 } },
            { id: "r3b", type: "table", x: 6, y: 22, w: 88, h: 40, ...b, props: { columns: ["Segment", "n", "Result", "Confidence"], rows: [["Segment A", "120", "High", "95%"], ["Segment B", "86", "Medium", "90%"], ["Segment C", "54", "Low", "80%"]], highlightColumn: 2, compact: false }, animation: anim(0.1) },
            { id: "r3c", type: "accordion", x: 6, y: 66, w: 88, h: 28, ...b, props: { items: [
              { title: "Method", content: "260 respondents. Mix of interviews and a structured survey. We did not measure price sensitivity." },
              { title: "Limits", content: "Segment C is underpowered. Seasonality may inflate the June spike. Treat it as directional." },
            ] }, animation: anim(0.18) },
          ],
          bg("#eef2f7", "#e4ebf5")
        ),
        slide(
          "r4",
          "Recommend",
          [
            { id: "r4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "WHAT WE FUND" }, style: { color: "#1d4ed8", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "r4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Do now vs do next", level: 2 } },
            { id: "r4b", type: "comparison", x: 6, y: 22, w: 88, h: 70, ...b, props: { items: [
              { title: "Do now", badge: "This month", points: ["Action with a named owner", "A date on the calendar", "The metric that proves it worked"], highlighted: true },
              { title: "Do next", points: ["The follow-on bet if this lands", "What would change our mind", "What we will not fund this quarter"], highlighted: false },
            ] }, animation: anim(0.1) },
          ],
          bg("#eef2f7", "#e8edf4")
        ),
      ],
    },
  },
  {
    key: "workshop",
    name: "Workshop",
    category: "Work",
    tags: ["Timeline", "Flip cards", "Quiz"],
    description: "A working session — agenda, rules, and a decision check.",
    doc: {
      title: "Workshop",
      description: "Facilitated session",
      theme: dark("#43c98a", "Workshop", { accentText: "#062016" }),
      version: 1,
      slides: [
        slide(
          "w1",
          "Title",
          [
            blob("w1g", 64, -22, 50, 82, "#43c98a", 0.14),
            { id: "w1k", type: "text", x: 6, y: 16, w: 44, h: 5, ...b, props: { text: "WORKING SESSION  ·  90 MIN" }, style: { color: "#43c98a", fontSize: 14, letterSpacing: 2, fontWeight: 600 } },
            { id: "w1a", type: "heading", x: 6, y: 24, w: 58, h: 22, ...b, props: { text: "Leave with\na decision.", level: 1 }, style: { fontSize: 54, fontWeight: 700 }, animation: anim(0) },
            { id: "w1b", type: "text", x: 6, y: 50, w: 50, h: 12, ...b, props: { text: "Not a lecture. Hover the agenda. Flip the rules. End on one owner and one date." }, style: { color: "#9aa3b2", fontSize: 18 }, animation: anim(0.12) },
            { id: "w1c", type: "button", x: 6, y: 78, w: 20, h: 9, ...b, props: { label: "Open agenda", action: "next-slide", variant: "primary" } },
            { id: "w1s", type: "stat", x: 64, y: 28, w: 30, h: 28, ...b, props: { value: "90", suffix: " min", label: "on the clock", countUp: true, icon: "calendar" }, animation: anim(0.2, "zoom") },
            { id: "w1s2", type: "stat", x: 64, y: 60, w: 30, h: 26, ...b, props: { value: "1", label: "decision we owe the room", countUp: true, icon: "target" }, animation: anim(0.3, "zoom") },
          ],
          bg("#07140f", "#0c1c14", 148, true)
        ),
        slide(
          "w2",
          "Agenda",
          [
            { id: "w2k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "HOVER A BLOCK" }, style: { color: "#43c98a", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "w2a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "How the 90 minutes run", level: 2 } },
            { id: "w2b", type: "timeline", x: 6, y: 22, w: 88, h: 70, ...b, props: { orientation: "vertical", items: [
              { date: "0:00", title: "Frame", description: "Why we're here and the single decision we owe before we leave." },
              { date: "0:15", title: "Diverge", description: "Silent ideas first. Then cluster. No debate yet." },
              { date: "0:40", title: "Converge", description: "Vote. Debate only the top two. Time-box the argument." },
              { date: "1:10", title: "Commit", description: "Owner, date, first step. If those three aren't written, we failed." },
            ] }, animation: anim(0.1) },
          ],
          bg("#07140f", "#0a1812")
        ),
        slide(
          "w3",
          "Rules",
          [
            { id: "w3k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "FLIP A RULE" }, style: { color: "#43c98a", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "w3a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "How we'll work", level: 2 } },
            { id: "w3b", type: "flipcards", x: 6, y: 22, w: 88, h: 70, ...b, props: { cards: [
              { front: "One conversation", back: "No side chats. If it's important, say it to the room — or it didn't happen.", icon: "users" },
              { front: "Disagree, then commit", back: "Push hard in the room. Leave aligned. Parking-lot items get an owner too.", icon: "target" },
              { front: "Write it down", back: "If it isn't captured on this deck or the notes, it didn't happen.", icon: "award" },
            ] }, animation: anim(0.1) },
          ],
          bg("#07140f", "#0c1c14")
        ),
        slide(
          "w4",
          "Decide",
          [
            { id: "w4k", type: "text", x: 6, y: 5, w: 40, h: 4, ...b, props: { text: "ARE WE DONE?" }, style: { color: "#43c98a", fontSize: 13, letterSpacing: 1.6, fontWeight: 600 } },
            { id: "w4a", type: "heading", x: 6, y: 10, w: 80, h: 8, ...b, props: { text: "Decision check", level: 2 } },
            { id: "w4b", type: "quiz", x: 6, y: 22, w: 88, h: 70, ...b, props: { question: "Are we ready to leave this room?", options: ["We still have two live options and no owner", "We have one owner, one date, and one first step", "We'll circle back later"], correctIndex: 1, explanation: "A workshop that ends without an owner and a date was just a meeting." }, animation: anim(0.1) },
          ],
          bg("#07140f", "#0a1812")
        ),
      ],
    },
  },
];
