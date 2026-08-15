"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp, Plus, UploadCloud, AlertCircle, Check, Loader2, PencilRuler, Play, PlusCircle,
} from "lucide-react";
import { aiEdit, getPresentation } from "@/lib/api";
import { EFFORT, EFFORT_LEVELS, parseEffort, type Effort } from "@/lib/effort";
import { ATTACH_ACCEPT, useAttachments } from "@/lib/use-attachments";
import { FileChips } from "@/components/chat/FileChips";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import type { Presentation } from "@/lib/schema";

interface GenProgress {
  stage: string;
  detail?: string;
  done?: number;
  total?: number;
  error?: string;
}

type ChatMessage =
  | { id: string; role: "user"; text: string; files?: string[] }
  | { id: string; role: "assistant"; kind: "progress"; progress: GenProgress }
  | { id: string; role: "assistant"; kind: "result"; presentationId: string }
  | { id: string; role: "assistant"; kind: "edit"; text: string }
  | { id: string; role: "assistant"; kind: "error"; text: string };

const GEN_STAGES: { key: string; label: string }[] = [
  { key: "analysing", label: "Analysing your request" },
  { key: "planning", label: "Planning your presentation" },
  { key: "designing", label: "Designing slides" },
  { key: "interactive", label: "Adding interactions" },
  { key: "finalising", label: "Finalising" },
];

const SUGGESTIONS = [
  "KarmSolar company overview",
  "Q3 solar farm performance",
  "Project timeline across Egypt",
  "Microgrid safety training",
];

