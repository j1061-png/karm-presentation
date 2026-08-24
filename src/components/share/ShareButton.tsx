"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareModal } from "./ShareModal";

type Variant = "default" | "accent" | "ghost" | "icon";

/**
 * Opens the share + collaborators modal. Used on every project surface
 * (dashboard rows, chat results, editors, present mode).
 */
export function ShareButton({
  presentationId,
  title,
  isOwner = true,
  variant = "default",
  label = "Share",
  className = "",
}: {
  presentationId: string;
  title: string;
  isOwner?: boolean;
  variant?: Variant;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const styles: Record<Variant, string> = {
    default:
      "flex items-center gap-1.5 text-[12px] font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-2 transition-colors cursor-pointer",
    accent:
      "flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer",
    ghost:
      "p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer",
    icon: "p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors cursor-pointer",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${styles[variant]} ${className}`}
        title="Share and invite collaborators"
        aria-label="Share"
      >
        <Share2 size={variant === "ghost" || variant === "icon" ? 14 : 13} />
        {variant !== "ghost" && variant !== "icon" ? label : null}
      </button>
      {open && (
        <ShareModal
          presentationId={presentationId}
          title={title}
          onClose={() => setOpen(false)}
          isOwner={isOwner}
        />
      )}
    </>
  );
}
