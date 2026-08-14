"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, FileText, FileSpreadsheet, Presentation as PresIcon, ImageIcon,
  File as FileIcon, X, Plus, UploadCloud, AlertCircle, Check, Loader2, Sparkles,
} from "lucide-react";
import { extractFile, type UploadedSource } from "@/lib/api";

interface PendingFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  source?: UploadedSource;
  previewUrl?: string;
}

interface GenProgress {
  stage: string;
  detail?: string;
  done?: number;
  total?: number;
  error?: string;
}

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

function kindIcon(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return ImageIcon;
  if ([".csv", ".tsv", ".json"].includes(ext)) return FileSpreadsheet;
  if (ext === ".pptx") return PresIcon;
  if ([".pdf", ".docx", ".txt", ".md"].includes(ext)) return FileText;
  return FileIcon;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState<GenProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming).slice(0, 8);
    for (const file of list) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const isImage = file.type.startsWith("image/");
      const entry: PendingFile = {
        id,
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 0,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      };
      setFiles((prev) => [...prev, entry]);
      extractFile(file, (pct) =>
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)))
      )
        .then((source) =>
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, source } : f))
          )
        )
        .catch((e) =>
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: "error", error: e.message ?? "Upload failed" } : f
            )
          )
        );
    }
  }, []);

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

  // Auto-grow the textarea like ChatGPT's composer.
  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  const readySources = files.filter((f) => f.status === "done" && f.source).map((f) => f.source!);
  const uploading = files.some((f) => f.status === "uploading");
  const canGenerate =
    (prompt.trim().length > 0 || readySources.length > 0) && !uploading && !generating;

  async function generate() {
    if (!canGenerate) return;
    setGenerating({ stage: "analysing" });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), files: readySources }),
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
            setGenerating({
              stage: data.stage,
              detail: data.detail,
              done: data.done,
              total: data.total,
            });
          }
        }
      }

      if (!finishedId) throw new Error("Generation ended unexpectedly. Please try again.");
      setGenerating({ stage: "finalising", detail: "Opening the editor" });
      router.push(`/editor/${finishedId}`);
    } catch (e) {
      if (controller.signal.aborted) {
        setGenerating(null);
        return;
      }
      setGenerating({ stage: "error", error: e instanceof Error ? e.message : "Generation failed." });
    }
  }

  const failed = generating?.stage === "error";
  const activeStageIdx = generating
    ? Math.max(0, GEN_STAGES.findIndex((s) => s.key === generating.stage))
    : -1;

  return (
    <div className="w-full max-w-[680px] mx-auto">
      {/* Full-window drop veil */}
      {dragging && (
        <div className="fixed inset-0 z-40 bg-bg/85 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in-fade">
          <div className="border-2 border-dashed border-accent rounded-2xl px-14 py-10 bg-surface flex flex-col items-center gap-3">
            <UploadCloud size={32} className="text-accent" />
            <div className="font-medium text-[14.5px]">Drop files to attach them</div>
            <div className="text-[12.5px] text-text-secondary">PDF, PowerPoint, Word, CSV, images, text</div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div
        className={`bg-surface border rounded-[26px] transition-colors ${
          dragging ? "border-accent" : "border-border focus-within:border-border-strong"
        }`}
        style={{ boxShadow: "0 2px 12px var(--shadow-color)" }}
      >
        {/* File chips */}
        {files.length > 0 && (
          <div className="px-4 pt-3.5 flex flex-wrap gap-2">
            {files.map((f) => {
              const Icon = kindIcon(f.name);
              return (
                <div
                  key={f.id}
                  className={`group relative flex items-center gap-2 rounded-xl border pl-2 pr-7 py-1.5 text-[12.5px] overflow-hidden ${
                    f.status === "error" ? "border-danger/50 bg-danger/5" : "border-border bg-surface-2"
                  }`}
                >
                  {f.status === "uploading" && (
                    <div
                      className="absolute inset-y-0 left-0 bg-accent/10 transition-all duration-200"
                      style={{ width: `${f.progress}%` }}
                    />
                  )}
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" className="w-7 h-7 rounded-md object-cover relative" />
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-surface-3 flex items-center justify-center relative">
                      <Icon size={13} className="text-text-secondary" />
                    </div>
                  )}
                  <div className="relative min-w-0">
                    <div className="font-medium truncate max-w-[160px]">{f.name}</div>
                    <div className="text-[10.5px] text-text-tertiary flex items-center gap-1">
                      {f.status === "uploading" && `Uploading ${f.progress}%`}
                      {f.status === "done" && (
                        <>
                          <Check size={10} className="text-success" /> {formatSize(f.size)}
                        </>
                      )}
                      {f.status === "error" && (
                        <span className="text-danger flex items-center gap-1">
                          <AlertCircle size={10} /> {f.error}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={prompt}
          disabled={!!generating && !failed}
          onChange={(e) => {
            setPrompt(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void generate();
            }
          }}
          placeholder="Describe the presentation you want to create..."
          rows={1}
          className="w-full bg-transparent resize-none outline-none px-5 pt-4 pb-1 text-[15px] leading-relaxed placeholder:text-text-tertiary disabled:opacity-60"
          style={{ minHeight: 52 }}
        />

        {/* Bottom controls */}
        <div className="flex items-center justify-between pl-3 pr-3 pb-3 pt-1">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={!!generating && !failed}
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
            accept=".pdf,.docx,.pptx,.csv,.tsv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
              <Sparkles size={11} />
              DeepSeek
            </span>
            <button
              onClick={() => void generate()}
              disabled={!canGenerate}
              className="w-8 h-8 rounded-full bg-text text-bg flex items-center justify-center transition-opacity hover:opacity-85 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Generate presentation"
              title="Generate (Enter)"
            >
              {generating && !failed ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inline generation state — composer stays visible */}
      {generating && (
        <div
          className="mt-4 bg-surface border border-border rounded-2xl px-5 py-4 animate-rise"
          style={{ boxShadow: "0 2px 12px var(--shadow-color)" }}
        >
          {failed ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[13px] text-danger min-w-0">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span className="truncate">{generating.error}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => void generate()}
                  className="text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={() => setGenerating(null)}
                  className="text-[12.5px] text-text-secondary hover:text-text transition-colors cursor-pointer px-2 py-1.5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <>
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
                        {isActive && generating.detail ? (
                          <span className="text-text-tertiary font-normal"> — {generating.detail}</span>
                        ) : null}
                      </span>
                      {isActive && generating.total ? (
                        <span className="ml-auto text-[11.5px] text-text-tertiary tabular-nums">
                          {Math.min(generating.done ?? 0, generating.total)}/{generating.total}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {generating.stage === "designing" && generating.total ? (
                <div className="mt-3 h-1 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((generating.done ?? 0) / generating.total) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
              <button
                onClick={() => {
                  abortRef.current?.abort();
                  setGenerating(null);
                }}
                className="mt-3 text-[12px] text-text-tertiary hover:text-text transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Suggestions */}
      {!generating && prompt.length === 0 && files.length === 0 && (
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
