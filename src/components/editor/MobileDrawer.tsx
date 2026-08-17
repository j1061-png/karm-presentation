"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Full-height slide-over drawer used for Slides/AI/Design panels on phones. */
export function MobileDrawer({
  open,
  onClose,
  side = "right",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex md:hidden">
      <div className="absolute inset-0 bg-black/45 pk-backdrop" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-surface w-[86vw] max-w-[360px] h-full safe-top safe-bottom ${
          side === "left" ? "mr-auto pk-drawer-left" : "ml-auto pk-drawer-right"
        }`}
        style={{ boxShadow: "0 0 32px var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 flex items-center justify-between px-3.5 border-b border-border flex-shrink-0">
          <span className="text-[13px] font-medium">{title}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
