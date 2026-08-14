"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Presentation } from "@/lib/schema";
import { savePresentation } from "@/lib/api";
import { useEditorStore, type SaveState } from "@/state/editorStore";
import { SlidesPanel } from "./SlidesPanel";
import { Canvas } from "./Canvas";
import { RightPanel } from "./RightPanel";
import { Player } from "@/components/present/Player";
import {
  Sun, Undo2, Redo2, Play, Eye, PencilRuler, ExternalLink,
  Check, Loader2, AlertTriangle, ChevronLeft,
} from "lucide-react";

type EditorMode = "edit" | "preview" | "present";

export function EditorShell({ initial }: { initial: Presentation }) {
  const setPresentation = useEditorStore((s) => s.setPresentation);
  const presentation = useEditorStore((s) => s.presentation);
  const setTitle = useEditorStore((s) => s.setTitle);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [titleDraft, setTitleDraft] = useState(initial.title);
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
        <Player presentation={presentation} onExit={() => setMode("edit")} />
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
      <header className="h-[52px] flex items-center gap-3 px-3 border-b border-border bg-surface/60 flex-shrink-0 z-30">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-text-secondary hover:text-text transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-2"
        >
          <ChevronLeft size={16} />
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
            <Sun size={13} className="text-accent-text" strokeWidth={2.5} />
          </div>
        </Link>

        <div className="flex items-center gap-3 min-w-0">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim() || "Untitled presentation";
              setTitleDraft(t);
              if (t !== presentation.title) setTitle(t);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="bg-transparent text-[13.5px] font-medium outline-none rounded-md px-2 py-1 hover:bg-surface-2 focus:bg-surface-2 transition-colors max-w-[280px] truncate"
            aria-label="Presentation title"
          />
          <SaveIndicator />
        </div>

        <div className="flex-1" />

        {/* Undo / redo */}
        <div className="flex items-center gap-0.5 mr-1">
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
        <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5">
          {(
            [
              { key: "edit", label: "Edit", icon: PencilRuler },
              { key: "preview", label: "Preview", icon: Eye },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer ${
                mode === m.key ? "bg-surface-3 text-text font-medium" : "text-text-secondary hover:text-text"
              }`}
            >
              <m.icon size={13} />
              {m.label}
            </button>
          ))}
        </div>

        <a
          href={`/presentations/${presentation.id}`}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors"
          title="Open as standalone website"
        >
          <ExternalLink size={15} />
        </a>

        <button
          onClick={() => setMode("present")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Play size={13} />
          Present
        </button>
      </header>

      {/* --------------------------------------------------- main layout */}
      {mode === "preview" ? (
        <div className="flex-1 min-h-0">
          <Player presentation={presentation} onExit={() => setMode("edit")} embedded />
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <SlidesPanel />
          <Canvas />
          <RightPanel />
        </div>
      )}
    </div>
  );
}
