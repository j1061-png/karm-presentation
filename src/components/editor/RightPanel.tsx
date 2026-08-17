"use client";

import { useState } from "react";
import { Sparkles, SlidersHorizontal, GripVertical } from "lucide-react";
import { Inspector } from "./Inspector";
import { AIChat } from "./AIChat";

export function RightPanel({
  width = 320,
  side = "right",
  onSideChange,
}: {
  width?: number | string;
  side?: "left" | "right";
  onSideChange?: (side: "left" | "right") => void;
}) {
  const [tab, setTab] = useState<"ai" | "design">("ai");
  const [dragging, setDragging] = useState(false);

  function beginDrag(e: React.PointerEvent) {
    if (!onSideChange) return;
    const main = (e.currentTarget.closest("[data-editor-main]") as HTMLElement) ?? null;
    if (!main) return;
    setDragging(true);
    let current = side;
    const move = (ev: PointerEvent) => {
      const rect = main.getBoundingClientRect();
      const rel = (ev.clientX - rect.left) / rect.width;
      const next: "left" | "right" = rel < 0.5 ? "left" : "right";
      if (next !== current) {
        current = next;
        onSideChange(next);
      }
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  return (
    <aside
      className={`flex-shrink-0 bg-surface/40 flex flex-col min-h-0 ${
        side === "left" ? "border-r border-border" : "border-l border-border"
      } ${dragging ? "opacity-70" : ""}`}
      style={{ width }}
    >
      <div className="flex items-stretch border-b border-border flex-shrink-0">
        {onSideChange && (
          <button
            onPointerDown={beginDrag}
            onDoubleClick={() => onSideChange(side === "left" ? "right" : "left")}
            className="hidden md:flex items-center px-1 text-text-tertiary hover:text-text hover:bg-surface-2 transition-colors cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            title="Drag to move this panel to the other side, or double-click to flip"
            aria-label="Move panel"
          >
            <GripVertical size={13} />
          </button>
        )}
        <div className="flex flex-1">
          {(
            [
              { key: "ai", label: "AI", icon: Sparkles },
              { key: "design", label: "Design", icon: SlidersHorizontal },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[12.5px] h-10 transition-colors cursor-pointer relative ${
                tab === t.key ? "text-text font-medium" : "text-text-secondary hover:text-text"
              }`}
            >
              <t.icon size={13} className={tab === t.key ? "text-accent" : ""} />
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-6 right-6 h-[2px] bg-accent rounded-full transition-all duration-200" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div key={tab} className="flex-1 min-h-0 flex flex-col pk-panel-swap">
          {tab === "ai" ? <AIChat /> : <Inspector />}
        </div>
      </div>
    </aside>
  );
}
