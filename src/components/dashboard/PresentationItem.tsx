"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentationMeta } from "@/lib/schema";
import { ThemeSchema } from "@/lib/schema";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { ShareModal } from "@/components/share/ShareModal";
import {
  MoreHorizontal, Pencil, PencilRuler, Copy, Trash2, Play, Share2, Layers, UserPlus, LogOut,
  Globe, Gamepad2, AppWindow,
} from "lucide-react";

function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Compact list row for a presentation — thumbnail, title, meta, actions. */
export function PresentationItem({
  meta,
  onRename,
  onDuplicate,
  onDelete,
  onLeave,
  onOpen,
}: {
  meta: PresentationMeta;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onLeave?: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  const slideTheme = ThemeSchema.parse({
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
    <div className="group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors">
      {/* Thumbnail — div, not button: slide thumbs can contain interactive elements */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => (onOpen ? onOpen(meta.id) : router.push(`/editor/${meta.id}`))}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && (onOpen ? onOpen(meta.id) : router.push(`/editor/${meta.id}`))
        }
        className="relative w-[88px] flex-shrink-0 rounded-md overflow-hidden ring-1 ring-border cursor-pointer"
        style={{ background: meta.themeColors.background }}
        aria-label={`Open ${meta.title}`}
      >
        {meta.preview ? (
          <SlideRenderer slide={meta.preview} theme={slideTheme} mode="thumb" className="pointer-events-none" />
        ) : (
          <div className="aspect-video flex items-center justify-center">
            {meta.kind === "game" ? (
              <Gamepad2 size={14} className="text-text-tertiary" />
            ) : meta.kind === "app" ? (
              <AppWindow size={14} className="text-text-tertiary" />
            ) : meta.kind === "website" ? (
              <Globe size={14} className="text-text-tertiary" />
            ) : (
              <Layers size={14} className="text-text-tertiary" />
            )}
          </div>
        )}
      </div>

      {/* Title + meta */}
      <button
        className="flex-1 min-w-0 text-left cursor-pointer"
        onClick={() => !renaming && (onOpen ? onOpen(meta.id) : router.push(`/editor/${meta.id}`))}
      >
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setTitle(meta.title);
                setRenaming(false);
              }
            }}
            className="text-[13.5px] font-medium bg-surface border border-border-strong rounded-md px-1.5 py-0.5 w-full max-w-sm outline-none focus:border-accent"
          />
        ) : (
          <span className="block text-[13.5px] font-medium truncate">{meta.title}</span>
        )}
        <span className="block text-[12px] text-text-tertiary mt-0.5">
          {meta.kind && meta.kind !== "presentation"
            ? `${meta.kind[0].toUpperCase()}${meta.kind.slice(1)}`
            : `${meta.slideCount} slide${meta.slideCount === 1 ? "" : "s"}`}
          {" · "}
          {timeAgo(meta.updatedAt)}
          {meta.role === "editor" && meta.ownerName ? ` · Shared by ${meta.ownerName}` : ""}
        </span>
      </button>

      {/* Live status */}
      {meta.role === "editor" && (
        <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-text-secondary bg-surface-2 rounded-full px-2 py-0.5 flex-shrink-0">
          Shared
        </span>
      )}
      {meta.publishedAt && (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Live
        </span>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => window.open(`/presentations/${meta.id}`, "_blank")}
          className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
          title="Present"
          aria-label="Present"
        >
          <Play size={14} />
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
          title="Share"
          aria-label="Share"
        >
          <Share2 size={14} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-9 z-30 w-40 bg-surface border border-border rounded-xl py-1.5 animate-rise"
              style={{ boxShadow: "0 8px 24px var(--shadow-color)" }}
            >
              {[
                { label: "Open editor", icon: PencilRuler, fn: () => router.push(`/editor/${meta.id}`) },
                { label: "Rename", icon: Pencil, fn: () => setRenaming(true) },
                { label: "Duplicate", icon: Copy, fn: () => onDuplicate(meta.id) },
                ...(meta.role !== "editor"
                  ? [{ label: "Add people", icon: UserPlus, fn: () => setShareOpen(true) }]
                  : []),
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setMenuOpen(false);
                    item.fn();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <item.icon size={13.5} />
                  {item.label}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              {meta.role === "editor" ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLeave?.(meta.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <LogOut size={13.5} />
                  Leave
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(meta.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={13.5} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          presentationId={meta.id}
          title={meta.title}
          onClose={() => setShareOpen(false)}
          isOwner={meta.role !== "editor"}
        />
      )}
    </div>
  );
}
