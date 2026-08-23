"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Gauge, Sparkles, Zap, Brain, Rocket } from "lucide-react";
import { EFFORT, EFFORT_LEVELS, type Effort } from "@/lib/effort";

const ICONS: Record<Effort, typeof Zap> = {
  instant: Zap,
  fast: Gauge,
  standard: Sparkles,
  think: Brain,
  max: Rocket,
};

export function EffortPicker({
  value,
  onChange,
  disabled,
}: {
  value: Effort;
  onChange: (next: Effort) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Current = ICONS[value];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={EFFORT[value].hint}
      >
        <Current size={13} className="text-accent" />
        <span className="font-medium">{EFFORT[value].label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-[300px] rounded-2xl border border-border bg-surface p-1.5 z-50 animate-rise"
          style={{ boxShadow: "0 16px 40px var(--shadow-color)" }}
        >
          <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-text-tertiary tracking-wide">
            Effort
          </div>
          {EFFORT_LEVELS.map((key) => {
            const cfg = EFFORT[key];
            const Icon = ICONS[key];
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2.5 transition-colors cursor-pointer ${
                  selected ? "bg-surface-2" : "hover:bg-surface-2/70"
                }`}
              >
                <div
                  className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selected ? "bg-accent/15 text-accent" : "bg-surface-3 text-text-secondary"
                  }`}
                >
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{cfg.label}</span>
                    <span className="ml-auto text-[11px] text-text-tertiary tabular-nums">{cfg.eta}</span>
                    {selected && <Check size={13} className="text-accent flex-shrink-0" />}
                  </div>
                  <div className="text-[11.5px] text-text-secondary leading-snug mt-0.5">{cfg.detail}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
