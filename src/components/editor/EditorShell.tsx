"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Presentation } from "@/lib/schema";
import { savePresentation } from "@/lib/api";
import { useEditorStore, type SaveState } from "@/state/editorStore";
import { useIsMobile } from "@/lib/use-media";
import { SlidesPanel } from "./SlidesPanel";
import { Canvas } from "./Canvas";
import { RightPanel } from "./RightPanel";
import { MobileDrawer } from "./MobileDrawer";
import { ResizeHandle, beginPanelResize } from "./ResizeHandle";
import { Player } from "@/components/present/Player";
import { ShareModal } from "@/components/share/ShareModal";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { BrandMark } from "@/components/brand/BrandLogo";
import {
  Undo2, Redo2, Play, Eye, PencilRuler, Share2,
  Check, Loader2, AlertTriangle, ArrowLeft, Layers, Sparkles,
} from "lucide-react";

type EditorMode = "edit" | "preview" | "present";
type PanelSide = "left" | "right";

export function EditorShell({
  initial,
  role = "owner",
}: {
  initial: Presentation;
  role?: "owner" | "editor";
}) {
  const setPresentation = useEditorStore((s) => s.setPresentation);
  const presentation = useEditorStore((s) => s.presentation);
  const setTitle = useEditorStore((s) => s.setTitle);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [shareOpen, setShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [slidesWidth, setSlidesWidth] = useState(200);
  const [rightWidth, setRightWidth] = useState(320);
  const [panelSide, setPanelSide] = useState<PanelSide>("right");
  const [mobileDrawer, setMobileDrawer] = useState<"slides" | "panel" | null>(null);
  const isMobile = useIsMobile();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<Presentation | null>(null);
  const savedDoc = useRef<Presentation>(initial);

  // Hydrate the store once.
  useEffect(() => {
    setPresentation(initial);
    useEditorStore.temporal.getState().clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  useEffect(() => {
    try {
      const left = Number(localStorage.getItem("pk-panel-slides"));
      const right = Number(localStorage.getItem("pk-panel-right"));
      const side = localStorage.getItem("pk-panel-side");
      if (left >= 140 && left <= 420) setSlidesWidth(left);
      if (right >= 240 && right <= 640) setRightWidth(right);
      if (side === "left" || side === "right") setPanelSide(side);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pk-panel-slides", String(slidesWidth));
      localStorage.setItem("pk-panel-right", String(rightWidth));
    } catch {
      /* ignore */
    }
  }, [slidesWidth, rightWidth]);

  const setPanelSidePersist = useCallback((side: PanelSide) => {
    setPanelSide(side);
    try {
      localStorage.setItem("pk-panel-side", side);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (presentation) setTitleDraft(presentation.title);
  }, [presentation?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ autosave
  const doSave = useCallback(async (doc: Presentation) => {
    setSaveState("saving");
    try {
      await savePresentation(doc);
      savedDoc.current = doc;
      // Only mark saved if nothing changed while saving.
      if (latestDoc.current === doc || latestDoc.current === null) setSaveState("saved");
      else setSaveState("dirty");
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      const doc = state.presentation;
      if (!doc || doc === prev.presentation || doc === savedDoc.current) return;
      latestDoc.current = doc;
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (latestDoc.current) void doSave(latestDoc.current);
      }, 1200);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [doSave]);

  // Warn before closing with unsaved changes; flush a final save.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") {
        e.preventDefault();
        if (latestDoc.current) {
          // Best-effort final save that survives page unload.
          void fetch(`/api/presentations/${latestDoc.current.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presentation: latestDoc.current }),
            keepalive: true,
          });
        }
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [saveState]);

  // ------------------------------------------------------- undo shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editingText =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !editingText) {
        e.preventDefault();
        const temporal = useEditorStore.temporal.getState();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!presentation) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <Loader2 size={22} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  // ---------------------------------------------------------- present mode
  if (mode === "present") {
    return (
      <div className="fixed inset-0 z-50">
        <Player
          presentation={presentation}
          onExit={() => setMode("edit")}
          onShare={() => {
            setMode("edit");
            setShareOpen(true);
          }}
        />
        {shareOpen && (
          <ShareModal
            presentationId={presentation.id}
            title={presentation.title}
            onClose={() => setShareOpen(false)}
            isOwner={role === "owner"}
          />
        )}
      </div>
    );
  }

  const SaveIndicator = () => {
    if (saveState === "saving")
      return (
        <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </span>
      );
    if (saveState === "error")
      return (
        <button
          onClick={() => latestDoc.current && void doSave(latestDoc.current)}
          className="flex items-center gap-1.5 text-[12px] text-danger cursor-pointer hover:underline"
        >
          <AlertTriangle size={12} /> Unable to save — retry
        </button>
      );
    if (saveState === "dirty")
      return <span className="text-[12px] text-text-tertiary">Unsaved changes</span>;
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
        <Check size={12} className="text-success" /> Saved
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* ------------------------------------------------------- top bar */}
      <header className="min-h-[52px] flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 border-b border-border bg-bg flex-shrink-0 z-30 safe-top">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors flex-shrink-0"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </Link>
        <BrandMark size={22} className="hidden sm:block flex-shrink-0" />

        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim() || "Untitled presentation";
              setTitleDraft(t);
              if (t !== presentation.title) setTitle(t);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="bg-transparent text-[13.5px] font-medium outline-none rounded-md px-2 py-1 hover:bg-surface-2 focus:bg-surface-2 transition-colors min-w-0 flex-1 sm:flex-initial sm:max-w-[280px] truncate"
            aria-label="Presentation title"
          />
          <span className="hidden sm:inline">
            <SaveIndicator />
          </span>
          {role === "editor" && (
            <span className="hidden md:inline text-[11px] font-medium text-text-tertiary bg-surface-2 rounded-full px-2 py-0.5">
              Shared with you
            </span>
          )}
        </div>

        <div className="flex-1 hidden sm:block" />

        {/* Undo / redo */}
        <div className="hidden sm:flex items-center gap-0.5 mr-1">
          <button
            onClick={() => useEditorStore.temporal.getState().undo()}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Undo"
            title="Undo (⌘Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={() => useEditorStore.temporal.getState().redo()}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Redo"
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        {/* Mode switch */}
        <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5 flex-shrink-0">
          {(
            [
              { key: "edit", label: "Edit", icon: PencilRuler },
              { key: "preview", label: "Preview", icon: Eye },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 text-[12.5px] px-2 sm:px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer ${
                mode === m.key ? "bg-surface-3 text-text font-medium" : "text-text-secondary hover:text-text"
              }`}
            >
              <m.icon size={13} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        <span className="hidden sm:inline-flex">
          <NotificationsBell />
        </span>

        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-surface-2 border border-border rounded-lg px-2.5 sm:px-3.5 py-2 hover:border-border-strong hover:bg-surface-3 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Share"
        >
          <Share2 size={13} className="text-accent" />
          <span className="hidden md:inline">Share</span>
        </button>

        <button
          onClick={() => setMode("present")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-2.5 sm:px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer flex-shrink-0"
          aria-label="Present"
        >
          <Play size={13} />
          <span className="hidden md:inline">Present</span>
        </button>
      </header>

      {/* Save indicator strip — shown under the header only on phones, where it was hidden above */}
      <div className="sm:hidden px-3 py-1 border-b border-border flex-shrink-0">
        <SaveIndicator />
      </div>

      {shareOpen && (
        <ShareModal
          presentationId={presentation.id}
          title={presentation.title}
          onClose={() => setShareOpen(false)}
          isOwner={role === "owner"}
        />
      )}

      {/* --------------------------------------------------- main layout */}
      {mode === "preview" ? (
        <div key="preview" className="flex-1 min-h-0 pk-panel-swap">
          <Player presentation={presentation} onExit={() => setMode("edit")} embedded />
        </div>
      ) : isMobile ? (
        <div key="edit-mobile" className="flex-1 min-h-0 flex flex-col pk-panel-swap">
          <Canvas />

          {/* Bottom toolbar: open Slides / AI+Design as drawers */}
          <div className="flex items-stretch border-t border-border bg-bg flex-shrink-0 safe-bottom">
            <button
              onClick={() => setMobileDrawer("slides")}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-text-secondary hover:text-text active:bg-surface-2 transition-colors cursor-pointer"
            >
              <Layers size={15} />
              Slides
            </button>
            <div className="w-px bg-border" />
            <button
              onClick={() => setMobileDrawer("panel")}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-text-secondary hover:text-text active:bg-surface-2 transition-colors cursor-pointer"
            >
              <Sparkles size={15} />
              AI &amp; Design
            </button>
          </div>

          <MobileDrawer
            open={mobileDrawer === "slides"}
            onClose={() => setMobileDrawer(null)}
            side="left"
            title="Slides"
          >
            <SlidesPanel width="100%" />
          </MobileDrawer>
          <MobileDrawer
            open={mobileDrawer === "panel"}
            onClose={() => setMobileDrawer(null)}
            side="right"
            title="AI & Design"
          >
            <RightPanel width="100%" />
          </MobileDrawer>
        </div>
      ) : (
        <div key="edit-desktop" data-editor-main className="flex-1 flex min-h-0 pk-panel-swap">
          {panelSide === "left" && (
            <>
              <RightPanel width={rightWidth} side="left" onSideChange={setPanelSidePersist} />
              <ResizeHandle
                onBegin={(x) => beginPanelResize(x, rightWidth, 1, 240, 640, setRightWidth)}
              />
            </>
          )}
          <SlidesPanel width={slidesWidth} />
          <ResizeHandle
            onBegin={(x) => beginPanelResize(x, slidesWidth, 1, 140, 420, setSlidesWidth)}
          />
          <Canvas />
          {panelSide === "right" && (
            <>
              <ResizeHandle
                onBegin={(x) => beginPanelResize(x, rightWidth, -1, 240, 640, setRightWidth)}
              />
              <RightPanel width={rightWidth} side="right" onSideChange={setPanelSidePersist} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
