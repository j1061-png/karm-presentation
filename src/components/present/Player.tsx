"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Presentation } from "@/lib/schema";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import {
  ChevronLeft, ChevronRight, X, Maximize, Minimize, Share2,
  LayoutGrid, StickyNote, HelpCircle,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandLogo";

/**
 * Fullscreen interactive presentation player.
 * Keyboard: ←/→/space navigate, Esc overview, N notes, ? help, F fullscreen.
 */
export function Player({
  presentation,
  onExit,
  onShare,
  embedded = false,
}: {
  presentation: Presentation;
  onExit?: () => void;
  onShare?: () => void;
  embedded?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const [help, setHelp] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const slides = presentation.slides;
  const slide = slides[Math.min(index, slides.length - 1)];
  const theme = presentation.theme;

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(slides.length - 1, next)));
      setOverview(false);
    },
    [slides.length]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = parseInt(window.location.hash.replace("#", ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= slides.length) setIndex(n - 1);
  }, [slides.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = `${window.location.pathname}${window.location.search}#${index + 1}`;
    window.history.replaceState(null, "", next);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (help) return setHelp(false);
        if (notes) return setNotes(false);
        if (overview) return setOverview(false);
        setOverview(true);
        return;
      }
      if (overview) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter" || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      else if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "o") setOverview((v) => !v);
      else if (e.key === "?" || e.key.toLowerCase() === "h") setHelp((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, overview, notes, help]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  }

  function poke() {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  }

  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const transition = slide.transition ?? "fade";
  const animName =
    transition === "none" ? undefined : `slide-in-${transition === "slide" ? "slide" : transition}`;

  return (
    <div
      ref={rootRef}
      className="w-full h-full relative select-none"
      style={{ background: theme.colors.background }}
      onMouseMove={poke}
      onClick={poke}
    >
      <FitStage>
        <div
          key={slide.id}
          className="w-full h-full"
          style={{
            animation: animName ? `${animName} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both` : undefined,
          }}
        >
          <SlideRenderer
            slide={slide}
            theme={theme}
            mode="live"
            animateKey={slide.id}
            rounded
            className="overflow-hidden"
            onAction={(a) => {
              if (a.type === "next-slide") go(index + 1);
              else if (a.type === "prev-slide") go(index - 1);
              else if (a.type === "goto-slide" && a.targetSlide !== undefined) go(a.targetSlide);
            }}
          />
        </div>
      </FitStage>

      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${((index + 1) / slides.length) * 100}%`, background: theme.colors.accent }}
        />
      </div>

      <div className="absolute bottom-5 left-5 pointer-events-none" style={{ opacity: controlsVisible ? 0.9 : 0.35 }}>
        <BrandMark size={28} />
      </div>

      {notes && slide.notes && (
        <div
          className="absolute left-5 bottom-20 max-w-md rounded-xl px-4 py-3 text-[13px] leading-relaxed z-20"
          style={{
            background: "rgba(10,11,13,0.88)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.82)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] mb-1.5" style={{ color: theme.colors.accent }}>
            Presenter notes
          </div>
          {slide.notes}
        </div>
      )}

      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2 py-1.5 transition-opacity duration-300 backdrop-blur-md z-20"
        style={{
          background: "rgba(10,11,13,0.75)",
          border: "1px solid rgba(255,255,255,0.1)",
          opacity: controlsVisible || overview || help ? 1 : 0,
          pointerEvents: controlsVisible || overview || help ? "auto" : "none",
        }}
      >
        <button
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 disabled:opacity-30 cursor-pointer"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="text-xs text-white/70 tabular-nums px-2 min-w-[52px] text-center cursor-pointer hover:text-white"
          onClick={() => setOverview((v) => !v)}
          aria-label="Slide overview"
        >
          {index + 1} / {slides.length}
        </button>
        <button
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 disabled:opacity-30 cursor-pointer"
          onClick={() => go(index + 1)}
          disabled={index === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-4 bg-white/15 mx-1" />
        <button
          className={`p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${overview ? "text-white" : "text-white/80"}`}
          onClick={() => setOverview((v) => !v)}
          aria-label="Grid overview"
          title="Overview (Esc)"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          className={`p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${notes ? "text-white" : "text-white/80"}`}
          onClick={() => setNotes((v) => !v)}
          aria-label="Presenter notes"
          title="Notes (N)"
        >
          <StickyNote size={15} />
        </button>
        <button
          className={`p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${help ? "text-white" : "text-white/80"}`}
          onClick={() => setHelp((v) => !v)}
          aria-label="Keyboard help"
          title="Help (?)"
        >
          <HelpCircle size={15} />
        </button>
        <button
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 cursor-pointer"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
        {onShare && (
          <button
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 cursor-pointer"
            onClick={onShare}
            aria-label="Share presentation"
          >
            <Share2 size={15} />
          </button>
        )}
        {onExit && !embedded && (
          <button
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 cursor-pointer"
            onClick={onExit}
            aria-label="Exit presentation"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!overview && (
        <>
          <button
            className="absolute left-0 top-0 bottom-10 w-[3%] cursor-w-resize opacity-0"
            onClick={() => go(index - 1)}
            aria-label="Previous"
            tabIndex={-1}
          />
          <button
            className="absolute right-0 top-0 bottom-10 w-[3%] cursor-e-resize opacity-0"
            onClick={() => go(index + 1)}
            aria-label="Next"
            tabIndex={-1}
          />
        </>
      )}

      {overview && (
        <div
          className="absolute inset-0 z-30 flex flex-col p-8"
          style={{ background: "rgba(8,9,12,0.88)" }}
          onClick={() => setOverview(false)}
        >
          <div className="text-white/70 text-[13px] mb-4">Where do you want to go?</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto" onClick={(e) => e.stopPropagation()}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                className={`text-left rounded-xl overflow-hidden border cursor-pointer ${
                  i === index ? "border-white" : "border-white/15 hover:border-white/40"
                }`}
              >
                <SlideRenderer slide={s} theme={theme} mode="thumb" />
                <div className="px-2.5 py-1.5 text-[11px] text-white/70 truncate">
                  {i + 1}. {s.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {help && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: "rgba(8,9,12,0.72)" }}
          onClick={() => setHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 text-[13px] text-white/80"
            style={{ background: "rgba(16,18,22,0.96)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold text-white mb-3">How to drive this deck</div>
            <ul className="space-y-1.5">
              <li>→ / Space — next slide</li>
              <li>← — previous slide</li>
              <li>Esc / G — grid overview</li>
              <li>N — presenter notes</li>
              <li>F — fullscreen</li>
              <li>? — this help</li>
              <li>Click stats, charts, flip cards, flows, callouts, quizzes</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Letterbox a 16:9 slide into whatever space the player actually has. */
function FitStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const pad = 24;
      const cw = Math.max(0, node.clientWidth - pad);
      const ch = Math.max(0, node.clientHeight - pad);
      if (cw < 2 || ch < 2) return;
      if (cw / ch > 16 / 9) setSize({ w: (ch * 16) / 9, h: ch });
      else setSize({ w: cw, h: (cw * 9) / 16 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center p-3">
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-lg"
        style={
          size.w > 0
            ? { width: size.w, height: size.h }
            : { width: "min(100%, calc((100vh - 120px) * 16 / 9))", aspectRatio: "16 / 9", maxHeight: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}
