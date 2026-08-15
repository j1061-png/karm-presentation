"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeSchema } from "@/lib/schema";
import { TEMPLATES, type Template } from "@/lib/templates";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { ChevronLeft, ChevronRight, LayoutTemplate, Loader2, MousePointerClick, X } from "lucide-react";

const CATEGORIES = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

export function TemplateGallery({
  busy,
  onUse,
}: {
  busy: string | null;
  onUse: (key: string) => void;
}) {
  const [category, setCategory] = useState("All");
  const [preview, setPreview] = useState<{ template: Template; index: number } | null>(null);

  const list = useMemo(
    () => (category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category)),
    [category]
  );

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
      if (e.key === "ArrowRight") {
        setPreview((p) =>
          p ? { ...p, index: Math.min(p.template.doc.slides.length - 1, p.index + 1) } : p
        );
      }
      if (e.key === "ArrowLeft") {
        setPreview((p) => (p ? { ...p, index: Math.max(0, p.index - 1) } : p));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-[17px] font-semibold tracking-tight mb-1">Templates</h1>
      <p className="text-[13px] text-text-secondary mb-5">
        Open a deck and click around — flip cards, quizzes, charts, maps. Then use it and swap in your content.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-[12.5px] px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              category === c
                ? "bg-text text-bg border-text font-medium"
                : "border-border text-text-secondary hover:text-text hover:border-border-strong"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((t) => (
          <TemplateCard
            key={t.key}
            template={t}
            busy={busy}
            onOpen={(index) => setPreview({ template: t, index })}
          />
        ))}
      </div>

      {preview && (
        <TemplatePreview
          template={preview.template}
          index={preview.index}
          busy={busy}
          onIndex={(index) => setPreview({ template: preview.template, index })}
          onClose={() => setPreview(null)}
          onUse={() => onUse(preview.template.key)}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  busy,
  onOpen,
}: {
  template: Template;
  busy: string | null;
  onOpen: (index: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const [index, setIndex] = useState(0);
  const theme = ThemeSchema.parse(template.doc.theme);
  const slides = template.doc.slides;

  useEffect(() => {
    if (!hover || slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [hover, slides.length]);

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setIndex(0);
      }}
      onClick={() => busy === null && onOpen(index)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && busy === null && onOpen(index)}
      className={`group text-left border border-border rounded-2xl overflow-hidden hover:border-border-strong transition-all cursor-pointer bg-surface hover:-translate-y-0.5 ${
        busy !== null ? "opacity-60 pointer-events-none" : ""
      }`}
      style={{ boxShadow: hover ? "0 12px 32px var(--shadow-color)" : undefined }}
    >
      <div className="relative pointer-events-none">
        <SlideRenderer slide={slides[index]} theme={theme} mode="thumb" animateKey={`${template.key}-${index}`} />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {slides.map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all"
              style={{
                width: i === index ? 14 : 6,
                background: i === index ? "white" : "rgba(255,255,255,0.45)",
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-[12px] font-medium bg-white text-black rounded-lg px-3 py-1.5 shadow-md flex items-center gap-1.5">
            <MousePointerClick size={12} />
            Try it live
          </span>
        </div>
      </div>
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[11px] font-medium text-text-tertiary">{template.category}</div>
          <div className="text-[11px] text-text-tertiary">{slides.length} slides</div>
        </div>
        <div className="text-[13.5px] font-medium">{template.name}</div>
        <div className="text-[12px] text-text-tertiary mt-0.5 leading-relaxed">{template.description}</div>
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-surface-2 text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({
  template,
  index,
  busy,
  onIndex,
  onClose,
  onUse,
}: {
  template: Template;
  index: number;
  busy: string | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onUse: () => void;
}) {
  const theme = ThemeSchema.parse(template.doc.theme);
  const slides = template.doc.slides;
  const slide = slides[Math.min(index, slides.length - 1)];

  function go(next: number) {
    onIndex(Math.max(0, Math.min(slides.length - 1, next)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-bg border border-border rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-text-tertiary">{template.category}</div>
            <div className="text-[14px] font-semibold truncate">{template.name}</div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-text-tertiary">
            <MousePointerClick size={12} />
            Click flip cards, tabs, quizzes, and charts
          </div>
          <button
            onClick={onUse}
            disabled={busy !== null}
            className="flex items-center gap-1.5 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy === template.key ? <Loader2 size={13} className="animate-spin" /> : <LayoutTemplate size={13} />}
            Use template
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 cursor-pointer"
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-black/40 p-3 sm:p-5 overflow-auto">
          <div className="mx-auto w-full" style={{ maxWidth: 920 }}>
            <SlideRenderer
              slide={slide}
              theme={theme}
              mode="live"
              animateKey={slide.id}
              rounded
              onAction={(a) => {
                if (a.type === "next-slide") go(index + 1);
                else if (a.type === "prev-slide") go(index - 1);
                else if (a.type === "goto-slide" && a.targetSlide !== undefined) go(a.targetSlide);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 flex gap-1.5 overflow-x-auto py-0.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onIndex(i)}
                className={`relative w-[88px] flex-shrink-0 rounded-md overflow-hidden border transition-colors cursor-pointer ${
                  i === index ? "border-accent" : "border-border hover:border-border-strong"
                }`}
                title={s.name}
              >
                <SlideRenderer slide={s} theme={theme} mode="thumb" />
              </button>
            ))}
          </div>
          <span className="text-[12px] text-text-tertiary tabular-nums w-10 text-right">
            {index + 1}/{slides.length}
          </span>
          <button
            onClick={() => go(index + 1)}
            disabled={index === slides.length - 1}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