export function Composer({
  onThreadChange,
  onCreated,
}: {
  onThreadChange?: (active: boolean) => void;
  onCreated?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState<GenProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const [effort, setEffort] = useState<Effort>("standard");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeDoc, setActiveDoc] = useState<Presentation | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { files, addFiles, removeFile, clearFiles, readySources, uploading, inputRef } =
    useAttachments();

  const threadActive = messages.length > 0;

  useEffect(() => {
    onThreadChange?.(threadActive);
  }, [threadActive, onThreadChange]);

  useEffect(() => {
    try {
      setEffort(parseEffort(localStorage.getItem("pk-effort")));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generating, editing]);

  // Whole-window drag detection.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  const busy = !!generating || editing;
  const canSend =
    (prompt.trim().length > 0 || readySources.length > 0) && !uploading && !busy;

  const resetThread = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setActiveDoc(null);
    setGenerating(null);
    setEditing(false);
    setPrompt("");
    clearFiles();
    onThreadChange?.(false);
  }, [clearFiles, onThreadChange]);

  function pushUser(text: string, attachedNames: string[] = []) {
    setMessages((m) => [
      ...m,
      { id: `u${Date.now()}`, role: "user", text, files: attachedNames },
    ]);
  }

  async function generate() {
    if (!canSend) return;
    const text =
      prompt.trim() ||
      (readySources.length > 0 ? "Create a presentation from the attached files." : "");
    if (!text) return;
    const attached = readySources;
    const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
    setPrompt("");
    clearFiles();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    pushUser(text, attachedNames);
    const progressId = `p${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: progressId, role: "assistant", kind: "progress", progress: { stage: "analysing" } },
    ]);
    setGenerating({ stage: "analysing" });
    const controller = new AbortController();
    abortRef.current = controller;

    const updateProgress = (progress: GenProgress) => {
      setGenerating(progress);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === progressId && msg.role === "assistant" && msg.kind === "progress"
            ? { ...msg, progress }
            : msg
        )
      );
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, files: attached, effort }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed to start.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finishedId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (data.stage === "complete") {
            finishedId = data.presentationId;
          } else if (data.stage === "error") {
            throw new Error(data.message);
          } else {
            updateProgress({
              stage: data.stage,
              detail: data.detail,
              done: data.done,
              total: data.total,
            });
          }
        }
      }

      if (!finishedId) throw new Error("Generation ended unexpectedly. Please try again.");
      updateProgress({ stage: "finalising", detail: "Saving your presentation" });
      const doc = await getPresentation(finishedId);
      setActiveDoc(doc);
      setGenerating(null);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === progressId
            ? { id: progressId, role: "assistant", kind: "result", presentationId: finishedId }
            : msg
        )
      );
      onCreated?.();
    } catch (e) {
      if (controller.signal.aborted) {
        setGenerating(null);
        setMessages((m) => m.filter((msg) => msg.id !== progressId));
        return;
      }
      const error = e instanceof Error ? e.message : "Generation failed.";
      setGenerating(null);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === progressId
            ? { id: progressId, role: "assistant", kind: "error", text: error }
            : msg
        )
      );
    }
  }

  async function editDeck() {
    if (!canSend || !activeDoc) return;
    const text =
      prompt.trim() ||
      (readySources.length > 0 ? "Incorporate the attached files into the presentation." : "");
    if (!text) return;
    const attached = readySources;
    const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
    setPrompt("");
    clearFiles();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    pushUser(text, attachedNames);
    setEditing(true);
    try {
      const result = await aiEdit({
        presentationId: activeDoc.id,
        instruction: text,
        presentation: activeDoc,
        files: attached,
      });
      if (result.changed) setActiveDoc(result.presentation);
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "assistant", kind: "edit", text: result.summary },
      ]);
      onCreated?.();
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          kind: "error",
          text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setEditing(false);
    }
  }

  function send() {
    if (activeDoc) void editDeck();
    else void generate();
  }

  return (
    <div className={`w-full mx-auto flex flex-col ${threadActive ? "flex-1 min-h-0 max-w-[760px]" : "max-w-[680px]"}`}>
      {dragging && (
        <div className="fixed inset-0 z-40 bg-bg/85 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in-fade">
          <div className="border-2 border-dashed border-accent rounded-2xl px-14 py-10 bg-surface flex flex-col items-center gap-3">
            <UploadCloud size={32} className="text-accent" />
            <div className="font-medium text-[14.5px]">Drop files to attach them</div>
            <div className="text-[12.5px] text-text-secondary">PDF, PowerPoint, Word, CSV, images, text</div>
          </div>
        </div>
      )}

      {threadActive && (
        <div className="flex items-center justify-between px-1 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate">
              {activeDoc?.title ?? "New presentation"}
            </div>
            {activeDoc && (
              <div className="text-[11.5px] text-text-tertiary">
                {activeDoc.slides.length} slide{activeDoc.slides.length === 1 ? "" : "s"} · keep chatting to edit
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeDoc && (
              <>
                <Link
                  href={`/editor/${activeDoc.id}`}
                  className="flex items-center gap-1.5 text-[12px] font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
                >
                  <PencilRuler size={12} />
                  Open editor
                </Link>
                <Link
                  href={`/presentations/${activeDoc.id}`}
                  className="flex items-center gap-1.5 text-[12px] font-medium bg-accent text-accent-text rounded-lg px-2.5 py-1.5 hover:bg-accent-hover transition-colors"
                >
                  <Play size={12} />
                  Present
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={resetThread}
              className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <PlusCircle size={12} />
              New chat
            </button>
          </div>
        </div>
      )}

      {threadActive && (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-1 pb-4 flex flex-col gap-3">
          {messages.map((m) => (
            <ThreadMessage
              key={m.id}
              message={m}
              doc={activeDoc}
              onCancelGenerate={
                generating
                  ? () => {
                      abortRef.current?.abort();
                      setGenerating(null);
                    }
                  : undefined
              }
            />
          ))}
          {editing && (
            <div className="self-start flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-2.5">
              <Loader2 size={13} className="animate-spin text-accent" />
              <span className="text-[12.5px] text-text-secondary">Updating your presentation...</span>
            </div>
          )}
        </div>
      )}

      <div
        className={`bg-surface border rounded-[26px] transition-colors flex-shrink-0 ${
          dragging ? "border-accent" : "border-border focus-within:border-border-strong"
        }`}
        style={{ boxShadow: "0 2px 12px var(--shadow-color)" }}
      >
        <FileChips files={files} onRemove={removeFile} />

        <textarea
          ref={textareaRef}
          value={prompt}
          disabled={busy}
          onChange={(e) => {
            setPrompt(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            activeDoc
              ? "Ask for a change, or attach a file..."
              : "Describe the presentation you want to create..."
          }
          rows={1}
          className="w-full bg-transparent resize-none outline-none px-5 pt-4 pb-1 text-[15px] leading-relaxed placeholder:text-text-tertiary disabled:opacity-60"
          style={{ minHeight: 52 }}
        />

        <div className="flex items-center justify-between pl-3 pr-3 pb-3 pt-1">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-8 h-8 rounded-full border border-border text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
            title="Attach files"
            aria-label="Attach files"
          >
            <Plus size={16} />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex items-center gap-2.5">
            {!activeDoc && (
              <div
                className="flex items-center rounded-full border border-border p-0.5"
                title="How hard the model should work"
              >
                {EFFORT_LEVELS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEffort(key);
                      try {
                        localStorage.setItem("pk-effort", key);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors cursor-pointer disabled:opacity-50 ${
                      effort === key
                        ? "bg-text text-bg font-medium"
                        : "text-text-secondary hover:text-text"
                    }`}
                    title={EFFORT[key].hint}
                  >
                    {EFFORT[key].label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={send}
              disabled={!canSend}
              className="w-8 h-8 rounded-full bg-text text-bg flex items-center justify-center transition-opacity hover:opacity-85 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
              aria-label={activeDoc ? "Send edit" : "Generate presentation"}
              title="Send (Enter)"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {!threadActive && prompt.length === 0 && files.length === 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setPrompt(s);
                textareaRef.current?.focus();
                requestAnimationFrame(autoGrow);
              }}
              className="text-[12.5px] text-text-secondary border border-border rounded-full px-3 py-1.5 hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadMessage({
  message,
  doc,
  onCancelGenerate,
}: {
  message: ChatMessage;
  doc: Presentation | null;
  onCancelGenerate?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="self-end max-w-[85%] rounded-2xl bg-surface-3 px-4 py-2.5 text-[14px] leading-relaxed">
        {message.text}
        {message.files && message.files.length > 0 && (
          <div className="mt-1.5 text-[11.5px] text-text-tertiary">{message.files.join(" · ")}</div>
        )}
      </div>
    );
  }

  if (message.kind === "progress") {
    return <ProgressCard progress={message.progress} onCancel={onCancelGenerate} />;
  }

  if (message.kind === "error") {
    return (
      <div className="self-start max-w-[90%] rounded-2xl bg-danger/10 border border-danger/30 text-danger px-4 py-2.5 text-[13.5px]">
        <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />
        {message.text}
      </div>
    );
  }

  if (message.kind === "edit") {
    return (
      <div className="self-start max-w-[90%] rounded-2xl bg-surface border border-border px-4 py-2.5 text-[13.5px] leading-relaxed">
        {message.text}
      </div>
    );
  }

  if (!doc || doc.id !== message.presentationId) {
    return (
      <div className="self-start text-[13px] text-text-secondary">Presentation ready.</div>
    );
  }

  return (
    <div className="self-stretch bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <div className="text-[14px] font-medium">{doc.title}</div>
        <div className="text-[12px] text-text-tertiary mt-0.5">
          {doc.slides.length} slides · stay here to keep editing, or open the canvas
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {doc.slides.slice(0, 6).map((slide) => (
          <SlideRenderer
            key={slide.id}
            slide={slide}
            theme={doc.theme}
            mode="thumb"
            rounded
            className="border border-border"
          />
        ))}
      </div>
      <div className="px-4 pb-3.5 flex items-center gap-2">
        <Link
          href={`/editor/${doc.id}`}
          className="flex items-center gap-1.5 text-[12.5px] font-medium border border-border rounded-lg px-3 py-1.5 hover:bg-surface-2 transition-colors"
        >
          <PencilRuler size={13} />
          Open editor
        </Link>
        <Link
          href={`/presentations/${doc.id}`}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors"
        >
          <Play size={13} />
          Present
        </Link>
      </div>
    </div>
  );
}

