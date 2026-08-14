"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentationMeta } from "@/lib/schema";
import { ThemeSchema } from "@/lib/schema";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import {
  MoreHorizontal, Pencil, Copy, Trash2, Play, ExternalLink, Layers,
} from "lucide-react";

function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PresentationCard({
  meta,
  onRename,
  onDuplicate,
  onDelete,
}: {
  meta: PresentationMeta;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(meta.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTitle(meta.title), [meta.title]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const theme = ThemeSchema.parse({
    mode: "dark",
    colors: {
      background: meta.themeColors.background,
      surface: meta.themeColors.surface,
      text: meta.themeColors.text,
      accent: meta.themeColors.accent,
      muted: "#9ba1ab",
      accentText: "#101114",
    },
  });

  function commitRename() {
    setRenaming(false);
    const next = title.trim();
    if (next && next !== meta.title) onRename(meta.id, next);
    else setTitle(meta.title);
  }

  return (
    <div className="group relative bg-surface border border-border rounded-xl overflow-hidden hover:border-border-strong transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
      {/* Thumbnail — a real render of the first slide */}
      <button
        className="w-full cursor-pointer block text-left"
        onClick={() => router.push(`/editor/${meta.id}`)}
        aria-label={`Open ${meta.title}`}
      >
        <div className="relative" style={{ background: meta.themeColors.background }}>
          {meta.preview ? (
            <SlideRenderer slide={meta.preview} theme={theme} mode="thumb" className="pointer-events-none" />
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <Layers size={24} className="text-text-tertiary" />
            </div>
          )}
          {/* Hover actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <span className="text-[12.5px] font-medium bg-white text-black rounded-lg px-3.5 py-2 shadow-lg">
                Edit
              </span>
              <span
                role="button"
                tabIndex={0}
                className="text-[12.5px] font-medium bg-black/60 text-white border border-white/20 rounded-lg px-3.5 py-2 backdrop-blur-sm hover:bg-black/80 flex items-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/presentations/${meta.id}`, "_blank");
                }}
              >
                <Play size={12} /> Present
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Card meta */}
      <div className="px-3.5 py-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setTitle(meta.title);
                  setRenaming(false);
                }
              }}
              className="text-[13.5px] font-medium bg-surface-2 border border-border-strong rounded-md px-1.5 py-0.5 w-full outline-none focus:border-accent"
            />
          ) : (
            <div className="text-[13.5px] font-medium truncate">{meta.title}</div>
          )}
          <div className="text-[11.5px] text-text-tertiary mt-0.5">
            {meta.slideCount} slide{meta.slideCount === 1 ? "" : "s"} · edited {timeAgo(meta.updatedAt)}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Presentation actions"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 bg-surface-2 border border-border-strong rounded-xl shadow-xl shadow-black/40 py-1.5 animate-in-fade">
              {[
                { label: "Rename", icon: Pencil, fn: () => setRenaming(true) },
                { label: "Duplicate", icon: Copy, fn: () => onDuplicate(meta.id) },
                {
                  label: "Open standalone",
                  icon: ExternalLink,
                  fn: () => window.open(`/presentations/${meta.id}`, "_blank"),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setMenuOpen(false);
                    item.fn();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-secondary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <item.icon size={14} />
                  {item.label}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(meta.id);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
