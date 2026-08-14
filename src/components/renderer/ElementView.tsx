"use client";

import { useEffect, useRef, useState } from "react";
import type { SlideElement, Theme } from "@/lib/schema";
import { ChartView } from "./ChartView";
import { getIcon } from "./icons";
import {
  Check, ArrowRight, ChevronDown, TrendingUp, TrendingDown, Minus,
  ImageIcon, Play, MapPin, Repeat,
} from "lucide-react";

export type RenderMode = "edit" | "live" | "thumb";

export interface RenderContext {
  theme: Theme;
  mode: RenderMode;
  onAction?: (action: { type: string; targetSlide?: number; href?: string }) => void;
}

/* ------------------------------------------------------------------ */
/* Small interactive helpers                                           */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, enabled: boolean, duration = 1200): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return value;
}

function formatStatValue(raw: string, animated: number, animate: boolean): string {
  const numMatch = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!numMatch || !animate) return raw;
  const num = parseFloat(numMatch[0]);
  const decimals = numMatch[1] ? numMatch[1].length - 1 : 0;
  const shown = (animated / 100) * num;
  return raw.replace(/,/g, "").replace(
    numMatch[0],
    shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );
}

/* ------------------------------------------------------------------ */
/* Element renderer                                                    */
/* ------------------------------------------------------------------ */

