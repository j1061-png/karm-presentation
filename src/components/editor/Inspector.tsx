"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore, useSelectedSlide, useSelectedElement } from "@/state/editorStore";
import type { SlideElement } from "@/lib/schema";
import { extractFile } from "@/lib/api";
import {
  Copy, Trash2, ArrowUpToLine, ArrowDownToLine, AlignLeft, AlignCenter,
  AlignRight, Upload, Loader2, MousePointerClick,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3.5">
      <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2.5">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-text-secondary flex-shrink-0">{label}</span>
      {children}
    </label>
  );
}

function NumInput({
  value, onChange, min, max, step = 1, width = 64,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-[12.5px] outline-none focus:border-border-strong text-right tabular-nums"
      style={{ width }}
    />
  );
}

function TextInput({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-[12.5px] outline-none focus:border-border-strong w-full"
    />
  );
}

function TextArea({
  value, onChange, rows = 3, placeholder, mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface-2 border border-border rounded-md px-2.5 py-2 text-[12.5px] outline-none focus:border-border-strong w-full resize-y leading-relaxed ${mono ? "font-mono text-[11.5px]" : ""}`}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={isHex ? value.slice(0, 7) : "#888888"}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-md border border-border bg-transparent cursor-pointer p-0.5"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-[12px] outline-none focus:border-border-strong w-[86px] font-mono"
      />
    </div>
  );
}

function Select<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-[12.5px] outline-none focus:border-border-strong cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Structured-text helpers for complex props                           */
/* ------------------------------------------------------------------ */

function linesToItems(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Inspector                                                           */
/* ------------------------------------------------------------------ */

export function Inspector() {
  const slide = useSelectedSlide();
  const element = useSelectedElement();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {element && slide ? (
        <ElementInspector element={element} slideId={slide.id} />
      ) : slide ? (
        <SlideInspector />
      ) : null}
    </div>
  );
}

/* ----------------------------- slide + theme ---------------------- */

function SlideInspector() {
  const presentation = useEditorStore((s) => s.presentation);
  const slide = useSelectedSlide();
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const updateTheme = useEditorStore((s) => s.updateTheme);
  if (!presentation || !slide) return null;
  const theme = presentation.theme;
  const bg = slide.background;

  return (
    <>
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
          <MousePointerClick size={13} />
          Select an element on the canvas to edit it
        </div>
      </div>

      <Section title="Slide">
        <Row label="Name">
          <TextInput value={slide.name} onChange={(name) => updateSlide(slide.id, { name })} />
        </Row>
        <Row label="Transition">
          <Select
            value={slide.transition}
            options={[
              { value: "fade", label: "Fade" },
              { value: "slide", label: "Slide" },
              { value: "zoom", label: "Zoom" },
              { value: "none", label: "None" },
            ]}
            onChange={(transition) => updateSlide(slide.id, { transition })}
          />
        </Row>
        <Row label="Background">
          <Select
            value={bg?.type ?? "theme"}
            options={[
              { value: "theme", label: "Theme default" },
              { value: "color", label: "Color" },
              { value: "gradient", label: "Gradient" },
            ]}
            onChange={(type) => {
              if (type === "theme") updateSlide(slide.id, { background: undefined });
              else if (type === "color")
                updateSlide(slide.id, {
                  background: { type: "color", color: theme.colors.background, gradientAngle: 135, overlayOpacity: 0.5, particles: false },
                });
              else
                updateSlide(slide.id, {
                  background: {
                    type: "gradient",
                    gradientFrom: theme.colors.background,
                    gradientTo: theme.colors.surface,
                    gradientAngle: 135,
                    overlayOpacity: 0.5,
                    particles: false,
                  },
                });
            }}
          />
        </Row>
        {bg?.type === "color" && (
          <Row label="Color">
            <ColorInput
              value={bg.color ?? theme.colors.background}
              onChange={(color) => updateSlide(slide.id, { background: { ...bg, color } })}
            />
          </Row>
        )}
        {bg?.type === "gradient" && (
          <>
            <Row label="From">
              <ColorInput
                value={bg.gradientFrom ?? "#0c0d10"}
                onChange={(gradientFrom) => updateSlide(slide.id, { background: { ...bg, gradientFrom } })}
              />
            </Row>
            <Row label="To">
              <ColorInput
                value={bg.gradientTo ?? "#16181d"}
                onChange={(gradientTo) => updateSlide(slide.id, { background: { ...bg, gradientTo } })}
              />
            </Row>
            <Row label="Angle">
              <NumInput
                value={bg.gradientAngle}
                min={0}
                max={360}
                onChange={(gradientAngle) => updateSlide(slide.id, { background: { ...bg, gradientAngle } })}
              />
            </Row>
          </>
        )}
        {bg && (
          <Row label="Particles">
            <Select
              value={bg.particles ? "on" : "off"}
              options={[
                { value: "off", label: "Off" },
                { value: "on", label: "On" },
              ]}
              onChange={(v) => updateSlide(slide.id, { background: { ...bg, particles: v === "on" } })}
            />
          </Row>
        )}
        <Row label="Notes">
          <span />
        </Row>
        <TextArea
          value={slide.notes ?? ""}
          rows={2}
          placeholder="Speaker notes..."
          onChange={(notes) => updateSlide(slide.id, { notes })}
        />
      </Section>

      <Section title="Theme">
        <Row label="Mode">
          <Select
            value={theme.mode}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(mode) => updateTheme({ mode })}
          />
        </Row>
        <Row label="Background">
          <ColorInput value={theme.colors.background} onChange={(v) => updateTheme({ colors: { background: v } })} />
        </Row>
        <Row label="Surface">
          <ColorInput value={theme.colors.surface} onChange={(v) => updateTheme({ colors: { surface: v } })} />
        </Row>
        <Row label="Text">
          <ColorInput value={theme.colors.text} onChange={(v) => updateTheme({ colors: { text: v } })} />
        </Row>
        <Row label="Muted">
          <ColorInput value={theme.colors.muted} onChange={(v) => updateTheme({ colors: { muted: v } })} />
        </Row>
        <Row label="Accent">
          <ColorInput value={theme.colors.accent} onChange={(v) => updateTheme({ colors: { accent: v } })} />
        </Row>
        <Row label="Corner radius">
          <NumInput value={theme.radius} min={0} max={32} onChange={(radius) => updateTheme({ radius })} />
        </Row>
      </Section>
    </>
  );
}

/* ------------------------------- element -------------------------- */

function ElementInspector({ element, slideId }: { element: SlideElement; slideId: string }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const patchProps = useEditorStore((s) => s.patchElementProps);
  const patchStyle = useEditorStore((s) => s.patchElementStyle);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const duplicateElement = useEditorStore((s) => s.duplicateElement);
  const bringForward = useEditorStore((s) => s.bringForward);

  const s = element.style ?? {};
  const geom = (patch: Partial<SlideElement>) => updateElement(slideId, element.id, patch);

  return (
    <>
      {/* Header actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[12.5px] font-medium capitalize">{element.type}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => bringForward(slideId, element.id, 1)}
            className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 cursor-pointer"
            title="Bring forward"
          >
            <ArrowUpToLine size={13} />
          </button>
          <button
            onClick={() => bringForward(slideId, element.id, -1)}
            className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 cursor-pointer"
            title="Send backward"
          >
            <ArrowDownToLine size={13} />
          </button>
          <button
            onClick={() => duplicateElement(slideId, element.id)}
            className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 cursor-pointer"
            title="Duplicate (⌘D)"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => deleteElement(slideId, element.id)}
            className="p-1.5 rounded-md text-text-secondary hover:text-danger hover:bg-danger/10 cursor-pointer"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <ElementPropsEditor element={element} slideId={slideId} />

      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-2">
          <Row label="X">
            <NumInput value={Math.round(element.x * 10) / 10} step={0.5} onChange={(x) => geom({ x })} />
          </Row>
          <Row label="Y">
            <NumInput value={Math.round(element.y * 10) / 10} step={0.5} onChange={(y) => geom({ y })} />
          </Row>
          <Row label="W">
            <NumInput value={Math.round(element.w * 10) / 10} step={0.5} onChange={(w) => geom({ w })} />
          </Row>
          <Row label="H">
            <NumInput value={Math.round(element.h * 10) / 10} step={0.5} onChange={(h) => geom({ h })} />
          </Row>
        </div>
        <Row label="Rotation">
          <NumInput value={element.rotation} min={-180} max={180} onChange={(rotation) => geom({ rotation })} />
        </Row>
        <Row label="Opacity">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={element.opacity}
            onChange={(e) => geom({ opacity: Number(e.target.value) })}
            className="w-28 accent-[var(--color-accent)]"
          />
        </Row>
      </Section>

      <Section title="Style">
        <Row label="Font size">
          <NumInput value={s.fontSize} min={8} max={200} onChange={(v) => patchStyle(slideId, element.id, { fontSize: v })} />
        </Row>
        <Row label="Weight">
          <Select
            value={String(s.fontWeight ?? "")}
            options={[
              { value: "", label: "Default" },
              { value: "400", label: "Regular" },
              { value: "500", label: "Medium" },
              { value: "600", label: "Semibold" },
              { value: "700", label: "Bold" },
              { value: "800", label: "Extrabold" },
            ]}
            onChange={(v) => patchStyle(slideId, element.id, { fontWeight: v ? Number(v) : undefined })}
          />
        </Row>
        <Row label="Align">
          <div className="flex bg-surface-2 border border-border rounded-md p-0.5">
            {(
              [
                { v: "left", icon: AlignLeft },
                { v: "center", icon: AlignCenter },
                { v: "right", icon: AlignRight },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => patchStyle(slideId, element.id, { textAlign: o.v })}
                className={`p-1.5 rounded cursor-pointer ${
                  s.textAlign === o.v ? "bg-surface-3 text-text" : "text-text-tertiary hover:text-text"
                }`}
              >
                <o.icon size={13} />
              </button>
            ))}
          </div>
        </Row>
        <Row label="Text color">
          <ColorInput value={s.color ?? ""} onChange={(v) => patchStyle(slideId, element.id, { color: v })} />
        </Row>
        <Row label="Background">
          <ColorInput value={s.background ?? ""} onChange={(v) => patchStyle(slideId, element.id, { background: v })} />
        </Row>
        <Row label="Radius">
          <NumInput value={s.borderRadius} min={0} max={100} onChange={(v) => patchStyle(slideId, element.id, { borderRadius: v })} />
        </Row>
        <Row label="Padding">
          <NumInput value={s.padding} min={0} max={120} onChange={(v) => patchStyle(slideId, element.id, { padding: v })} />
        </Row>
      </Section>

      <Section title="Animation">
        <Row label="Entrance">
          <Select
            value={element.animation?.type ?? "none"}
            options={[
              { value: "none", label: "None" },
              { value: "fade", label: "Fade" },
              { value: "fade-up", label: "Fade up" },
              { value: "fade-down", label: "Fade down" },
              { value: "slide-left", label: "Slide left" },
              { value: "slide-right", label: "Slide right" },
              { value: "zoom", label: "Zoom" },
            ]}
            onChange={(type) =>
              geom({
                animation:
                  type === "none"
                    ? undefined
                    : { type, delay: element.animation?.delay ?? 0, duration: element.animation?.duration ?? 0.6 },
              })
            }
          />
        </Row>
        {element.animation && element.animation.type !== "none" && (
          <>
            <Row label="Delay (s)">
              <NumInput
                value={element.animation.delay}
                min={0}
                max={5}
                step={0.1}
                onChange={(delay) => geom({ animation: { ...element.animation!, delay } })}
              />
            </Row>
            <Row label="Duration (s)">
              <NumInput
                value={element.animation.duration}
                min={0.1}
                max={3}
                step={0.1}
                onChange={(duration) => geom({ animation: { ...element.animation!, duration } })}
              />
            </Row>
          </>
        )}
      </Section>
    </>
  );
}

/* --------------------------- per-type editors ---------------------- */

function ElementPropsEditor({ element, slideId }: { element: SlideElement; slideId: string }) {
  const patchProps = useEditorStore((s) => s.patchElementProps);
  const set = (patch: Record<string, unknown>) => patchProps(slideId, element.id, patch);

  switch (element.type) {
    case "heading":
      return (
        <Section title="Content">
          <TextArea value={element.props.text} onChange={(text) => set({ text })} />
          <Row label="Level">
            <Select
              value={String(element.props.level)}
              options={[
                { value: "1", label: "Title (H1)" },
                { value: "2", label: "Heading (H2)" },
                { value: "3", label: "Subheading (H3)" },
              ]}
              onChange={(v) => set({ level: Number(v) })}
            />
          </Row>
        </Section>
      );

    case "text":
      return (
        <Section title="Content">
          <TextArea value={element.props.text} rows={5} onChange={(text) => set({ text })} />
        </Section>
      );

    case "quote":
      return (
        <Section title="Content">
          <TextArea value={element.props.text} onChange={(text) => set({ text })} />
          <Row label="Attribution">
            <TextInput value={element.props.attribution ?? ""} onChange={(attribution) => set({ attribution })} />
          </Row>
        </Section>
      );

    case "list":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">One item per line</div>
          <TextArea
            value={element.props.items.join("\n")}
            rows={5}
            onChange={(v) => set({ items: linesToItems(v).length ? linesToItems(v) : [""] })}
          />
          <Row label="Marker">
            <Select
              value={element.props.marker}
              options={[
                { value: "dot", label: "Dot" },
                { value: "check", label: "Check" },
                { value: "arrow", label: "Arrow" },
                { value: "number", label: "Number" },
              ]}
              onChange={(marker) => set({ marker })}
            />
          </Row>
        </Section>
      );

    case "image":
      return <ImagePropsEditor element={element} slideId={slideId} />;

    case "stat":
      return (
        <Section title="Content">
          <div className="grid grid-cols-2 gap-2">
            <Row label="Value">
              <TextInput value={element.props.value} onChange={(value) => set({ value })} />
            </Row>
            <Row label="Suffix">
              <TextInput value={element.props.suffix ?? ""} onChange={(suffix) => set({ suffix })} />
            </Row>
          </div>
          <Row label="Prefix">
            <TextInput value={element.props.prefix ?? ""} onChange={(prefix) => set({ prefix })} />
          </Row>
          <Row label="Label">
            <TextInput value={element.props.label} onChange={(label) => set({ label })} />
          </Row>
          <Row label="Count up">
            <input
              type="checkbox"
              checked={element.props.countUp}
              onChange={(e) => set({ countUp: e.target.checked })}
              className="accent-[var(--color-accent)] w-4 h-4"
            />
          </Row>
        </Section>
      );

    case "chart":
      return <ChartPropsEditor element={element} slideId={slideId} />;

    case "table":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">
            First line = columns. Cells separated by “|”
          </div>
          <TextArea
            rows={6}
            value={[element.props.columns.join(" | "), ...element.props.rows.map((r) => r.join(" | "))].join("\n")}
            onChange={(v) => {
              const lines = v.split("\n").filter((l) => l.trim());
              if (lines.length === 0) return;
              const columns = lines[0].split("|").map((c) => c.trim());
              const rows = lines.slice(1).map((l) => {
                const cells = l.split("|").map((c) => c.trim());
                return Array.from({ length: columns.length }, (_, i) => cells[i] ?? "");
              });
              set({ columns, rows: rows.length ? rows : [columns.map(() => "")] });
            }}
          />
        </Section>
      );

    case "timeline":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">
            One per line: date | title | description
          </div>
          <TextArea
            rows={6}
            value={element.props.items.map((i) => [i.date, i.title, i.description ?? ""].join(" | ")).join("\n")}
            onChange={(v) => {
              const items = v
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [date = "", title = "", description = ""] = l.split("|").map((p) => p.trim());
                  return { date, title, description: description || undefined };
                });
              if (items.length >= 2) set({ items });
            }}
          />
          <Row label="Orientation">
            <Select
              value={element.props.orientation}
              options={[
                { value: "horizontal", label: "Horizontal" },
                { value: "vertical", label: "Vertical" },
              ]}
              onChange={(orientation) => set({ orientation })}
            />
          </Row>
        </Section>
      );

    case "tabs":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">One per line: label | title | content</div>
          <TextArea
            rows={6}
            value={element.props.tabs.map((t) => [t.label, t.title ?? "", t.content].join(" | ")).join("\n")}
            onChange={(v) => {
              const tabs = v
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [label = "", title = "", content = ""] = l.split("|").map((p) => p.trim());
                  return { label, title: title || undefined, content };
                });
              if (tabs.length >= 2) set({ tabs });
            }}
          />
        </Section>
      );

    case "accordion":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">One per line: title | content</div>
          <TextArea
            rows={6}
            value={element.props.items.map((i) => [i.title, i.content].join(" | ")).join("\n")}
            onChange={(v) => {
              const items = v
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [title = "", content = ""] = l.split("|").map((p) => p.trim());
                  return { title, content };
                });
              if (items.length >= 1) set({ items });
            }}
          />
        </Section>
      );

    case "comparison":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">
            Blocks separated by blank line. First line = title, rest = points. Prefix title with * to highlight.
          </div>
          <TextArea
            rows={8}
            value={element.props.items
              .map((i) => [`${i.highlighted ? "*" : ""}${i.title}`, ...i.points].join("\n"))
              .join("\n\n")}
            onChange={(v) => {
              const blocks = v.split(/\n\s*\n/).filter((b) => b.trim());
              const items = blocks.map((b) => {
                const lines = b.split("\n").filter((l) => l.trim());
                const rawTitle = lines[0] ?? "";
                return {
                  title: rawTitle.replace(/^\*/, "").trim(),
                  highlighted: rawTitle.startsWith("*"),
                  points: lines.slice(1).map((l) => l.trim()),
                };
              });
              if (items.length >= 2) set({ items });
            }}
          />
        </Section>
      );

    case "quiz":
      return (
        <Section title="Content">
          <Row label="Question">
            <span />
          </Row>
          <TextArea value={element.props.question} rows={2} onChange={(question) => set({ question })} />
          <div className="text-[11px] text-text-tertiary -mb-1">One option per line, prefix correct with *</div>
          <TextArea
            rows={4}
            value={element.props.options.map((o, i) => (i === element.props.correctIndex ? `*${o}` : o)).join("\n")}
            onChange={(v) => {
              const lines = v.split("\n").filter((l) => l.trim());
              if (lines.length < 2) return;
              let correctIndex = lines.findIndex((l) => l.startsWith("*"));
              if (correctIndex === -1) correctIndex = 0;
              set({ options: lines.map((l) => l.replace(/^\*/, "").trim()), correctIndex });
            }}
          />
          <Row label="Explanation">
            <span />
          </Row>
          <TextArea value={element.props.explanation ?? ""} rows={2} onChange={(explanation) => set({ explanation })} />
        </Section>
      );

    case "progress":
      return (
        <Section title="Content">
          <Row label="Label">
            <TextInput value={element.props.label} onChange={(label) => set({ label })} />
          </Row>
          <Row label="Value">
            <NumInput value={element.props.value} min={0} max={100} onChange={(value) => set({ value })} />
          </Row>
        </Section>
      );

    case "button":
      return (
        <Section title="Content">
          <Row label="Label">
            <TextInput value={element.props.label} onChange={(label) => set({ label })} />
          </Row>
          <Row label="Action">
            <Select
              value={element.props.action}
              options={[
                { value: "next-slide", label: "Next slide" },
                { value: "prev-slide", label: "Previous slide" },
                { value: "goto-slide", label: "Go to slide" },
                { value: "link", label: "Open link" },
              ]}
              onChange={(action) => set({ action })}
            />
          </Row>
          {element.props.action === "goto-slide" && (
            <Row label="Slide #">
              <NumInput
                value={(element.props.targetSlide ?? 0) + 1}
                min={1}
                onChange={(v) => set({ targetSlide: Math.max(0, v - 1) })}
              />
            </Row>
          )}
          {element.props.action === "link" && (
            <Row label="URL">
              <TextInput value={element.props.href ?? ""} placeholder="https://..." onChange={(href) => set({ href })} />
            </Row>
          )}
          <Row label="Variant">
            <Select
              value={element.props.variant}
              options={[
                { value: "primary", label: "Primary" },
                { value: "secondary", label: "Secondary" },
                { value: "ghost", label: "Ghost" },
              ]}
              onChange={(variant) => set({ variant })}
            />
          </Row>
        </Section>
      );

    case "shape":
      return (
        <Section title="Shape">
          <Row label="Type">
            <Select
              value={element.props.shape}
              options={[
                { value: "rect", label: "Rectangle" },
                { value: "circle", label: "Circle" },
                { value: "line", label: "Line" },
              ]}
              onChange={(shape) => set({ shape })}
            />
          </Row>
          <Row label="Fill">
            <ColorInput value={element.props.fill} onChange={(fill) => set({ fill })} />
          </Row>
        </Section>
      );

    case "map":
      return (
        <Section title="Map">
          <div className="grid grid-cols-2 gap-2">
            <Row label="Lat">
              <NumInput value={element.props.lat} step={0.01} onChange={(lat) => set({ lat })} />
            </Row>
            <Row label="Lng">
              <NumInput value={element.props.lng} step={0.01} onChange={(lng) => set({ lng })} />
            </Row>
          </div>
          <Row label="Zoom">
            <NumInput value={element.props.zoom} min={1} max={18} onChange={(zoom) => set({ zoom })} />
          </Row>
          <Row label="Label">
            <TextInput value={element.props.label ?? ""} onChange={(label) => set({ label })} />
          </Row>
        </Section>
      );

    case "video":
      return (
        <Section title="Video">
          <Row label="YouTube ID">
            <TextInput value={element.props.videoId} placeholder="dQw4w9WgXcQ" onChange={(videoId) => set({ videoId })} />
          </Row>
          <div className="text-[11px] text-text-tertiary">Plays in Preview and Present modes.</div>
        </Section>
      );

    case "icon":
      return (
        <Section title="Icon">
          <Row label="Name">
            <TextInput value={element.props.name} onChange={(name) => set({ name })} />
          </Row>
          <Row label="Color">
            <ColorInput value={element.props.color ?? ""} onChange={(color) => set({ color })} />
          </Row>
        </Section>
      );

    case "callout":
      return (
        <Section title="Content">
          <Row label="Kicker">
            <TextInput value={element.props.kicker} onChange={(kicker) => set({ kicker })} />
          </Row>
          <Row label="Title">
            <TextInput value={element.props.title} onChange={(title) => set({ title })} />
          </Row>
          <TextArea value={element.props.body} rows={4} onChange={(body) => set({ body })} />
          <Row label="Variant">
            <Select
              value={element.props.variant}
              options={[
                { value: "weak", label: "Weak / caveat" },
                { value: "insight", label: "Insight" },
                { value: "warning", label: "Warning" },
                { value: "note", label: "Note" },
              ]}
              onChange={(variant) => set({ variant })}
            />
          </Row>
        </Section>
      );

    case "flow":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">One per line: label | detail</div>
          <TextArea
            rows={6}
            value={element.props.steps.map((s) => [s.label, s.detail ?? ""].join(" | ")).join("\n")}
            onChange={(v) => {
              const steps = v
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [label = "", detail = ""] = l.split("|").map((p) => p.trim());
                  return { label, detail: detail || undefined };
                });
              if (steps.length >= 2) set({ steps });
            }}
          />
        </Section>
      );

    case "cards":
      return (
        <Section title="Content">
          <div className="text-[11px] text-text-tertiary -mb-1">One per line: number | title | body</div>
          <TextArea
            rows={6}
            value={element.props.cards.map((c) => [c.number ?? "", c.title, c.body].join(" | ")).join("\n")}
            onChange={(v) => {
              const cards = v
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [number = "", title = "", body = ""] = l.split("|").map((p) => p.trim());
                  return { number: number || undefined, title, body };
                });
              if (cards.length >= 2) set({ cards });
            }}
          />
        </Section>
      );

    case "embed":
      return (
        <Section title="HTML">
          <div className="text-[11px] text-text-tertiary -mb-1 leading-relaxed">
            Raw HTML/CSS, rendered in a sandboxed frame — scripts never run, even if pasted in.
          </div>
          <TextArea
            value={element.props.html}
            rows={10}
            onChange={(html) => set({ html })}
            mono
          />
        </Section>
      );

    default:
      return null;
  }
}

function ImagePropsEditor({
  element,
  slideId,
}: {
  element: Extract<SlideElement, { type: "image" }>;
  slideId: string;
}) {
  const patchProps = useEditorStore((s) => s.patchElementProps);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Record<string, unknown>) => patchProps(slideId, element.id, patch);

  async function upload(file: File) {
    setUploading(true);
    try {
      const res = await extractFile(file);
      if (res.imageUrl) set({ src: res.imageUrl, alt: file.name });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Section title="Image">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-[12.5px] text-text-secondary hover:text-text hover:border-border-strong transition-colors cursor-pointer w-full"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading..." : element.props.src ? "Replace image" : "Upload image"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <Row label="URL">
        <TextInput value={element.props.src} placeholder="https://..." onChange={(src) => set({ src })} />
      </Row>
      <Row label="Alt text">
        <TextInput value={element.props.alt} onChange={(alt) => set({ alt })} />
      </Row>
      <Row label="Fit">
        <Select
          value={element.props.fit}
          options={[
            { value: "cover", label: "Cover" },
            { value: "contain", label: "Contain" },
          ]}
          onChange={(fit) => set({ fit })}
        />
      </Row>
    </Section>
  );
}

function ChartPropsEditor({
  element,
  slideId,
}: {
  element: Extract<SlideElement, { type: "chart" }>;
  slideId: string;
}) {
  const patchProps = useEditorStore((s) => s.patchElementProps);
  const set = (patch: Record<string, unknown>) => patchProps(slideId, element.id, patch);
  const p = element.props;

  // Draft state so typing invalid intermediate values doesn't wipe data.
  const [labelsDraft, setLabelsDraft] = useState(p.labels.join(", "));
  const [seriesDraft, setSeriesDraft] = useState(
    p.series.map((sr) => `${sr.name}: ${sr.data.join(", ")}`).join("\n")
  );

  useEffect(() => {
    setLabelsDraft(p.labels.join(", "));
    setSeriesDraft(p.series.map((sr) => `${sr.name}: ${sr.data.join(", ")}`).join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]);

  function commit() {
    const labels = labelsDraft.split(",").map((l) => l.trim()).filter(Boolean);
    const series = seriesDraft
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const [name, rest] = line.includes(":") ? [line.split(":")[0], line.split(":").slice(1).join(":")] : ["Series", line];
        const data = rest.split(",").map((n) => Number(n.trim())).map((n) => (Number.isFinite(n) ? n : 0));
        return { name: name.trim() || "Series", data: Array.from({ length: labels.length }, (_, i) => data[i] ?? 0) };
      });
    if (labels.length && series.length) set({ labels, series });
  }

  return (
    <Section title="Chart">
      <Row label="Type">
        <Select
          value={p.chartType}
          options={[
            { value: "bar", label: "Bar" },
            { value: "line", label: "Line" },
            { value: "area", label: "Area" },
            { value: "pie", label: "Pie" },
            { value: "donut", label: "Donut" },
            { value: "radar", label: "Radar" },
          ]}
          onChange={(chartType) => set({ chartType })}
        />
      </Row>
      <Row label="Title">
        <TextInput value={p.title ?? ""} onChange={(title) => set({ title })} />
      </Row>
      <div className="text-[11px] text-text-tertiary -mb-1">Labels (comma-separated)</div>
      <TextArea value={labelsDraft} rows={2} onChange={setLabelsDraft} />
      <div className="text-[11px] text-text-tertiary -mb-1">Series — one per line: Name: 1, 2, 3</div>
      <TextArea value={seriesDraft} rows={3} onChange={setSeriesDraft} />
      <button
        onClick={commit}
        className="text-[12px] font-medium bg-surface-3 border border-border rounded-md py-1.5 hover:border-border-strong transition-colors cursor-pointer"
      >
        Apply data
      </button>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Legend">
          <input
            type="checkbox"
            checked={p.showLegend}
            onChange={(e) => set({ showLegend: e.target.checked })}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
        </Row>
        <Row label="Grid">
          <input
            type="checkbox"
            checked={p.showGrid}
            onChange={(e) => set({ showGrid: e.target.checked })}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
        </Row>
      </div>
    </Section>
  );
}