function ProgressCard({
  progress,
  onCancel,
}: {
  progress: GenProgress;
  onCancel?: () => void;
}) {
  const activeStageIdx = Math.max(0, GEN_STAGES.findIndex((s) => s.key === progress.stage));
  return (
    <div className="self-stretch bg-surface border border-border rounded-2xl px-5 py-4">
      <div className="flex flex-col gap-2">
        {GEN_STAGES.map((stage, i) => {
          const isDone = i < activeStageIdx;
          const isActive = i === activeStageIdx;
          return (
            <div
              key={stage.key}
              className="flex items-center gap-2.5 transition-opacity duration-300"
              style={{ opacity: isDone || isActive ? 1 : 0.35 }}
            >
              {isDone ? (
                <Check size={13} className="text-success flex-shrink-0" strokeWidth={3} />
              ) : isActive ? (
                <Loader2 size={13} className="animate-spin text-accent flex-shrink-0" />
              ) : (
                <span className="w-[13px] h-[13px] rounded-full border border-border-strong flex-shrink-0" />
              )}
              <span className={`text-[13px] ${isActive ? "font-medium" : "text-text-secondary"}`}>
                {stage.label}
                {isActive && progress.detail ? (
                  <span className="text-text-tertiary font-normal"> — {progress.detail}</span>
                ) : null}
              </span>
              {isActive && progress.total ? (
                <span className="ml-auto text-[11.5px] text-text-tertiary tabular-nums">
                  {Math.min(progress.done ?? 0, progress.total)}/{progress.total}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {progress.stage === "designing" && progress.total ? (
        <div className="mt-3 h-1 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, ((progress.done ?? 0) / progress.total) * 100)}%`,
            }}
          />
        </div>
      ) : null}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 text-[12px] text-text-tertiary hover:text-text transition-colors cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
