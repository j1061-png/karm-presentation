"use client";

import { nanoid } from "nanoid";
import type { SlideElement } from "@/lib/schema";
import {
  Type, AlignLeft, List, Quote, ImageIcon, Hash, BarChart3, Table2,
  Columns3, GitCommitHorizontal, PanelTop, ListCollapse, HelpCircle,
  Percent, MousePointerClick, Square, MapPin, Play, Repeat, Paperclip,
  MessageSquareWarning, Workflow, LayoutGrid,
} from "lucide-react";

const COMPONENTS: { type: string; label: string; icon: typeof Type }[] = [
  { type: "heading", label: "Heading", icon: Type },
  { type: "text", label: "Text", icon: AlignLeft },
  { type: "list", label: "List", icon: List },
  { type: "quote", label: "Quote", icon: Quote },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "stat", label: "Stat", icon: Hash },
  { type: "chart", label: "Chart", icon: BarChart3 },
  { type: "table", label: "Table", icon: Table2 },
  { type: "comparison", label: "Compare", icon: Columns3 },
  { type: "timeline", label: "Timeline", icon: GitCommitHorizontal },
  { type: "tabs", label: "Tabs", icon: PanelTop },
  { type: "accordion", label: "Accordion", icon: ListCollapse },
  { type: "quiz", label: "Quiz", icon: HelpCircle },
  { type: "flipcards", label: "Flip cards", icon: Repeat },
  { type: "callout", label: "Callout", icon: MessageSquareWarning },
  { type: "flow", label: "Flow", icon: Workflow },
  { type: "cards", label: "Cards", icon: LayoutGrid },
  { type: "progress", label: "Progress", icon: Percent },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "shape", label: "Shape", icon: Square },
  { type: "map", label: "Map", icon: MapPin },
  { type: "video", label: "Video", icon: Play },
];

