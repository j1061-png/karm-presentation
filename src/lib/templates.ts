import type { Presentation } from "./schema";

/**
 * Built-in templates. Creating from a template clones the document
 * (ids are regenerated server-side on create).
 */

type TemplateDoc = Omit<Presentation, "id" | "createdAt" | "updatedAt">;

export interface Template {
  key: string;
  name: string;
  description: string;
  doc: TemplateDoc;
}

const karmTheme = {
  name: "Karm Dark",
  mode: "dark" as const,
  colors: {
    background: "#0c0d10",
    surface: "#16181d",
    text: "#f4f5f7",
    muted: "#9ba1ab",
    accent: "#f5a623",
    accentText: "#101114",
  },
  headingFont: "inherit",
  bodyFont: "inherit",
  radius: 12,
};

export const TEMPLATES: Template[] = [
  {
    key: "pitch",
    name: "Company pitch",
    description: "Title, problem, solution, traction and roadmap — investor-ready.",
    doc: {
      title: "Company pitch",
      description: "Investor pitch template",
      theme: karmTheme,
      version: 1,
      slides: [
        {
          id: "t1", name: "Title", transition: "fade",
          elements: [
            { id: "t1a", type: "shape", x: 6, y: 40, w: 5, h: 1, z: 1, opacity: 1, rotation: 0, props: { shape: "line", fill: "#f5a623" } },
            { id: "t1b", type: "heading", x: 6, y: 32, w: 70, h: 18, z: 2, opacity: 1, rotation: 0, props: { text: "Powering what's next", level: 1 }, animation: { type: "fade-up", delay: 0, duration: 0.6 } },
            { id: "t1c", type: "text", x: 6, y: 52, w: 55, h: 10, z: 2, opacity: 1, rotation: 0, props: { text: "A short subtitle about your company and this presentation." }, style: { color: "#9ba1ab" }, animation: { type: "fade-up", delay: 0.15, duration: 0.6 } },
          ],
        },
        {
          id: "t2", name: "The problem", transition: "fade",
          elements: [
            { id: "t2a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "The problem", level: 2 } },
            { id: "t2b", type: "list", x: 6, y: 28, w: 42, h: 55, z: 1, opacity: 1, rotation: 0, props: { items: ["Pain point one your customers face", "Pain point two costing them money", "Why current solutions fall short"], ordered: false, marker: "arrow" }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
            { id: "t2c", type: "stat", x: 56, y: 28, w: 38, h: 26, z: 1, opacity: 1, rotation: 0, props: { value: "68", suffix: "%", label: "of the market affected", countUp: true, icon: "target" }, animation: { type: "fade-up", delay: 0.25, duration: 0.6 } },
            { id: "t2d", type: "stat", x: 56, y: 58, w: 38, h: 26, z: 1, opacity: 1, rotation: 0, props: { value: "4.2", prefix: "$", suffix: "B", label: "annual cost of the problem", countUp: true, icon: "dollar-sign" }, animation: { type: "fade-up", delay: 0.4, duration: 0.6 } },
          ],
        },
        {
          id: "t3", name: "Traction", transition: "fade",
          elements: [
            { id: "t3a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Traction", level: 2 } },
            { id: "t3b", type: "chart", x: 6, y: 26, w: 88, h: 62, z: 1, opacity: 1, rotation: 0, props: { chartType: "area", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Revenue", data: [120, 210, 340, 520] }], stacked: false, showLegend: false, showGrid: true, valuePrefix: "$", valueSuffix: "k" }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
          ],
        },
        {
          id: "t4", name: "Roadmap", transition: "fade",
          elements: [
            { id: "t4a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Roadmap", level: 2 } },
            { id: "t4b", type: "timeline", x: 6, y: 30, w: 88, h: 55, z: 1, opacity: 1, rotation: 0, props: { orientation: "horizontal", items: [ { date: "Now", title: "Milestone one", description: "What you're shipping now" }, { date: "Q3", title: "Milestone two", description: "The next big step" }, { date: "Q4", title: "Milestone three", description: "Scale it up" }, { date: "2027", title: "Vision", description: "Where this all leads" } ] }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
          ],
        },
      ],
    },
  },
  {
    key: "quarterly",
    name: "Quarterly review",
    description: "KPIs, revenue chart, wins and challenges for internal reviews.",
    doc: {
      title: "Quarterly review",
      description: "Internal quarterly business review",
      theme: karmTheme,
      version: 1,
      slides: [
        {
          id: "q1", name: "Title", transition: "fade",
          elements: [
            { id: "q1a", type: "heading", x: 6, y: 36, w: 80, h: 16, z: 1, opacity: 1, rotation: 0, props: { text: "Q3 2026 Review", level: 1 }, animation: { type: "fade-up", delay: 0, duration: 0.6 } },
            { id: "q1b", type: "text", x: 6, y: 55, w: 50, h: 8, z: 1, opacity: 1, rotation: 0, props: { text: "Performance, wins and what's next." }, style: { color: "#9ba1ab" }, animation: { type: "fade-up", delay: 0.15, duration: 0.6 } },
          ],
        },
        {
          id: "q2", name: "KPIs", transition: "fade",
          elements: [
            { id: "q2a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Key metrics", level: 2 } },
            { id: "q2b", type: "stat", x: 6, y: 28, w: 28, h: 30, z: 1, opacity: 1, rotation: 0, props: { value: "12.4", prefix: "$", suffix: "M", label: "Revenue", trend: { direction: "up", value: "18%" }, countUp: true, icon: "dollar-sign" }, animation: { type: "fade-up", delay: 0, duration: 0.5 } },
            { id: "q2c", type: "stat", x: 36, y: 28, w: 28, h: 30, z: 1, opacity: 1, rotation: 0, props: { value: "38", suffix: "MW", label: "Capacity delivered", trend: { direction: "up", value: "9%" }, countUp: true, icon: "zap" }, animation: { type: "fade-up", delay: 0.15, duration: 0.5 } },
            { id: "q2d", type: "stat", x: 66, y: 28, w: 28, h: 30, z: 1, opacity: 1, rotation: 0, props: { value: "97", suffix: "%", label: "Uptime", trend: { direction: "flat", value: "0%" }, countUp: true, icon: "shield" }, animation: { type: "fade-up", delay: 0.3, duration: 0.5 } },
            { id: "q2e", type: "progress", x: 6, y: 66, w: 88, h: 12, z: 1, opacity: 1, rotation: 0, props: { label: "Annual target progress", value: 74, suffix: "%", showValue: true }, animation: { type: "fade-up", delay: 0.45, duration: 0.5 } },
          ],
        },
        {
          id: "q3", name: "Wins & challenges", transition: "fade",
          elements: [
            { id: "q3a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Wins & challenges", level: 2 } },
            { id: "q3b", type: "comparison", x: 6, y: 26, w: 88, h: 60, z: 1, opacity: 1, rotation: 0, props: { items: [ { title: "Wins", badge: "This quarter", points: ["Major win one", "Major win two", "Major win three"], highlighted: true }, { title: "Challenges", points: ["Challenge one", "Challenge two", "Challenge three"], highlighted: false } ] }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
          ],
        },
      ],
    },
  },
  {
    key: "project",
    name: "Project kickoff",
    description: "Goals, scope, timeline and team for launching a new project.",
    doc: {
      title: "Project kickoff",
      description: "New project kickoff deck",
      theme: { ...karmTheme, colors: { ...karmTheme.colors, accent: "#4f9cf9", accentText: "#0b1220" } },
      version: 1,
      slides: [
        {
          id: "p1", name: "Title", transition: "fade",
          elements: [
            { id: "p1a", type: "heading", x: 6, y: 34, w: 80, h: 16, z: 1, opacity: 1, rotation: 0, props: { text: "Project kickoff", level: 1 }, animation: { type: "fade-up", delay: 0, duration: 0.6 } },
            { id: "p1b", type: "text", x: 6, y: 53, w: 55, h: 8, z: 1, opacity: 1, rotation: 0, props: { text: "What we're building, why, and how we'll get there." }, style: { color: "#9ba1ab" }, animation: { type: "fade-up", delay: 0.15, duration: 0.6 } },
          ],
        },
        {
          id: "p2", name: "Goals", transition: "fade",
          elements: [
            { id: "p2a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Goals", level: 2 } },
            { id: "p2b", type: "list", x: 6, y: 28, w: 88, h: 55, z: 1, opacity: 1, rotation: 0, props: { items: ["Primary goal with a measurable outcome", "Secondary goal we care about", "What success looks like in 90 days"], ordered: true, marker: "number" }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
          ],
        },
        {
          id: "p3", name: "Timeline", transition: "fade",
          elements: [
            { id: "p3a", type: "heading", x: 6, y: 8, w: 80, h: 12, z: 1, opacity: 1, rotation: 0, props: { text: "Timeline", level: 2 } },
            { id: "p3b", type: "timeline", x: 6, y: 24, w: 88, h: 66, z: 1, opacity: 1, rotation: 0, props: { orientation: "vertical", items: [ { date: "Week 1-2", title: "Discovery", description: "Research and requirements" }, { date: "Week 3-6", title: "Build", description: "Core implementation" }, { date: "Week 7-8", title: "Test & polish", description: "QA, feedback, iteration" }, { date: "Week 9", title: "Launch", description: "Ship it" } ] }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
          ],
        },
      ],
    },
  },
];