export function ElementView({ el, ctx }: { el: SlideElement; ctx: RenderContext }) {
  const { theme, mode } = ctx;
  const s = el.style ?? {};
  const live = mode === "live";
  const surface = theme.colors.surface;
  const border = theme.mode === "dark" ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.10)";

  const baseText: React.CSSProperties = {
    color: s.color ?? theme.colors.text,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    textAlign: s.textAlign,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
  };

  const boxStyle: React.CSSProperties = {
    background: s.background,
    borderRadius: s.borderRadius ?? theme.radius,
    padding: s.padding,
    border: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor ?? border}` : undefined,
    boxShadow: s.shadow ? "0 12px 40px rgba(0,0,0,0.35)" : undefined,
  };

  switch (el.type) {
    case "heading": {
      const sizes: Record<number, number> = { 1: 56, 2: 40, 3: 28 };
      return (
        <div
          className="w-full h-full flex flex-col justify-center whitespace-pre-wrap"
          style={{
            ...boxStyle,
            ...baseText,
            fontSize: s.fontSize ?? sizes[el.props.level] ?? 56,
            fontWeight: s.fontWeight ?? 650,
            letterSpacing: s.letterSpacing ?? -0.5,
            lineHeight: s.lineHeight ?? 1.1,
          }}
        >
          {el.props.text}
        </div>
      );
    }

    case "text":
      return (
        <div
          className="w-full h-full whitespace-pre-wrap"
          style={{ ...boxStyle, ...baseText, fontSize: s.fontSize ?? 20, lineHeight: s.lineHeight ?? 1.55, color: s.color ?? theme.colors.text }}
        >
          {el.props.text}
        </div>
      );

    case "list": {
      const Marker = ({ i }: { i: number }) => {
        if (el.props.marker === "check")
          return <Check size={"1em"} style={{ color: theme.colors.accent, flexShrink: 0, marginTop: "0.25em" }} />;
        if (el.props.marker === "arrow")
          return <ArrowRight size={"1em"} style={{ color: theme.colors.accent, flexShrink: 0, marginTop: "0.25em" }} />;
        if (el.props.marker === "number" || el.props.ordered)
          return (
            <span
              className="flex items-center justify-center rounded-full flex-shrink-0 font-semibold"
              style={{
                background: `color-mix(in srgb, ${theme.colors.accent} 18%, transparent)`,
                color: theme.colors.accent,
                width: "1.5em", height: "1.5em", fontSize: "0.75em", marginTop: "0.1em",
              }}
            >
              {i + 1}
            </span>
          );
        return (
          <span
            className="rounded-full flex-shrink-0"
            style={{ background: theme.colors.accent, width: "0.4em", height: "0.4em", marginTop: "0.55em" }}
          />
        );
      };
      return (
        <div className="w-full h-full flex flex-col justify-center gap-[0.7em]" style={{ ...boxStyle, ...baseText, fontSize: s.fontSize ?? 20 }}>
          {el.props.items.map((item, i) => (
            <div key={i} className="flex gap-[0.6em] items-start" style={{ lineHeight: s.lineHeight ?? 1.45 }}>
              <Marker i={i} />
              <span className="whitespace-pre-wrap">{item}</span>
            </div>
          ))}
        </div>
      );
    }

    case "quote":
      return (
        <div
          className="w-full h-full flex flex-col justify-center"
          style={{ ...boxStyle, paddingLeft: s.padding ?? 28, borderLeft: `3px solid ${theme.colors.accent}` }}
        >
          <div style={{ ...baseText, fontSize: s.fontSize ?? 28, fontWeight: s.fontWeight ?? 500, lineHeight: 1.4, fontStyle: "italic" }}>
            “{el.props.text}”
          </div>
          {el.props.attribution && (
            <div className="mt-3" style={{ color: theme.colors.muted, fontSize: (s.fontSize ?? 28) * 0.55 }}>
              — {el.props.attribution}
            </div>
          )}
        </div>
      );

    case "image":
      if (!el.props.src) {
        return (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ ...boxStyle, background: s.background ?? surface, border: `1px dashed ${border}` }}
          >
            <ImageIcon size={28} style={{ color: theme.colors.muted }} />
            <span style={{ color: theme.colors.muted, fontSize: 13 }}>
              {el.props.alt || "Drop an image here"}
            </span>
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={el.props.src}
          alt={el.props.alt}
          draggable={false}
          className="w-full h-full"
          style={{ ...boxStyle, objectFit: el.props.fit, borderRadius: s.borderRadius ?? theme.radius }}
        />
      );

    case "stat": {
      const Icon = el.props.icon ? getIcon(el.props.icon) : null;
      return <StatView el={el} ctx={ctx} boxStyle={boxStyle} Icon={Icon} />;
    }

    case "chart":
      return (
        <div className="w-full h-full" style={{ ...boxStyle, background: s.background ?? surface, padding: s.padding ?? 18, border: s.borderWidth !== 0 ? `1px solid ${border}` : undefined }}>
          <ChartView props={el.props} theme={theme} animate={live} />
        </div>
      );

    case "table":
      return (
        <div className="w-full h-full overflow-auto" style={{ ...boxStyle, background: s.background ?? surface, border: `1px solid ${border}` }}>
          <table className="w-full border-collapse" style={{ fontSize: s.fontSize ?? (el.props.compact ? 14 : 16) }}>
            <thead>
              <tr>
                {el.props.columns.map((c, i) => (
                  <th
                    key={i}
                    className="text-left font-semibold"
                    style={{
                      padding: el.props.compact ? "8px 14px" : "12px 18px",
                      color: i === el.props.highlightColumn ? theme.colors.accent : theme.colors.text,
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {el.props.rows.map((row, r) => (
                <tr key={r} className={live ? "pk-row-hover" : ""} style={{ color: theme.colors.text }}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      style={{
                        padding: el.props.compact ? "7px 14px" : "10px 18px",
                        borderBottom: r < el.props.rows.length - 1 ? `1px solid ${border}` : undefined,
                        color: c === el.props.highlightColumn ? theme.colors.accent : undefined,
                        fontWeight: c === 0 ? 500 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "comparison":
      return (
        <div className="w-full h-full flex gap-4">
          {el.props.items.map((item, i) => (
            <div
              key={i}
              className={`flex-1 flex flex-col ${live ? "pk-lift" : ""}`}
              style={{
                ...boxStyle,
                background: surface,
                padding: s.padding ?? 22,
                border: item.highlighted ? `1.5px solid ${theme.colors.accent}` : `1px solid ${border}`,
                transform: undefined,
              }}
            >
              {item.badge && (
                <span
                  className="self-start text-[11px] font-semibold rounded-full px-2.5 py-1 mb-3"
                  style={{ background: `color-mix(in srgb, ${theme.colors.accent} 20%, transparent)`, color: theme.colors.accent }}
                >
                  {item.badge}
                </span>
              )}
              <div style={{ color: theme.colors.text, fontSize: s.fontSize ?? 20, fontWeight: 600 }}>{item.title}</div>
              {item.subtitle && (
                <div className="mt-1" style={{ color: theme.colors.muted, fontSize: (s.fontSize ?? 20) * 0.7 }}>
                  {item.subtitle}
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2.5">
                {item.points.map((p, j) => (
                  <div key={j} className="flex items-start gap-2" style={{ color: theme.colors.text, fontSize: (s.fontSize ?? 20) * 0.72, lineHeight: 1.4 }}>
                    <Check size={14} style={{ color: theme.colors.accent, marginTop: 3, flexShrink: 0 }} />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    case "timeline":
      return <TimelineView el={el} ctx={ctx} border={border} />;

    case "flipcards":
      return <FlipCardsView el={el} ctx={ctx} border={border} />;

    case "tabs":
      return <TabsView el={el} ctx={ctx} border={border} boxStyle={boxStyle} />;

    case "accordion":
      return <AccordionView el={el} ctx={ctx} border={border} boxStyle={boxStyle} />;

    case "quiz":
      return <QuizView el={el} ctx={ctx} border={border} boxStyle={boxStyle} />;

    case "progress":
      return <ProgressView el={el} ctx={ctx} boxStyle={boxStyle} />;

    case "button": {
      const variants: Record<string, React.CSSProperties> = {
        primary: { background: theme.colors.accent, color: theme.colors.accentText },
        secondary: { background: surface, color: theme.colors.text, border: `1px solid ${border}` },
        ghost: { background: "transparent", color: theme.colors.accent, border: `1px solid ${theme.colors.accent}` },
      };
      return (
        <button
          className="w-full h-full flex items-center justify-center gap-2 font-medium transition-all duration-150 hover:brightness-110 active:scale-[0.98] cursor-pointer"
          style={{ ...variants[el.props.variant], borderRadius: s.borderRadius ?? 10, fontSize: s.fontSize ?? 17 }}
          onClick={(e) => {
            if (!live) return;
            e.stopPropagation();
            if (el.props.action === "link" && el.props.href) {
              window.open(el.props.href, "_blank", "noopener,noreferrer");
            } else {
              ctx.onAction?.({ type: el.props.action, targetSlide: el.props.targetSlide, href: el.props.href });
            }
          }}
        >
          {el.props.label}
          <ArrowRight size={"0.9em"} />
        </button>
      );
    }

    case "shape":
      if (el.props.shape === "line") {
        return <div className="w-full" style={{ height: Math.max(2, s.borderWidth ?? 3), background: el.props.fill, borderRadius: 2, marginTop: "auto", marginBottom: "auto" }} />;
      }
      return (
        <div
          className="w-full h-full"
          style={{
            background: el.props.fill,
            borderRadius: el.props.shape === "circle" ? "50%" : s.borderRadius ?? theme.radius,
            boxShadow: s.shadow ? "0 12px 40px rgba(0,0,0,0.35)" : undefined,
          }}
        />
      );

    case "video":
      if (!el.props.videoId || mode !== "live") {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ ...boxStyle, background: surface, border: `1px solid ${border}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `color-mix(in srgb, ${theme.colors.accent} 20%, transparent)` }}>
              <Play size={20} style={{ color: theme.colors.accent, marginLeft: 2 }} />
            </div>
            <span style={{ color: theme.colors.muted, fontSize: 13 }}>
              {el.props.videoId ? "Video plays in Present mode" : "No video set"}
            </span>
          </div>
        );
      }
      return (
        <iframe
          className="w-full h-full"
          style={{ borderRadius: s.borderRadius ?? theme.radius, border: 0 }}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(el.props.videoId)}`}
          title="Video"
          allow="accelerometer; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      );

    case "map": {
      const { lat, lng, zoom } = el.props;
      if (mode !== "live") {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ ...boxStyle, background: surface, border: `1px solid ${border}` }}>
            <MapPin size={24} style={{ color: theme.colors.accent }} />
            <span style={{ color: theme.colors.muted, fontSize: 13 }}>
              Interactive map — {el.props.label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`}
            </span>
          </div>
        );
      }
      const d = 360 / Math.pow(2, zoom);
      const bbox = [lng - d, lat - d / 2, lng + d, lat + d / 2].map((n) => n.toFixed(5)).join("%2C");
      return (
        <div className="w-full h-full relative" style={{ borderRadius: s.borderRadius ?? theme.radius, overflow: "hidden" }}>
          <iframe
            className="w-full h-full"
            style={{ border: 0, filter: theme.mode === "dark" ? "invert(0.9) hue-rotate(180deg) saturate(0.7)" : undefined }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`}
            title={el.props.label || "Map"}
            sandbox="allow-scripts allow-same-origin"
          />
          {el.props.label && (
            <div
              className="absolute bottom-3 left-3 text-[13px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ background: theme.colors.surface, color: theme.colors.text, border: `1px solid ${border}` }}
            >
              <MapPin size={13} style={{ color: theme.colors.accent }} />
              {el.props.label}
            </div>
          )}
        </div>
      );
    }

    case "icon": {
      const Icon = getIcon(el.props.name);
      return (
        <div className="w-full h-full flex items-center justify-center" style={boxStyle}>
          <Icon style={{ color: el.props.color ?? theme.colors.accent, width: "70%", height: "70%" }} strokeWidth={1.8} />
        </div>
      );
    }

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Stateful interactive sub-components                                 */
/* ------------------------------------------------------------------ */

function StatView({
  el, ctx, boxStyle, Icon,
}: {
  el: Extract<SlideElement, { type: "stat" }>;
  ctx: RenderContext;
  boxStyle: React.CSSProperties;
  Icon: ReturnType<typeof getIcon> | null;
}) {
  const { theme, mode } = ctx;
  const animate = mode === "live" && el.props.countUp;
  const progress = useCountUp(100, animate);
  const s = el.style ?? {};
  const trendIcon =
    el.props.trend?.direction === "up" ? <TrendingUp size={"1em"} /> :
    el.props.trend?.direction === "down" ? <TrendingDown size={"1em"} /> : <Minus size={"1em"} />;
  const trendColor =
    el.props.trend?.direction === "up" ? "#43c98a" :
    el.props.trend?.direction === "down" ? "#f0554d" : theme.colors.muted;

  return (
    <div
      className={`w-full h-full flex flex-col justify-center ${mode === "live" ? "pk-lift" : ""}`}
      style={{
        ...boxStyle,
        background: s.background ?? theme.colors.surface,
        padding: s.padding ?? 22,
        border: `1px solid ${theme.mode === "dark" ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)"}`,
      }}
    >
      {Icon && (
        <div
          className="w-[2.2em] h-[2.2em] rounded-[0.6em] flex items-center justify-center mb-[0.8em]"
          style={{ background: `color-mix(in srgb, ${theme.colors.accent} 16%, transparent)`, fontSize: (s.fontSize ?? 44) * 0.42 }}
        >
          <Icon style={{ color: theme.colors.accent, width: "60%", height: "60%" }} />
        </div>
      )}
      <div className="flex items-baseline gap-1.5 tabular-nums" style={{ color: s.color ?? theme.colors.text, fontSize: s.fontSize ?? 44, fontWeight: s.fontWeight ?? 650, letterSpacing: -1 }}>
        {el.props.prefix}
        {formatStatValue(el.props.value, progress, animate)}
        {el.props.suffix && <span style={{ color: theme.colors.accent }}>{el.props.suffix}</span>}
      </div>
      <div className="flex items-center gap-2 mt-[0.35em]" style={{ fontSize: (s.fontSize ?? 44) * 0.34 }}>
        <span style={{ color: theme.colors.muted }}>{el.props.label}</span>
        {el.props.trend && (
          <span className="flex items-center gap-1 font-medium" style={{ color: trendColor }}>
            {trendIcon}
            {el.props.trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

function FlipCardsView({
  el, ctx, border,
}: {
  el: Extract<SlideElement, { type: "flipcards" }>;
  ctx: RenderContext;
  border: string;
}) {
  const { theme, mode } = ctx;
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const s = el.style ?? {};
  const fontSize = s.fontSize ?? 18;

  function toggle(i: number) {
    if (mode === "thumb") return;
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="w-full h-full flex gap-[0.9em]" style={{ fontSize }}>
      {el.props.cards.map((card, i) => {
        const Icon = card.icon ? getIcon(card.icon) : null;
        const isFlipped = flipped.has(i);
        return (
          <div
            key={i}
            className={`pk-flip flex-1 cursor-pointer ${isFlipped ? "flipped" : ""} ${mode === "live" ? "pk-lift" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle(i);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(i)}
            style={{ borderRadius: s.borderRadius ?? theme.radius }}
          >
            <div className="pk-flip-inner">
              {/* Front */}
              <div
                className="pk-face flex flex-col items-center justify-center gap-[0.6em] text-center p-[1em]"
                style={{
                  background: s.background ?? theme.colors.surface,
                  border: `1px solid ${border}`,
                  borderRadius: s.borderRadius ?? theme.radius,
                }}
              >
                {Icon && (
                  <div
                    className="w-[2.4em] h-[2.4em] rounded-[0.7em] flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${theme.colors.accent} 16%, transparent)` }}
                  >
                    <Icon style={{ color: theme.colors.accent, width: "55%", height: "55%" }} />
                  </div>
                )}
                <div className="font-semibold" style={{ color: theme.colors.text, fontSize: "1em", lineHeight: 1.3 }}>
                  {card.front}
                </div>
                <div className="flex items-center gap-1 absolute bottom-[0.7em] right-[0.9em]" style={{ color: theme.colors.muted, fontSize: "0.6em" }}>
                  <Repeat size={"1em"} />
                  {mode !== "thumb" && "flip"}
                </div>
              </div>
              {/* Back */}
              <div
                className="pk-face pk-face-back flex items-center justify-center text-center p-[1.1em]"
                style={{
                  background: `color-mix(in srgb, ${theme.colors.accent} 14%, ${theme.colors.surface})`,
                  border: `1px solid color-mix(in srgb, ${theme.colors.accent} 45%, transparent)`,
                  borderRadius: s.borderRadius ?? theme.radius,
                }}
              >
                <div style={{ color: theme.colors.text, fontSize: "0.78em", lineHeight: 1.5 }}>
                  {card.back}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ el, ctx, border }: { el: Extract<SlideElement, { type: "timeline" }>; ctx: RenderContext; border: string }) {
  const { theme, mode } = ctx;
  const [active, setActive] = useState(0);
  const s = el.style ?? {};
  const horizontal = el.props.orientation === "horizontal";
  const fontSize = s.fontSize ?? 16;

  if (horizontal) {
    return (
      <div className="w-full h-full flex flex-col justify-center" style={{ fontSize }}>
        <div className="relative flex items-start justify-between">
          <div className="absolute left-0 right-0 h-[2px]" style={{ background: border, top: "0.55em" }} />
          <div
            className="absolute left-0 h-[2px] transition-all duration-500"
            style={{ background: theme.colors.accent, top: "0.55em", width: `${((active + 0.5) / el.props.items.length) * 100}%` }}
          />
          {el.props.items.map((item, i) => (
            <button
              key={i}
              className="relative flex flex-col items-center cursor-pointer text-center"
              style={{ width: `${100 / el.props.items.length}%` }}
              onClick={() => mode !== "thumb" && setActive(i)}
              onMouseEnter={() => mode === "live" && setActive(i)}
            >
              <span
                className="rounded-full transition-all duration-300 border-2"
                style={{
                  width: "1.1em", height: "1.1em",
                  background: i <= active ? theme.colors.accent : theme.colors.surface,
                  borderColor: i <= active ? theme.colors.accent : border,
                }}
              />
              <span className="mt-[0.8em] font-semibold" style={{ color: i === active ? theme.colors.accent : theme.colors.muted, fontSize: "0.8em" }}>
                {item.date}
              </span>
              <span className="mt-[0.2em] font-medium px-1" style={{ color: theme.colors.text, fontSize: "0.85em", opacity: i === active ? 1 : 0.65 }}>
                {item.title}
              </span>
              {i === active && item.description && (
                <span className="mt-[0.35em] px-2 animate-in-fade" style={{ color: theme.colors.muted, fontSize: "0.72em", lineHeight: 1.4 }}>
                  {item.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-center gap-0 overflow-auto" style={{ fontSize }}>
      {el.props.items.map((item, i) => (
        <button
          key={i}
          className="flex gap-[1em] text-left cursor-pointer group"
          onClick={() => mode !== "thumb" && setActive(i)}
          onMouseEnter={() => mode === "live" && setActive(i)}
        >
          <div className="flex flex-col items-center">
            <span
              className="rounded-full border-2 transition-all duration-300 flex-shrink-0"
              style={{
                width: "1em", height: "1em", marginTop: "0.3em",
                background: i <= active ? theme.colors.accent : theme.colors.surface,
                borderColor: i <= active ? theme.colors.accent : border,
              }}
            />
            {i < el.props.items.length - 1 && (
              <span className="w-[2px] flex-1 min-h-[1.2em]" style={{ background: i < active ? theme.colors.accent : border }} />
            )}
          </div>
          <div className="pb-[1.1em]">
            <div className="font-semibold" style={{ color: i === active ? theme.colors.accent : theme.colors.muted, fontSize: "0.78em" }}>
              {item.date}
            </div>
            <div className="font-medium" style={{ color: theme.colors.text, fontSize: "0.95em", opacity: i === active ? 1 : 0.75 }}>
              {item.title}
            </div>
            {item.description && (i === active || mode === "thumb") && (
              <div className="mt-[0.2em] animate-in-fade" style={{ color: theme.colors.muted, fontSize: "0.78em", lineHeight: 1.45 }}>
                {item.description}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function TabsView({ el, ctx, border, boxStyle }: { el: Extract<SlideElement, { type: "tabs" }>; ctx: RenderContext; border: string; boxStyle: React.CSSProperties }) {
  const { theme, mode } = ctx;
  const [active, setActive] = useState(0);
  const s = el.style ?? {};
  const tab = el.props.tabs[Math.min(active, el.props.tabs.length - 1)];
  return (
    <div className="w-full h-full flex flex-col" style={{ ...boxStyle, background: s.background ?? theme.colors.surface, border: `1px solid ${border}`, overflow: "hidden" }}>
      <div className="flex border-b" style={{ borderColor: border }}>
        {el.props.tabs.map((t, i) => (
          <button
            key={i}
            className="px-[1.2em] py-[0.8em] font-medium transition-colors cursor-pointer relative"
            style={{ color: i === active ? theme.colors.text : theme.colors.muted, fontSize: (s.fontSize ?? 16) * 0.95 }}
            onClick={() => mode !== "thumb" && setActive(i)}
          >
            {t.label}
            {i === active && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: theme.colors.accent }} />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 p-[1.4em] overflow-auto animate-in-fade" key={active}>
        {tab?.title && (
          <div className="font-semibold mb-[0.5em]" style={{ color: theme.colors.text, fontSize: (s.fontSize ?? 16) * 1.15 }}>
            {tab.title}
          </div>
        )}
        <div className="whitespace-pre-wrap" style={{ color: theme.colors.muted, fontSize: s.fontSize ?? 16, lineHeight: 1.6 }}>
          {tab?.content}
        </div>
      </div>
    </div>
  );
}

function AccordionView({ el, ctx, border, boxStyle }: { el: Extract<SlideElement, { type: "accordion" }>; ctx: RenderContext; border: string; boxStyle: React.CSSProperties }) {
  const { theme, mode } = ctx;
  const [open, setOpen] = useState<number | null>(0);
  const s = el.style ?? {};
  return (
    <div className="w-full h-full flex flex-col overflow-auto" style={{ ...boxStyle, background: s.background ?? theme.colors.surface, border: `1px solid ${border}`, overflow: "auto" }}>
      {el.props.items.map((item, i) => (
        <div key={i} style={{ borderBottom: i < el.props.items.length - 1 ? `1px solid ${border}` : undefined }}>
          <button
            className="w-full flex items-center justify-between px-[1.3em] py-[1em] cursor-pointer text-left transition-colors hover:bg-white/[0.03]"
            onClick={() => mode !== "thumb" && setOpen(open === i ? null : i)}
          >
            <span className="font-medium" style={{ color: open === i ? theme.colors.accent : theme.colors.text, fontSize: s.fontSize ?? 17 }}>
              {item.title}
            </span>
            <ChevronDown
              size={"1em"}
              className="transition-transform duration-200 flex-shrink-0"
              style={{ color: theme.colors.muted, transform: open === i ? "rotate(180deg)" : undefined }}
            />
          </button>
          {open === i && (
            <div className="px-[1.3em] pb-[1.1em] whitespace-pre-wrap animate-in-fade" style={{ color: theme.colors.muted, fontSize: (s.fontSize ?? 17) * 0.88, lineHeight: 1.6 }}>
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuizView({ el, ctx, border, boxStyle }: { el: Extract<SlideElement, { type: "quiz" }>; ctx: RenderContext; border: string; boxStyle: React.CSSProperties }) {
  const { theme, mode } = ctx;
  const [picked, setPicked] = useState<number | null>(null);
  const s = el.style ?? {};
  const answered = picked !== null;
  return (
    <div className="w-full h-full flex flex-col justify-center gap-[0.9em]" style={{ ...boxStyle, background: s.background ?? theme.colors.surface, border: `1px solid ${border}`, padding: s.padding ?? 26 }}>
      <div className="font-semibold" style={{ color: theme.colors.text, fontSize: s.fontSize ?? 22 }}>
        {el.props.question}
      </div>
      <div className="flex flex-col gap-[0.5em]">
        {el.props.options.map((opt, i) => {
          const isCorrect = i === el.props.correctIndex;
          const isPicked = picked === i;
          let bg = "transparent";
          let borderColor = border;
          if (answered && isCorrect) { bg = "color-mix(in srgb, #43c98a 15%, transparent)"; borderColor = "#43c98a"; }
          else if (answered && isPicked) { bg = "color-mix(in srgb, #f0554d 14%, transparent)"; borderColor = "#f0554d"; }
          return (
            <button
              key={i}
              disabled={answered}
              className="text-left px-[1em] py-[0.7em] rounded-[0.6em] border transition-all cursor-pointer hover:border-white/25 disabled:cursor-default"
              style={{ background: bg, borderColor, color: theme.colors.text, fontSize: (s.fontSize ?? 22) * 0.75 }}
              onClick={() => mode !== "thumb" && setPicked(i)}
            >
              <span className="font-semibold mr-2" style={{ color: theme.colors.accent }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
              {answered && isCorrect && <Check size={"1em"} className="inline ml-2" style={{ color: "#43c98a" }} />}
            </button>
          );
        })}
      </div>
      {answered && el.props.explanation && (
        <div className="animate-in-fade" style={{ color: theme.colors.muted, fontSize: (s.fontSize ?? 22) * 0.68, lineHeight: 1.5 }}>
          {el.props.explanation}
        </div>
      )}
    </div>
  );
}

function ProgressView({ el, ctx, boxStyle }: { el: Extract<SlideElement, { type: "progress" }>; ctx: RenderContext; boxStyle: React.CSSProperties }) {
  const { theme, mode } = ctx;
  const animated = useCountUp(el.props.value, mode === "live", 1000);
  const value = mode === "live" ? animated : el.props.value;
  const s = el.style ?? {};
  return (
    <div className="w-full h-full flex flex-col justify-center gap-[0.5em]" style={{ ...boxStyle, fontSize: s.fontSize ?? 16 }}>
      <div className="flex items-baseline justify-between">
        <span className="font-medium" style={{ color: s.color ?? theme.colors.text }}>{el.props.label}</span>
        {el.props.showValue && (
          <span className="font-semibold tabular-nums" style={{ color: theme.colors.accent }}>
            {Math.round(value)}{el.props.suffix}
          </span>
        )}
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: "0.55em", background: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: theme.colors.accent, transition: mode === "live" ? undefined : "width 0.3s" }}
        />
      </div>
    </div>
  );
}