/** Sensible starter element for each type, positioned at (x,y) percent. */
export function createDefaultElement(type: string, x: number, y: number): SlideElement | null {
  const base = { id: nanoid(8), x, y, z: 5, opacity: 1, rotation: 0 };
  switch (type) {
    case "heading":
      return { ...base, type, w: 50, h: 12, props: { text: "New heading", level: 2 } } as SlideElement;
    case "text":
      return { ...base, type, w: 44, h: 14, props: { text: "New text block. Double-click to edit." } } as SlideElement;
    case "list":
      return { ...base, type, w: 40, h: 26, props: { items: ["First point", "Second point", "Third point"], ordered: false, marker: "dot" } } as SlideElement;
    case "quote":
      return { ...base, type, w: 48, h: 18, props: { text: "A memorable quote goes here.", attribution: "Attribution" } } as SlideElement;
    case "image":
      return { ...base, type, w: 34, h: 38, props: { src: "", alt: "Image", fit: "cover" } } as SlideElement;
    case "stat":
      return { ...base, type, w: 26, h: 24, props: { value: "42", suffix: "%", label: "New stat", countUp: true, icon: "trending-up" } } as SlideElement;
    case "chart":
      return {
        ...base, type, w: 52, h: 46,
        props: {
          chartType: "bar", labels: ["A", "B", "C", "D"],
          series: [{ name: "Series 1", data: [12, 26, 18, 32] }],
          stacked: false, showLegend: false, showGrid: true,
        },
      } as SlideElement;
    case "table":
      return {
        ...base, type, w: 52, h: 32,
        props: { columns: ["Column 1", "Column 2", "Column 3"], rows: [["Row 1", "—", "—"], ["Row 2", "—", "—"]], compact: false },
      } as SlideElement;
    case "comparison":
      return {
        ...base, type, w: 60, h: 44,
        props: {
          items: [
            { title: "Option A", points: ["Point one", "Point two"], highlighted: true },
            { title: "Option B", points: ["Point one", "Point two"], highlighted: false },
          ],
        },
      } as SlideElement;
    case "timeline":
      return {
        ...base, type, w: 60, h: 40,
        props: {
          orientation: "horizontal",
          items: [
            { date: "Phase 1", title: "Start" },
            { date: "Phase 2", title: "Build" },
            { date: "Phase 3", title: "Launch" },
          ],
        },
      } as SlideElement;
    case "tabs":
      return {
        ...base, type, w: 52, h: 38,
        props: {
          tabs: [
            { label: "Tab 1", title: "First tab", content: "Content for the first tab." },
            { label: "Tab 2", title: "Second tab", content: "Content for the second tab." },
          ],
        },
      } as SlideElement;
    case "accordion":
      return {
        ...base, type, w: 46, h: 36,
        props: {
          items: [
            { title: "Section one", content: "Details for section one." },
            { title: "Section two", content: "Details for section two." },
          ],
        },
      } as SlideElement;
    case "flipcards":
      return {
        ...base, type, w: 60, h: 30,
        props: {
          cards: [
            { front: "Card one", back: "Details revealed on flip.", icon: "sun" },
            { front: "Card two", back: "Details revealed on flip.", icon: "zap" },
            { front: "Card three", back: "Details revealed on flip.", icon: "leaf" },
          ],
        },
      } as SlideElement;
    case "quiz":
      return {
        ...base, type, w: 50, h: 44,
        props: { question: "Your question here?", options: ["Answer A", "Answer B", "Answer C"], correctIndex: 0, explanation: "Why this is correct." },
      } as SlideElement;
    case "callout":
      return {
        ...base, type, w: 88, h: 22,
        props: {
          kicker: "Where this is weak",
          title: "",
          body: "The limit of the claim — sample, method, or what would change your mind.",
          variant: "weak",
          startOpen: false,
        },
      } as SlideElement;
    case "flow":
      return {
        ...base, type, w: 88, h: 28,
        props: {
          steps: [
            { label: "Step one", detail: "What this step actually does." },
            { label: "Step two", detail: "What changes here." },
            { label: "Step three", detail: "The outcome." },
          ],
        },
      } as SlideElement;
    case "cards":
      return {
        ...base, type, w: 88, h: 40,
        props: {
          cards: [
            { number: "1", title: "First argument", body: "Click to read the detail.", icon: "target" },
            { number: "2", title: "Second argument", body: "Click to read the detail.", icon: "zap" },
            { number: "3", title: "Third argument", body: "Click to read the detail.", icon: "shield" },
          ],
        },
      } as SlideElement;
    case "progress":
      return { ...base, type, w: 40, h: 10, props: { label: "Progress", value: 60, suffix: "%", showValue: true } } as SlideElement;
    case "button":
      return { ...base, type, w: 18, h: 8, props: { label: "Next", action: "next-slide", variant: "primary" } } as SlideElement;
    case "shape":
      return { ...base, type, w: 20, h: 20, props: { shape: "rect", fill: "#f5a623" } } as SlideElement;
    case "map":
      return { ...base, type, w: 44, h: 44, props: { lat: 24.0889, lng: 32.8998, zoom: 6, label: "Aswan, Egypt" } } as SlideElement;
    case "video":
      return { ...base, type, w: 44, h: 44, props: { provider: "youtube", videoId: "" } } as SlideElement;
    default:
      return null;
  }
}

export function InsertBar({
  onInsert,
  onAttach,
}: {
  onInsert: (type: string) => void;
  onAttach?: (files: FileList) => void;
}) {
  return (
    <div className="h-11 border-b border-border flex items-center gap-0.5 px-3 overflow-x-auto flex-shrink-0 bg-surface/40">
      <span className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium mr-2 flex-shrink-0">
        Insert
      </span>
      {COMPONENTS.map((c) => (
        <button
          key={c.type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-studio-component", c.type);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onInsert(c.type)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
          title={`${c.label} — click to add, or drag onto the slide`}
        >
          <c.icon size={13.5} />
          {c.label}
        </button>
      ))}
      {onAttach && (
        <>
          <div className="w-px h-5 bg-border mx-1.5 flex-shrink-0" />
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer flex-shrink-0">
            <Paperclip size={13.5} />
            Attach
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.csv,.tsv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onAttach(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}
