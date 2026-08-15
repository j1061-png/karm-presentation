"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Slide, SlideElement, Theme } from "@/lib/schema";
import { ElementView, type RenderContext, type RenderMode } from "./ElementView";
import { ParticleField } from "./ParticleField";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export function slideBackgroundCss(slide: Slide, theme: Theme): React.CSSProperties {
  const bg = slide.background;
  if (!bg) return { background: theme.colors.background };
  if (bg.type === "gradient" && bg.gradientFrom && bg.gradientTo) {
    return {
      background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.gradientFrom}, ${bg.gradientTo})`,
    };
  }
  if (bg.type === "image" && bg.imageSrc) {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,${bg.overlayOpacity ?? 0.5}), rgba(0,0,0,${bg.overlayOpacity ?? 0.5})), url(${bg.imageSrc})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: bg.color ?? theme.colors.background };
}

function animationCss(el: SlideElement, animate: boolean): React.CSSProperties {
  const anim = el.animation;
  if (!animate || !anim || anim.type === "none") return { opacity: el.opacity };
  return {
    opacity: 0,
    animationName: `el-${anim.type}`,
    animationDuration: `${anim.duration}s`,
    animationDelay: `${anim.delay}s`,
    animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    animationFillMode: "forwards",
  };
}

export interface SlideRendererProps {
  slide: Slide;
  theme: Theme;
  mode: RenderMode;
  /** Re-runs entrance animations when this changes (e.g. slide becomes active). */
  animateKey?: string | number;
  onAction?: RenderContext["onAction"];
  /** Editor hooks — wraps each element for selection/drag. */
  elementWrapper?: (el: SlideElement, child: ReactNode) => ReactNode;
  /** Hidden while the editor shows its inline text editor on top. */
  hideElementId?: string | null;
  className?: string;
  rounded?: boolean;
}

/**
 * Renders a slide from the structured model. The inner canvas is a fixed
 * 1280x720 design space scaled to fit its container, so coordinates and
 * font sizes are consistent everywhere (thumbnails, editor, present mode).
 */
export function SlideRenderer({
  slide,
  theme,
  mode,
  animateKey,
  onAction,
  elementWrapper,
  hideElementId,
  className,
  rounded,
}: SlideRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const ctx: RenderContext = { theme, mode, onAction };
  const animate = mode === "live";
  const sorted = [...slide.elements].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        aspectRatio: "16 / 9",
        position: "relative",
        overflow: "hidden",
        borderRadius: rounded ? 10 : 0,
        ...slideBackgroundCss(slide, theme),
      }}
    >
      {slide.background?.particles && mode !== "thumb" && (
        <ParticleField color={theme.colors.accent} />
      )}
      {scale > 0 && (
        <div
          key={animateKey}
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {sorted.map((el) => {
            const inner = (
              <div
                key={el.id}
                data-element-id={el.id}
                style={{
                  position: "absolute",
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                  zIndex: el.z,
                  visibility: el.id === hideElementId ? "hidden" : undefined,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  ["--el-opacity" as string]: el.opacity,
                  ...animationCss(el, animate),
                }}
              >
                <ElementView el={el} ctx={ctx} />
              </div>
            );
            return elementWrapper ? (
              <div key={el.id} style={{ display: "contents" }}>{elementWrapper(el, inner)}</div>
            ) : (
              inner
            );
          })}
        </div>
      )}
    </div>
  );
}
