"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Presentation } from "@/lib/schema";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { ChevronLeft, ChevronRight, X, Maximize, Minimize, Share2 } from "lucide-react";

/**
 * Fullscreen interactive presentation player.
 * Keyboard: ←/→/space/enter navigate, F fullscreen, Esc exits.
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const slides = presentation.slides;
  const slide = slides[Math.min(index, slides.length - 1)];
  const theme = presentation.theme;

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(slides.length - 1, next)));
    },
    [slides.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter" || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key === "Escape" && onExit && !document.fullscreenElement) onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, onExit]);

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
      {/* Slide area — letterboxed 16:9 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          key={slide.id}
          className="w-full max-h-full"
          style={{
            maxWidth: "calc(100vh * 16 / 9)",
            animation: animName ? `${animName} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both` : undefined,
          }}
        >
          <SlideRenderer
            slide={slide}
            theme={theme}
            mode="live"
            animateKey={slide.id}
            onAction={(a) => {
              if (a.type === "next-slide") go(index + 1);
              else if (a.type === "prev-slide") go(index - 1);
              else if (a.type === "goto-slide" && a.targetSlide !== undefined) go(a.targetSlide);
            }}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${((index + 1) / slides.length) * 100}%`, background: theme.colors.accent }}
        />
      </div>

      {/* Controls */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2 py-1.5 transition-opacity duration-300 backdrop-blur-md"
        style={{
          background: "rgba(10,11,13,0.75)",
          border: "1px solid rgba(255,255,255,0.1)",
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
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
        <span className="text-xs text-white/70 tabular-nums px-2 min-w-[52px] text-center">
          {index + 1} / {slides.length}
        </span>
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

      {/* Click zones for navigation on edges */}
      <button
        className="absolute left-0 top-0 bottom-10 w-[8%] cursor-w-resize opacity-0"
        onClick={() => go(index - 1)}
        aria-label="Previous"
        tabIndex={-1}
      />
      <button
        className="absolute right-0 top-0 bottom-10 w-[8%] cursor-e-resize opacity-0"
        onClick={() => go(index + 1)}
        aria-label="Next"
        tabIndex={-1}
      />
    </div>
  );
}
