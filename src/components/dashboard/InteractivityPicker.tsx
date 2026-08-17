"use client";

import { Check } from "lucide-react";
import { INTERACTIVITY, INTERACTIVITY_LEVELS, type InteractivityLevel } from "@/lib/interactivity";
import { ParticleField } from "@/components/renderer/ParticleField";

/**
 * Lets the user choose how much motion/interactivity their generated deck
 * should have. Each option is a small living preview — its own moving-star
 * field tuned to that level's density/speed — not a plain radio row.
 */
export function InteractivityPicker({
  value,
  onChange,
  disabled,
}: {
  value: InteractivityLevel;
  onChange: (v: InteractivityLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {INTERACTIVITY_LEVELS.map((key) => {
        const cfg = INTERACTIVITY[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            title={cfg.hint}
            className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              selected ? "border-transparent" : "border-border hover:border-border-strong"
            }`}
            style={{
              boxShadow: selected
                ? `0 0 0 1.5px ${cfg.color}, 0 8px 20px -6px ${cfg.color}55`
                : undefined,
              transform: selected ? "translateY(-1px)" : undefined,
            }}
          >
            {/* Live preview strip — an actual moving-star field at this level's tuning */}
            <div
              className="relative h-12 w-full overflow-hidden"
              style={{
                background: `radial-gradient(120% 140% at 20% 0%, ${cfg.color}33, #0b0d12 70%)`,
              }}
            >
              <ParticleField color={cfg.color} density={cfg.particleDensity || 14} speed={cfg.particleSpeed} />
              {selected && (
                <span
                  className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 rounded-full text-black"
                  style={{ background: cfg.color }}
                >
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="px-2.5 py-2 bg-surface">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-[12px] font-medium truncate">{cfg.label}</span>
              </div>
              <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-snug line-clamp-2">
                {cfg.hint}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
