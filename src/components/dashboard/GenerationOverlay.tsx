"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

export interface GenProgress {
  stage: string;
  detail?: string;
  done?: number;
  total?: number;
  error?: string;
}

const STAGES: { key: string; label: string }[] = [
  { key: "analysing", label: "Analysing your content" },
  { key: "planning", label: "Planning your presentation" },
  { key: "designing", label: "Designing your slides" },
  { key: "interactive", label: "Adding interactive elements" },
  { key: "finalising", label: "Finalising presentation" },
];

export function GenerationOverlay({
  progress,
  onCancel,
}: {
  progress: GenProgress;
  onCancel: () => void;
}) {
  const activeIndex = useMemo(() => {
    const i = STAGES.findIndex((s) => s.key === progress.stage);
    return i === -1 ? STAGES.length : i;
  }, [progress.stage]);

  const [dots, setDots] = useState("");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(t);
  }, []);

  const failed = progress.stage === "error";

  return (
    <div className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-md flex items-center justify-center animate-in-fade">
      <div className="w-full max-w-md px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Sparkles size={19} className="text-accent-text" />
          </div>
          <div>
            <div className="font-semibold text-[15px]">
              {failed ? "Generation failed" : `Creating your presentation${dots}`}
            </div>
            <div className="text-[13px] text-text-secondary">
              {failed ? progress.error : "present@karm is working with DeepSeek"}
            </div>
          </div>
        </div>

        {!failed && (
          <div className="flex flex-col gap-1">
            {STAGES.map((stage, i) => {
              const isDone = i < activeIndex;
              const isActive = i === activeIndex;
              return (
                <div
                  key={stage.key}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive ? "bg-surface border border-border" : ""
                  }`}
                  style={{ opacity: isDone || isActive ? 1 : 0.35 }}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isDone
                        ? "bg-success/20 text-success"
                        : isActive
                          ? "border-2 border-accent"
                          : "border-2 border-border-strong"
                    }`}
                  >
                    {isDone ? (
                      <Check size={13} strokeWidth={3} />
                    ) : isActive ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-accent"
                        style={{ animation: "pulse-soft 1.2s ease-in-out infinite" }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[14px] ${isActive ? "font-medium" : ""}`}>{stage.label}</div>
                    {isActive && progress.detail && (
                      <div className="text-[12px] text-text-secondary truncate">{progress.detail}</div>
                    )}
                  </div>
                  {isActive && progress.total ? (
                    <div className="ml-auto text-[12px] text-text-tertiary tabular-nums">
                      {Math.min(progress.done ?? 0, progress.total)}/{progress.total}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* progress bar for designing stage */}
            {progress.stage === "designing" && progress.total ? (
              <div className="mt-4 h-1 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((progress.done ?? 0) / progress.total) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-8 mx-auto flex items-center gap-2 text-[13px] text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          <X size={14} />
          {failed ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
