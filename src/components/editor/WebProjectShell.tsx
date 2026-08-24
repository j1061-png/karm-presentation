"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { kindLabel, kindNoun, type Presentation, type ChatTurn } from "@/lib/schema";
import { aiEdit, savePresentation } from "@/lib/api";
import { assemblePreviewHtml } from "@/lib/web-preview";
import { ShareModal } from "@/components/share/ShareModal";
import { BrandMark } from "@/components/brand/BrandLogo";
import {
  ArrowLeft, ArrowUp, AlertCircle, Check, Code2, Download, ExternalLink, Loader2,
  AlertTriangle, RefreshCw, Share2, X,
} from "lucide-react";

type SaveState = "saved" | "saving" | "dirty" | "error";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

const QUICK_ACTIONS = [
  "Make it look more premium",
  "Add a dark mode toggle",
  "Improve the mobile layout",
  "Add sound-free animations",
];

/**
 * Editor for web projects (website / game / app): live preview, AI chat that
 * rewrites the files, and a code drawer for direct edits.
 */
export function WebProjectShell({
  initial,
  role = "owner",
}: {
  initial: Presentation;
  role?: "owner" | "editor";
}) {
  const [doc, setDoc] = useState<Presentation>(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(true);
  const [activeFile, setActiveFile] = useState(initial.entry);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [reloadKey, setReloadKey] = useState(0);

  const [messages, setMessages] = useState<Message[]>(() =>
    (initial.chatThread ?? [])
      .filter((t) => t.kind !== "result")
      .map((t) => ({ id: t.id, role: t.role, text: t.text, error: t.kind === "error" }))
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<Presentation>(initial);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const doSave = useCallback(async (next: Presentation) => {
    setSaveState("saving");
    try {
      await savePresentation(next);
      setSaveState(latestDoc.current === next ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    }
  }, []);

  /** Update the doc locally and autosave after a short debounce. */
  const updateDoc = useCallback(
    (updater: (prev: Presentation) => Presentation, { persist = true } = {}) => {
      setDoc((prev) => {
        const next = updater(prev);
        latestDoc.current = next;
        if (persist) {
          setSaveState("dirty");
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => void doSave(latestDoc.current), 1200);
        }
        return next;
      });
    },
    [doSave]
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function toThread(msgs: Message[]): ChatTurn[] {
    return msgs.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      kind: m.error ? ("error" as const) : m.role === "assistant" ? ("edit" as const) : undefined,
    }));
  }

  async function send(text: string) {
    const instruction = text.trim();
    if (!instruction || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Message = { id: `u${Date.now()}`, role: "user", text: instruction };
    setMessages((m) => [...m, userMsg]);

    try {
      const result = await aiEdit({
        presentationId: doc.id,
        instruction,
        presentation: latestDoc.current,
      });
      const reply: Message = { id: `a${Date.now()}`, role: "assistant", text: result.summary };
      setMessages((m) => {
        const next = [...m, reply];
        const base = result.changed ? result.presentation : latestDoc.current;
        const withThread = { ...base, chatThread: toThread(next) };
        latestDoc.current = withThread;
        setDoc(withThread);
        setActiveFile((f) => (withThread.files?.some((x) => x.path === f) ? f : withThread.entry));
        setReloadKey((k) => k + 1);
        void savePresentation(withThread).catch(() => undefined);
        return next;
      });
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const html = assemblePreviewHtml(doc.files, doc.entry);
  const file = doc.files?.find((f) => f.path === activeFile) ?? doc.files?.[0];
  const noun = kindNoun(doc.kind);
  const label = kindLabel(doc.kind);

  async function downloadCode() {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const f of doc.files ?? []) zip.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\w-]+/g, "-").toLowerCase() || "project"}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
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
          onClick={() => void doSave(latestDoc.current)}
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
      <header className="h-[52px] flex items-center gap-2 px-3 border-b border-border bg-bg flex-shrink-0 z-30">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </Link>
        <BrandMark size={22} />

        <div className="flex items-center gap-3 min-w-0">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim() || "Untitled project";
              setTitleDraft(t);
              if (t !== doc.title) updateDoc((p) => ({ ...p, title: t }));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="bg-transparent text-[13.5px] font-medium outline-none rounded-md px-2 py-1 hover:bg-surface-2 focus:bg-surface-2 transition-colors max-w-[280px] truncate"
            aria-label="Project title"
          />
          <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 rounded-full px-2 py-0.5 capitalize">
            {label}
          </span>
          <SaveIndicator />
          {role === "editor" && (
            <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 rounded-full px-2 py-0.5">
              Shared with you
            </span>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          title="Reload preview"
          aria-label="Reload preview"
        >
          <RefreshCw size={14} />
        </button>

        <button
          onClick={() => setCodeOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-[12.5px] font-medium border rounded-lg px-3 py-2 transition-colors cursor-pointer ${
            codeOpen
              ? "bg-surface-3 border-border-strong"
              : "bg-surface-2 border-border hover:border-border-strong"
          }`}
        >
          <Code2 size={13} />
          Code
        </button>

        <Link
          href={`/presentations/${doc.id}`}
          target="_blank"
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-surface-2 border border-border rounded-lg px-3 py-2 hover:border-border-strong transition-colors"
        >
          <ExternalLink size={13} />
          Open
        </Link>

        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Share2 size={13} />
          Share
        </button>
      </header>

      {shareOpen && (
        <ShareModal
          presentationId={doc.id}
          title={doc.title}
          onClose={() => setShareOpen(false)}
          isOwner={role === "owner"}
        />
      )}

      <div className="flex-1 flex min-h-0">
        {/* ------------------------------------------------ live preview */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface">
          <iframe
            key={`${doc.updatedAt}-${reloadKey}`}
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals"
            className="flex-1 w-full border-0 bg-white"
            title={doc.title}
          />
        </div>

        {/* ------------------------------------------------- code drawer */}
        {codeOpen && (
          <div className="w-[420px] flex-shrink-0 border-l border-border flex flex-col min-h-0">
            <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-border overflow-x-auto">
              {(doc.files ?? []).map((f) => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(f.path)}
                  className={`text-[12px] font-mono px-2.5 py-1.5 rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                    f.path === (file?.path ?? "")
                      ? "bg-surface-3 text-text"
                      : "text-text-secondary hover:text-text"
                  }`}
                >
                  {f.path}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={() => void downloadCode()}
                className="p-1.5 rounded-md text-text-tertiary hover:text-text cursor-pointer"
                title="Download code as ZIP"
                aria-label="Download code"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => setCodeOpen(false)}
                className="p-1.5 rounded-md text-text-tertiary hover:text-text cursor-pointer"
                aria-label="Close code"
              >
                <X size={13} />
              </button>
            </div>
            <textarea
              value={file?.content ?? ""}
              onChange={(e) => {
                const path = file?.path;
                if (!path) return;
                const content = e.target.value;
                updateDoc((p) => ({
                  ...p,
                  files: (p.files ?? []).map((f) => (f.path === path ? { ...f, content } : f)),
                  updatedAt: new Date().toISOString(),
                }));
              }}
              spellCheck={false}
              className="flex-1 w-full resize-none outline-none bg-bg text-text font-mono text-[12px] leading-relaxed p-3"
            />
          </div>
        )}

        {/* ------------------------------------------------------ AI chat */}
        <div className="w-[340px] flex-shrink-0 border-l border-border flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="text-[12.5px] text-text-secondary leading-relaxed px-1 pt-2">
                Ask for any change — the AI rewrites the {noun} and the preview updates.
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="self-end max-w-[90%] rounded-xl bg-surface-3 px-3 py-2 text-[13px] leading-relaxed">
                  {m.text}
                </div>
              ) : m.error ? (
                <div key={m.id} className="self-start max-w-[95%] rounded-xl bg-danger/10 border border-danger/30 text-danger px-3 py-2 text-[12.5px]">
                  <AlertCircle size={12} className="inline mr-1.5 -mt-0.5" />
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="self-start max-w-[95%] rounded-xl bg-surface border border-border px-3 py-2 text-[12.5px] leading-relaxed">
                  {m.text}
                </div>
              )
            )}
            {busy && (
              <div className="self-start flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
                <Loader2 size={12} className="animate-spin text-accent" />
                <span className="text-[12px] text-text-secondary">Rewriting the {noun}...</span>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="px-3 pb-2 flex flex-col gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void send(q)}
                  className="text-left text-[12px] text-text-secondary border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-border-strong transition-colors">
              <textarea
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask for a change..."
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-[13px] leading-relaxed placeholder:text-text-tertiary disabled:opacity-60"
              />
              <button
                onClick={() => void send(input)}
                disabled={!input.trim() || busy}
                className="w-7 h-7 rounded-full bg-text text-bg flex items-center justify-center hover:opacity-85 disabled:opacity-25 cursor-pointer flex-shrink-0"
                aria-label="Send"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
