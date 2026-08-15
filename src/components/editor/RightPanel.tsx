"use client";

import { useState } from "react";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { Inspector } from "./Inspector";
import { AIChat } from "./AIChat";

export function RightPanel({ width = 320 }: { width?: number }) {
  const [tab, setTab] = useState<"ai" | "design">("ai");

  return (
    <aside
      className="flex-shrink-0 border-l border-border bg-surface/40 flex flex-col min-h-0"
      style={{ width }}
    >
      <div className="flex border-b border-border flex-shrink-0">
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
            {tab === t.key && <span className="absolute bottom-0 left-6 right-6 h-[2px] bg-accent rounded-full" />}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "ai" ? <AIChat /> : <Inspector />}
      </div>
    </aside>
  );
}
