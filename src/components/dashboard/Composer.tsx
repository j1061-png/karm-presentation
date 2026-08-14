"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, FileText, FileSpreadsheet, Presentation as PresIcon, ImageIcon,
  File as FileIcon, X, UploadCloud, AlertCircle, Check,
} from "lucide-react";
import { extractFile, type UploadedSource } from "@/lib/api";
import { GenerationOverlay, type GenProgress } from "./GenerationOverlay";

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

const SUGGESTIONS = [
  "KarmSolar company overview for new investors",
  "Q3 solar farm performance review with charts",
  "Timeline of KarmSolar's projects across Egypt",
  "Training deck on solar microgrid safety",
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
  const [error, setError] = useState<string | null>(null);
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

  // Whole-window drag detection for a polished full-surface drop experience.
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

  const readySources = files.filter((f) => f.status === "done" && f.source).map((f) => f.source!);
  const uploading = files.some((f) => f.status === "uploading");
  const canGenerate = (prompt.trim().length > 0 || readySources.length > 0) && !uploading;

  async function generate() {
    if (!canGenerate) return;
    setError(null);
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      {generating && (
        <GenerationOverlay
          progress={generating}
          onCancel={() => {
            abortRef.current?.abort();
            setGenerating(null);
          }}
        />
      )}

      {/* Full-window drop veil */}
      {dragging && (
        <div className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in-fade">
          <div className="border-2 border-dashed border-accent rounded-2xl px-16 py-12 bg-surface/80 flex flex-col items-center gap-3">
            <UploadCloud size={36} className="text-accent" />
            <div className="font-medium text-[15px]">Drop files to add them</div>
            <div className="text-[13px] text-text-secondary">PDF, PowerPoint, Word, CSV, images, text</div>
          </div>
        </div>
      )}

      {/* Prompt card */}
      <div
        className={`bg-surface border rounded-2xl transition-all duration-200 shadow-xl shadow-black/20 ${
          dragging ? "border-accent" : "border-border focus-within:border-border-strong"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void generate();
            }
          }}
          placeholder="Describe the presentation you want... e.g. “An investor pitch for our new 50MW solar farm in Aswan, with financials and a project timeline”"
          rows={3}
          className="w-full bg-transparent resize-none outline-none px-5 pt-5 pb-2 text-[15px] leading-relaxed placeholder:text-text-tertiary"
        />

        {/* File chips */}
        {files.length > 0 && (
          <div className="px-4 pb-1 flex flex-wrap gap-2">
            {files.map((f) => {
              const Icon = kindIcon(f.name);
              return (
                <div
                  key={f.id}
                  className={`group relative flex items-center gap-2.5 rounded-xl border pl-2.5 pr-8 py-2 text-[13px] overflow-hidden transition-colors ${
                    f.status === "error" ? "border-danger/50 bg-danger/5" : "border-border bg-surface-2"
                  }`}
                >
                  {/* progress fill */}
                  {f.status === "uploading" && (
                    <div
                      className="absolute inset-y-0 left-0 bg-accent/10 transition-all duration-200"
                      style={{ width: `${f.progress}%` }}
                    />
                  )}
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover relative" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center relative">
                      <Icon size={15} className="text-text-secondary" />
                    </div>
                  )}
                  <div className="relative min-w-0">
                    <div className="font-medium truncate max-w-[180px]">{f.name}</div>
                    <div className="text-[11px] text-text-tertiary flex items-center gap-1">
                      {f.status === "uploading" && `Uploading ${f.progress}%`}
                      {f.status === "done" && (
                        <>
                          <Check size={11} className="text-success" /> {formatSize(f.size)}
                        </>
                      )}
                      {f.status === "error" && (
                        <span className="text-danger flex items-center gap-1">
                          <AlertCircle size={11} /> {f.error}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3.5 pb-3.5 pt-1">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <UploadCloud size={15} />
            Add files
            <span className="text-text-tertiary hidden sm:inline">or drag & drop</span>
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
          <button
            onClick={() => void generate()}
            disabled={!canGenerate}
            className="w-9 h-9 rounded-xl bg-accent text-accent-text flex items-center justify-center transition-all hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Generate presentation"
          >
            <ArrowUp size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-[13px] text-danger flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Suggestions */}
      <div className="flex flex-wrap justify-center gap-2 mt-5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setPrompt(s);
              textareaRef.current?.focus();
            }}
            className="text-[12.5px] text-text-secondary border border-border rounded-full px-3.5 py-1.5 hover:border-border-strong hover:text-text transition-colors cursor-pointer bg-surface/50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
