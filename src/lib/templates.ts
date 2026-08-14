import type { Presentation, Slide, SlideElement } from "./schema";

/**
 * Original present@karm templates. Interactive by default — every content
 * slide uses charts, stats, timelines, tabs, quizzes, or flip cards.
 */

type TemplateDoc = Omit<Presentation, "id" | "createdAt" | "updatedAt">;

export interface Template {
  key: string;
  name: string;
  description: string;
  category: string;
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
    background: "#0c0d10",
    surface: "#16181d",
    text: "#f4f5f7",
    muted: "#9ba1ab",
    accent,
    accentText: "#101114",
    ...extras,
  },
  headingFont: "inherit",
  bodyFont: "inherit",
  radius: 12,
});

const b = { opacity: 1 as const, rotation: 0, z: 1 };
const anim = (delay: number, type: "fade-up" | "zoom" = "fade-up") =>
  ({ type, delay, duration: 0.55 });

function slide(id: string, name: string, elements: SlideElement[]): Slide {
  return { id, name, transition: "fade", elements };
}

export const TEMPLATES: Template[] = [
  {
    key: "pitch",
    name: "Company pitch",
    category: "Business",
    description: "Interactive investor pitch — problem, solution, traction, ask.",
    doc: {
      title: "Company pitch",
      description: "Investor pitch",
      theme: dark("#f5a623", "Karm Dark"),
      version: 1,
      slides: [
        slide("p1", "Title", [
          { id: "p1a", type: "shape", x: 6, y: 38, w: 6, h: 1, ...b, props: { shape: "line", fill: "#f5a623" } },
          { id: "p1b", type: "heading", x: 6, y: 28, w: 78, h: 16, ...b, props: { text: "Powering what's next", level: 1 }, animation: anim(0) },
          { id: "p1c", type: "text", x: 6, y: 48, w: 56, h: 8, ...b, props: { text: "A 6-slide interactive pitch. Replace every number with yours." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
          { id: "p1d", type: "button", x: 6, y: 78, w: 22, h: 8, ...b, props: { label: "Start the story", action: "next-slide", variant: "primary" }, animation: anim(0.3) },
        ]),
        slide("p2", "The problem", [
          { id: "p2a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "The problem", level: 2 } },
          { id: "p2b", type: "stat", x: 6, y: 20, w: 28, h: 28, ...b, props: { value: "68", suffix: "%", label: "of the market affected", countUp: true, icon: "target", trend: { direction: "up", value: "12%" } }, animation: anim(0, "zoom") },
          { id: "p2c", type: "stat", x: 36, y: 20, w: 28, h: 28, ...b, props: { value: "4.2", prefix: "$", suffix: "B", label: "annual cost of inaction", countUp: true, icon: "dollar-sign" }, animation: anim(0.15, "zoom") },
          { id: "p2d", type: "stat", x: 66, y: 20, w: 28, h: 28, ...b, props: { value: "3", suffix: "×", label: "slower with status quo", countUp: true, icon: "trending-up" }, animation: anim(0.3, "zoom") },
          { id: "p2e", type: "accordion", x: 6, y: 52, w: 88, h: 40, ...b, props: { items: [
            { title: "Pain customers feel every day", content: "Describe the daily friction in one concrete sentence. Name the person, the task, the cost." },
            { title: "Why current tools fail", content: "Incumbents are expensive, slow, or built for a different decade. Be specific." },
            { title: "Why now", content: "What changed in the market, regulation, or technology that makes this urgent." },
          ] }, animation: anim(0.4) },
        ]),
        slide("p3", "Solution", [
          { id: "p3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "How we solve it", level: 2 } },
          { id: "p3b", type: "flipcards", x: 6, y: 20, w: 88, h: 36, ...b, props: { cards: [
            { front: "Product", back: "What you actually ship — one sentence a customer would repeat.", icon: "zap" },
            { front: "Wedge", back: "The first beachhead customer and why they buy now.", icon: "target" },
            { front: "Moat", back: "Data, network, or distribution that gets stronger with each deal.", icon: "shield" },
          ] }, animation: anim(0.1) },
          { id: "p3c", type: "comparison", x: 6, y: 60, w: 88, h: 34, ...b, props: { items: [
            { title: "Status quo", points: ["Manual, slow, expensive", "No real-time visibility", "High switching cost later"], highlighted: false },
            { title: "With you", badge: "Recommended", points: ["Live, measurable outcomes", "Pays back in one quarter", "Built to scale"], highlighted: true },
          ] }, animation: anim(0.25) },
        ]),
        slide("p4", "Traction", [
          { id: "p4a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Traction", level: 2 } },
          { id: "p4b", type: "chart", x: 6, y: 18, w: 58, h: 54, ...b, props: { chartType: "area", title: "Revenue", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Revenue", data: [80, 140, 230, 360] }], stacked: false, showLegend: false, showGrid: true, valuePrefix: "$", valueSuffix: "k" }, animation: anim(0.1) },
          { id: "p4c", type: "progress", x: 68, y: 18, w: 26, h: 16, ...b, props: { label: "ARR target", value: 72, suffix: "%", showValue: true }, animation: anim(0.2) },
          { id: "p4d", type: "progress", x: 68, y: 38, w: 26, h: 16, ...b, props: { label: "NPS", value: 84, suffix: "", showValue: true }, animation: anim(0.3) },
          { id: "p4e", type: "progress", x: 68, y: 58, w: 26, h: 16, ...b, props: { label: "Gross margin", value: 61, suffix: "%", showValue: true }, animation: anim(0.4) },
          { id: "p4f", type: "tabs", x: 6, y: 76, w: 88, h: 18, ...b, props: { tabs: [
            { label: "Customers", title: "Who's buying", content: "Name 3 lighthouse customers and why they signed." },
            { label: "Pipeline", title: "What's next", content: "Qualified pipeline and expected close dates." },
            { label: "Retention", title: "Who stays", content: "Logo retention and expansion revenue." },
          ] }, animation: anim(0.45) },
        ]),
        slide("p5", "Roadmap", [
          { id: "p5a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Roadmap", level: 2 } },
          { id: "p5b", type: "timeline", x: 6, y: 22, w: 88, h: 50, ...b, props: { orientation: "horizontal", items: [
            { date: "Now", title: "Ship the core", description: "The product that proves the wedge." },
            { date: "Q3", title: "Expand", description: "Second segment or second region." },
            { date: "Q4", title: "Scale", description: "Repeatable sales motion." },
            { date: "Next year", title: "Platform", description: "Where this becomes a category." },
          ] }, animation: anim(0.1) },
          { id: "p5c", type: "button", x: 6, y: 80, w: 20, h: 8, ...b, props: { label: "The ask →", action: "next-slide", variant: "primary" } },
        ]),
        slide("p6", "The ask", [
          { id: "p6a", type: "heading", x: 6, y: 8, w: 80, h: 12, ...b, props: { text: "The ask", level: 2 } },
          { id: "p6b", type: "stat", x: 6, y: 26, w: 42, h: 32, ...b, props: { value: "4", prefix: "$", suffix: "M", label: "Seed round", countUp: true, icon: "dollar-sign" }, animation: anim(0, "zoom") },
          { id: "p6c", type: "list", x: 52, y: 26, w: 42, h: 32, ...b, props: { items: ["18-month runway", "Hire the founding sales pod", "Prove unit economics in one market"], ordered: false, marker: "check" }, animation: anim(0.15) },
          { id: "p6d", type: "quiz", x: 6, y: 62, w: 88, h: 32, ...b, props: { question: "What should an investor remember?", options: ["A vague vision", "A clear wedge, proof, and ask", "A long feature list"], correctIndex: 1, explanation: "Lead with the wedge, show proof, end with a precise ask." }, animation: anim(0.3) },
        ]),
      ],
    },
  },
  {
    key: "quarterly",
    name: "Quarterly review",
    category: "Business",
    description: "Live KPIs, charts, wins, and a plan the room can click through.",
    doc: {
      title: "Quarterly review",
      description: "Internal QBR",
      theme: dark("#f5a623", "Karm Dark"),
      version: 1,
      slides: [
        slide("q1", "Title", [
          { id: "q1a", type: "heading", x: 6, y: 32, w: 80, h: 16, ...b, props: { text: "Q3 2026 Review", level: 1 }, animation: anim(0) },
          { id: "q1b", type: "text", x: 6, y: 52, w: 50, h: 8, ...b, props: { text: "Performance, wins, and what we do next." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("q2", "KPIs", [
          { id: "q2a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Key metrics", level: 2 } },
          { id: "q2b", type: "stat", x: 6, y: 20, w: 28, h: 28, ...b, props: { value: "12.4", prefix: "$", suffix: "M", label: "Revenue", trend: { direction: "up", value: "18%" }, countUp: true, icon: "dollar-sign" }, animation: anim(0, "zoom") },
          { id: "q2c", type: "stat", x: 36, y: 20, w: 28, h: 28, ...b, props: { value: "38", suffix: "MW", label: "Capacity delivered", trend: { direction: "up", value: "9%" }, countUp: true, icon: "zap" }, animation: anim(0.12, "zoom") },
          { id: "q2d", type: "stat", x: 66, y: 20, w: 28, h: 28, ...b, props: { value: "97", suffix: "%", label: "Uptime", trend: { direction: "flat", value: "0%" }, countUp: true, icon: "award" }, animation: anim(0.24, "zoom") },
          { id: "q2e", type: "chart", x: 6, y: 52, w: 88, h: 42, ...b, props: { chartType: "bar", labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"], series: [{ name: "Revenue", data: [1.6, 1.8, 2.0, 2.1, 2.3, 2.6] }], stacked: false, showLegend: false, showGrid: true, valuePrefix: "$", valueSuffix: "M" }, animation: anim(0.35) },
        ]),
        slide("q3", "Deep dive", [
          { id: "q3a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Where the quarter went", level: 2 } },
          { id: "q3b", type: "tabs", x: 6, y: 20, w: 88, h: 72, ...b, props: { tabs: [
            { label: "Wins", title: "What worked", content: "Name the three outcomes that moved the number. Attach owners." },
            { label: "Misses", title: "What slipped", content: "Be honest. What we missed, why, and the fix already in motion." },
            { label: "Risks", title: "What could break Q4", content: "Top two risks, trigger, and mitigation." },
            { label: "Asks", title: "What we need", content: "Decisions, budget, or headcount required this month." },
          ] }, animation: anim(0.1) },
        ]),
        slide("q4", "Plan", [
          { id: "q4a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Q4 plan", level: 2 } },
          { id: "q4b", type: "timeline", x: 6, y: 20, w: 54, h: 70, ...b, props: { orientation: "vertical", items: [
            { date: "October", title: "Close the gap", description: "Recover the two slipped deals." },
            { date: "November", title: "Lock pipeline", description: "Qualify Q1 early." },
            { date: "December", title: "Plan 2027", description: "Budget and hiring locked." },
          ] }, animation: anim(0.1) },
          { id: "q4c", type: "progress", x: 64, y: 22, w: 30, h: 16, ...b, props: { label: "Annual target", value: 74, suffix: "%", showValue: true }, animation: anim(0.2) },
          { id: "q4d", type: "progress", x: 64, y: 42, w: 30, h: 16, ...b, props: { label: "Hiring plan", value: 50, suffix: "%", showValue: true }, animation: anim(0.3) },
          { id: "q4e", type: "progress", x: 64, y: 62, w: 30, h: 16, ...b, props: { label: "NPS recovery", value: 40, suffix: "%", showValue: true }, animation: anim(0.4) },
        ]),
      ],
    },
  },
  {
    key: "project",
    name: "Project kickoff",
    category: "Work",
    description: "Goals, scope, timeline, and team — clickable from day one.",
    doc: {
      title: "Project kickoff",
      description: "Kickoff deck",
      theme: dark("#4f9cf9", "Studio Blue"),
      version: 1,
      slides: [
        slide("k1", "Title", [
          { id: "k1a", type: "heading", x: 6, y: 30, w: 80, h: 16, ...b, props: { text: "Project kickoff", level: 1 }, animation: anim(0) },
          { id: "k1b", type: "text", x: 6, y: 50, w: 55, h: 8, ...b, props: { text: "What we're building, why, and how we'll get there." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
          { id: "k1c", type: "button", x: 6, y: 78, w: 20, h: 8, ...b, props: { label: "See the plan", action: "next-slide", variant: "primary" } },
        ]),
        slide("k2", "Goals", [
          { id: "k2a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Success looks like", level: 2 } },
          { id: "k2b", type: "flipcards", x: 6, y: 20, w: 88, h: 36, ...b, props: { cards: [
            { front: "Outcome", back: "The measurable result in 90 days. One number the sponsor will check.", icon: "target" },
            { front: "User", back: "Who feels the change first, and what they stop doing.", icon: "users" },
            { front: "Constraint", back: "Time, budget, or compliance we will not break.", icon: "shield" },
          ] }, animation: anim(0.1) },
          { id: "k2c", type: "list", x: 6, y: 62, w: 88, h: 30, ...b, props: { items: ["Primary goal with a number", "Secondary goal we still care about", "What we will explicitly not do"], ordered: true, marker: "number" }, animation: anim(0.25) },
        ]),
        slide("k3", "Timeline", [
          { id: "k3a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Timeline", level: 2 } },
          { id: "k3b", type: "timeline", x: 6, y: 20, w: 88, h: 72, ...b, props: { orientation: "horizontal", items: [
            { date: "Wk 1–2", title: "Discover", description: "Research, interviews, scope lock." },
            { date: "Wk 3–6", title: "Build", description: "Core path only." },
            { date: "Wk 7–8", title: "Prove", description: "QA, pilots, polish." },
            { date: "Wk 9", title: "Launch", description: "Ship and measure." },
          ] }, animation: anim(0.1) },
        ]),
        slide("k4", "Team", [
          { id: "k4a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Who owns what", level: 2 } },
          { id: "k4b", type: "tabs", x: 6, y: 20, w: 88, h: 72, ...b, props: { tabs: [
            { label: "Sponsor", title: "Decides", content: "Name, decision rights, weekly checkpoint." },
            { label: "Lead", title: "Runs the work", content: "Day-to-day owner. Escalates blockers within 24 hours." },
            { label: "Build", title: "Makes it real", content: "Engineering / design / ops — list the actual people." },
            { label: "Comms", title: "Keeps the room aligned", content: "Status cadence: weekly note, demo every other Friday." },
          ] }, animation: anim(0.1) },
        ]),
      ],
    },
  },
  {
    key: "overview",
    name: "Company overview",
    category: "Business",
    description: "Who you are, where you operate, and proof — built to present live.",
    doc: {
      title: "Company overview",
      description: "Who we are",
      theme: dark("#f5a623", "Karm Dark"),
      version: 1,
      slides: [
        slide("o1", "Title", [
          { id: "o1a", type: "heading", x: 6, y: 30, w: 80, h: 16, ...b, props: { text: "KarmSolar at a glance", level: 1 }, animation: anim(0) },
          { id: "o1b", type: "text", x: 6, y: 50, w: 60, h: 8, ...b, props: { text: "Independent power for Egyptian businesses and communities." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("o2", "Proof", [
          { id: "o2a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "By the numbers", level: 2 } },
          { id: "o2b", type: "stat", x: 6, y: 20, w: 28, h: 30, ...b, props: { value: "42", suffix: "MW", label: "Installed", countUp: true, icon: "sun" }, animation: anim(0, "zoom") },
          { id: "o2c", type: "stat", x: 36, y: 20, w: 28, h: 30, ...b, props: { value: "45", suffix: "k", label: "Tons CO₂ offset / year", countUp: true, icon: "leaf" }, animation: anim(0.12, "zoom") },
          { id: "o2d", type: "stat", x: 66, y: 20, w: 28, h: 30, ...b, props: { value: "17", suffix: "M", label: "Liters of diesel saved", countUp: true, icon: "zap" }, animation: anim(0.24, "zoom") },
          { id: "o2e", type: "chart", x: 6, y: 54, w: 88, h: 40, ...b, props: { chartType: "bar", labels: ["Generation", "Distribution", "Microgrids"], series: [{ name: "MW", data: [24, 12, 6] }], stacked: false, showLegend: false, showGrid: true, valueSuffix: " MW" }, animation: anim(0.35) },
        ]),
        slide("o3", "Where", [
          { id: "o3a", type: "heading", x: 6, y: 6, w: 50, h: 10, ...b, props: { text: "Where we work", level: 2 } },
          { id: "o3b", type: "map", x: 6, y: 20, w: 50, h: 70, ...b, props: { lat: 26.8, lng: 30.8, zoom: 5, label: "Egypt" }, animation: anim(0.1) },
          { id: "o3c", type: "timeline", x: 60, y: 20, w: 34, h: 70, ...b, props: { orientation: "vertical", items: [
            { date: "2011", title: "Founded", description: "Zamalek, Cairo." },
            { date: "Sites", title: "Farafra & beyond", description: "Remote grids and urban distribution." },
            { date: "Today", title: "Ecosystem", description: "Energy, water, charge, build." },
          ] }, animation: anim(0.2) },
        ]),
        slide("o4", "Solutions", [
          { id: "o4a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Solutions", level: 2 } },
          { id: "o4b", type: "flipcards", x: 6, y: 20, w: 88, h: 70, ...b, props: { cards: [
            { front: "Generation", back: "Solar stations we own and operate — no upfront capex for the client.", icon: "sun" },
            { front: "Distribution", back: "Private networks for urban developments and remote geography.", icon: "globe" },
            { front: "Microgrids", back: "Solar + storage + diesel, cost-optimised for off-grid sites.", icon: "battery" },
          ] }, animation: anim(0.1) },
        ]),
      ],
    },
  },
  {
    key: "education",
    name: "Lesson",
    category: "Education",
    description: "Teach a topic with tabs, flip cards, and a live quiz.",
    doc: {
      title: "Lesson",
      description: "Interactive lesson",
      theme: dark("#3ecfcf", "Lesson Teal", { accentText: "#062022" }),
      version: 1,
      slides: [
        slide("e1", "Title", [
          { id: "e1a", type: "heading", x: 6, y: 30, w: 84, h: 16, ...b, props: { text: "Today's lesson", level: 1 }, animation: anim(0) },
          { id: "e1b", type: "text", x: 6, y: 50, w: 60, h: 8, ...b, props: { text: "Learn it, flip it, then prove it with a quiz." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("e2", "Objectives", [
          { id: "e2a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "You will be able to", level: 2 } },
          { id: "e2b", type: "list", x: 6, y: 20, w: 50, h: 40, ...b, props: { items: ["Explain the core idea in your own words", "Apply it to a real example", "Spot the common mistake"], ordered: true, marker: "number" }, animation: anim(0.1) },
          { id: "e2c", type: "progress", x: 60, y: 22, w: 34, h: 14, ...b, props: { label: "Lesson progress", value: 0, suffix: "%", showValue: true } },
          { id: "e2d", type: "progress", x: 60, y: 40, w: 34, h: 14, ...b, props: { label: "Practice", value: 0, suffix: "%", showValue: true } },
          { id: "e2e", type: "stat", x: 60, y: 58, w: 34, h: 28, ...b, props: { value: "12", suffix: " min", label: "Guided time", countUp: true, icon: "calendar" }, animation: anim(0.2, "zoom") },
        ]),
        slide("e3", "Concept", [
          { id: "e3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "The idea", level: 2 } },
          { id: "e3b", type: "tabs", x: 6, y: 20, w: 88, h: 72, ...b, props: { tabs: [
            { label: "Explain", title: "In one minute", content: "Write the concept as if you were teaching a sharp 16-year-old. No jargon without a translation." },
            { label: "Example", title: "See it", content: "A concrete example with numbers. What changed before vs after." },
            { label: "Why it matters", title: "So what", content: "The decision this idea unlocks in the real world." },
            { label: "Watch-outs", title: "Common mistakes", content: "The two ways people usually get this wrong." },
          ] }, animation: anim(0.1) },
        ]),
        slide("e4", "Practice", [
          { id: "e4a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Flip to remember", level: 2 } },
          { id: "e4b", type: "flipcards", x: 6, y: 20, w: 88, h: 70, ...b, props: { cards: [
            { front: "Term one", back: "Definition in plain language + a tiny example.", icon: "sun" },
            { front: "Term two", back: "Definition and the contrast with term one.", icon: "zap" },
            { front: "Term three", back: "When you would actually use this.", icon: "target" },
          ] }, animation: anim(0.1) },
        ]),
        slide("e5", "Check", [
          { id: "e5a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Check your understanding", level: 2 } },
          { id: "e5b", type: "quiz", x: 6, y: 20, w: 88, h: 70, ...b, props: { question: "Which statement is true?", options: ["The first plausible-sounding wrong answer", "The correct, precise answer", "A common misconception", "Something unrelated"], correctIndex: 1, explanation: "Replace this with the real explanation so the room learns, not just scores." }, animation: anim(0.1) },
        ]),
      ],
    },
  },
  {
    key: "training",
    name: "Safety training",
    category: "Training",
    description: "Rules, scenarios, and a scored quiz — built for live sessions.",
    doc: {
      title: "Safety training",
      description: "Interactive safety briefing",
      theme: dark("#f0554d", "Safety", { accentText: "#fff" }),
      version: 1,
      slides: [
        slide("s1", "Title", [
          { id: "s1a", type: "heading", x: 6, y: 30, w: 84, h: 16, ...b, props: { text: "Site safety briefing", level: 1 }, animation: anim(0) },
          { id: "s1b", type: "text", x: 6, y: 50, w: 60, h: 8, ...b, props: { text: "Required before you step on site. Click through, then pass the check." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("s2", "Rules", [
          { id: "s2a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Non-negotiables", level: 2 } },
          { id: "s2b", type: "accordion", x: 6, y: 20, w: 88, h: 72, ...b, props: { items: [
            { title: "PPE is on before you enter", content: "Helmet, boots, vest, glasses. No exceptions for 'just five minutes'." },
            { title: "Lockout / tagout", content: "Never service live equipment. Confirm isolation with the site lead." },
            { title: "Report near-misses the same day", content: "A near-miss is a free lesson. Log it before you leave." },
            { title: "Stop the job", content: "Anyone can halt work. You will never be penalised for stopping an unsafe act." },
          ] }, animation: anim(0.1) },
        ]),
        slide("s3", "Scenarios", [
          { id: "s3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "What would you do?", level: 2 } },
          { id: "s3b", type: "flipcards", x: 6, y: 20, w: 88, h: 70, ...b, props: { cards: [
            { front: "You see a colleague without a harness", back: "Stop the work. Speak up. Inform the supervisor. Do not look away.", icon: "users" },
            { front: "A panel looks damaged after wind", back: "Do not approach. Cordon. Call the electrical lead. Photograph from a safe distance.", icon: "zap" },
            { front: "You feel heat exhaustion", back: "Stop. Shade. Water. Tell someone. Heat is a safety incident, not toughness.", icon: "sun" },
          ] }, animation: anim(0.1) },
        ]),
        slide("s4", "Quiz", [
          { id: "s4a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Pass the check", level: 2 } },
          { id: "s4b", type: "quiz", x: 6, y: 20, w: 88, h: 70, ...b, props: { question: "Who is allowed to stop unsafe work?", options: ["Only the site manager", "Only HSE", "Anyone on site", "Only the client"], correctIndex: 2, explanation: "Anyone can stop the job. That is the rule." }, animation: anim(0.1) },
        ]),
      ],
    },
  },
  {
    key: "marketing",
    name: "Campaign brief",
    category: "Marketing",
    description: "Audience, message, channels, and a live plan to click through.",
    doc: {
      title: "Campaign brief",
      description: "Marketing campaign",
      theme: dark("#e66df2", "Campaign", { accentText: "#1a0b1c" }),
      version: 1,
      slides: [
        slide("m1", "Title", [
          { id: "m1a", type: "heading", x: 6, y: 30, w: 84, h: 16, ...b, props: { text: "Campaign brief", level: 1 }, animation: anim(0) },
          { id: "m1b", type: "text", x: 6, y: 50, w: 55, h: 8, ...b, props: { text: "Who it's for, what we say, where it runs." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("m2", "Audience", [
          { id: "m2a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Who we are talking to", level: 2 } },
          { id: "m2b", type: "comparison", x: 6, y: 20, w: 88, h: 72, ...b, props: { items: [
            { title: "Primary", badge: "Must win", points: ["Job to be done", "Where they already pay attention", "The objection we have to kill"], highlighted: true },
            { title: "Secondary", points: ["Nice-to-have reach", "Influencers / partners", "Do not dilute the message"], highlighted: false },
          ] }, animation: anim(0.1) },
        ]),
        slide("m3", "Message", [
          { id: "m3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "The line", level: 2 } },
          { id: "m3b", type: "tabs", x: 6, y: 20, w: 88, h: 72, ...b, props: { tabs: [
            { label: "Promise", title: "One sentence", content: "If they remember one line, it is this. No adjectives we cannot prove." },
            { label: "Proof", title: "Why it's true", content: "A number, a customer, or a demo. Proof first, poetry second." },
            { label: "CTA", title: "What they do next", content: "One action. Book, try, share — not all three." },
            { label: "Don'ts", title: "Off-limits", content: "Claims legal hasn't cleared. Tone that doesn't sound like us." },
          ] }, animation: anim(0.1) },
        ]),
        slide("m4", "Plan", [
          { id: "m4a", type: "heading", x: 6, y: 6, w: 70, h: 10, ...b, props: { text: "Where it runs", level: 2 } },
          { id: "m4b", type: "chart", x: 6, y: 18, w: 54, h: 50, ...b, props: { chartType: "donut", labels: ["Paid", "Owned", "Partner", "Field"], series: [{ name: "Mix", data: [40, 25, 20, 15] }], stacked: false, showLegend: true, showGrid: false }, animation: anim(0.1) },
          { id: "m4c", type: "progress", x: 64, y: 20, w: 30, h: 14, ...b, props: { label: "Creative ready", value: 60, suffix: "%", showValue: true }, animation: anim(0.2) },
          { id: "m4d", type: "progress", x: 64, y: 38, w: 30, h: 14, ...b, props: { label: "Media booked", value: 35, suffix: "%", showValue: true }, animation: anim(0.3) },
          { id: "m4e", type: "progress", x: 64, y: 56, w: 30, h: 14, ...b, props: { label: "Landing page", value: 80, suffix: "%", showValue: true }, animation: anim(0.4) },
          { id: "m4f", type: "timeline", x: 6, y: 72, w: 88, h: 22, ...b, props: { orientation: "horizontal", items: [
            { date: "T-14", title: "Lock", description: "Creative freeze." },
            { date: "T-0", title: "Launch", description: "Go live." },
            { date: "T+14", title: "Optimise", description: "Kill losers." },
            { date: "T+30", title: "Readout", description: "What we learned." },
          ] }, animation: anim(0.45) },
        ]),
      ],
    },
  },
  {
    key: "report",
    name: "Research report",
    category: "Report",
    description: "Findings, charts, and recommendations the audience can explore.",
    doc: {
      title: "Research report",
      description: "Findings readout",
      theme: dark("#4f9cf9", "Report"),
      version: 1,
      slides: [
        slide("r1", "Title", [
          { id: "r1a", type: "heading", x: 6, y: 30, w: 84, h: 16, ...b, props: { text: "Research readout", level: 1 }, animation: anim(0) },
          { id: "r1b", type: "text", x: 6, y: 50, w: 60, h: 8, ...b, props: { text: "What we learned, what it means, what we recommend." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("r2", "Findings", [
          { id: "r2a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Three findings", level: 2 } },
          { id: "r2b", type: "stat", x: 6, y: 20, w: 28, h: 26, ...b, props: { value: "81", suffix: "%", label: "Finding one", countUp: true, icon: "users" }, animation: anim(0, "zoom") },
          { id: "r2c", type: "stat", x: 36, y: 20, w: 28, h: 26, ...b, props: { value: "2.4", suffix: "×", label: "Finding two", countUp: true, icon: "trending-up" }, animation: anim(0.12, "zoom") },
          { id: "r2d", type: "stat", x: 66, y: 20, w: 28, h: 26, ...b, props: { value: "14", suffix: " days", label: "Finding three", countUp: true, icon: "calendar" }, animation: anim(0.24, "zoom") },
          { id: "r2e", type: "chart", x: 6, y: 50, w: 88, h: 44, ...b, props: { chartType: "line", title: "Signal over time", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: [{ name: "Signal", data: [20, 28, 26, 40, 48, 61] }], stacked: false, showLegend: false, showGrid: true }, animation: anim(0.35) },
        ]),
        slide("r3", "Evidence", [
          { id: "r3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Evidence", level: 2 } },
          { id: "r3b", type: "table", x: 6, y: 20, w: 88, h: 40, ...b, props: { columns: ["Segment", "n", "Result", "Confidence"], rows: [["Segment A", "120", "High", "95%"], ["Segment B", "86", "Medium", "90%"], ["Segment C", "54", "Low", "80%"]], highlightColumn: 2, compact: false }, animation: anim(0.1) },
          { id: "r3c", type: "accordion", x: 6, y: 64, w: 88, h: 30, ...b, props: { items: [
            { title: "Method", content: "Who we talked to, how, and what we did not measure." },
            { title: "Limits", content: "Sample bias, seasonality, or missing data the room should know." },
          ] }, animation: anim(0.2) },
        ]),
        slide("r4", "Recommend", [
          { id: "r4a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Recommendations", level: 2 } },
          { id: "r4b", type: "comparison", x: 6, y: 20, w: 88, h: 72, ...b, props: { items: [
            { title: "Do now", badge: "This month", points: ["Action with an owner", "Action with a date", "How we will know it worked"], highlighted: true },
            { title: "Do next", points: ["The follow-on bet", "What would change our mind", "What we will not fund"], highlighted: false },
          ] }, animation: anim(0.1) },
        ]),
      ],
    },
  },
  {
    key: "workshop",
    name: "Workshop",
    category: "Work",
    description: "Agenda, activities, and a decision quiz for a live workshop.",
    doc: {
      title: "Workshop",
      description: "Facilitated session",
      theme: dark("#43c98a", "Workshop", { accentText: "#062016" }),
      version: 1,
      slides: [
        slide("w1", "Title", [
          { id: "w1a", type: "heading", x: 6, y: 30, w: 84, h: 16, ...b, props: { text: "Workshop", level: 1 }, animation: anim(0) },
          { id: "w1b", type: "text", x: 6, y: 50, w: 55, h: 8, ...b, props: { text: "A working session — not a lecture. Leave with a decision." }, style: { color: "#9ba1ab" }, animation: anim(0.15) },
        ]),
        slide("w2", "Agenda", [
          { id: "w2a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Agenda", level: 2 } },
          { id: "w2b", type: "timeline", x: 6, y: 20, w: 88, h: 72, ...b, props: { orientation: "vertical", items: [
            { date: "0:00", title: "Frame", description: "Why we're here and the decision we owe." },
            { date: "0:15", title: "Diverge", description: "Silent ideas, then cluster." },
            { date: "0:40", title: "Converge", description: "Vote, debate the top two." },
            { date: "1:10", title: "Commit", description: "Owner, date, first step." },
          ] }, animation: anim(0.1) },
        ]),
        slide("w3", "Rules", [
          { id: "w3a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "How we'll work", level: 2 } },
          { id: "w3b", type: "flipcards", x: 6, y: 20, w: 88, h: 70, ...b, props: { cards: [
            { front: "One conversation", back: "No side chats. If it's important, say it to the room.", icon: "users" },
            { front: "Disagree, then commit", back: "Push hard in the room. Leave aligned.", icon: "target" },
            { front: "Write it down", back: "If it isn't captured, it didn't happen.", icon: "award" },
          ] }, animation: anim(0.1) },
        ]),
        slide("w4", "Decide", [
          { id: "w4a", type: "heading", x: 6, y: 6, w: 80, h: 10, ...b, props: { text: "Decision check", level: 2 } },
          { id: "w4b", type: "quiz", x: 6, y: 20, w: 88, h: 70, ...b, props: { question: "Are we ready to leave?", options: ["We still have two live options", "We have one owner, one date, one first step", "We'll 'circle back' later"], correctIndex: 1, explanation: "A workshop that ends without an owner and a date was a meeting." }, animation: anim(0.1) },
        ]),
      ],
    },
  },
];
