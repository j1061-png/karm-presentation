"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, Check, Copy, Loader2, PencilRuler, Play, Rocket, Sparkles,
} from "lucide-react";
import { publishPresentation } from "@/lib/api";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { assemblePreviewHtml } from "@/lib/web-preview";
import { ShareButton } from "@/components/share/ShareButton";
import { isWebKind, kindLabel, kindNoun, type Presentation } from "@/lib/schema";

export interface GenProgress {
  stage: string;
  detail?: string;
  done?: number;
  total?: number;
  error?: string;
}

const GEN_STAGES: { key: string; label: string }[] = [
  { key: "analysing", label: "Analysing your request" },
  { key: "planning", label: "Planning the structure" },
  { key: "designing", label: "Designing and building" },
  { key: "interactive", label: "Adding interactions" },
  { key: "finalising", label: "Finalising" },
];

export function WorkspaceCanvas({
  doc,
  generating,
  editing,
  onCancelGenerate,
}: {
  doc: Presentation | null;
  generating: GenProgress | null;
  editing: boolean;
  onCancelGenerate?: () => void;
}) {
  return (
    <section className="workspace-canvas min-h-0 flex flex-col bg-sidebar">
      <div className="flex-1 min-h-0 m-2.5 ml-0 max-[900px]:m-2.5 max-[900px]:mb-0 rounded-2xl bg-surface border border-border overflow-hidden flex flex-col">
        <header className="h-12 flex items-center justify-between gap-3 px-4 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate">
              {doc?.title ?? (generating ? "Working…" : "Canvas")}
            </div>
            {doc && (
              <div className="text-[11px] text-text-tertiary truncate">
                {isWebKind(doc.kind)
                  ? `${kindLabel(doc.kind)} · keep chatting to edit`
                  : `${doc.slides.length} slide${doc.slides.length === 1 ? "" : "s"} · keep chatting to edit`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {doc && (
              <>
                <ShareButton presentationId={doc.id} title={doc.title} />
                <Link
                  href={`/editor/${doc.id}`}
                  className="flex items-center gap-1.5 text-[12px] font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
                >
                  <PencilRuler size={12} />
                  Editor
                </Link>
                <Link
                  href={`/presentations/${doc.id}`}
                  target={isWebKind(doc.kind) ? "_blank" : undefined}
                  className="flex items-center gap-1.5 text-[12px] font-medium bg-accent text-accent-text rounded-lg px-2.5 py-1.5 hover:bg-accent-hover transition-colors"
                >
                  <Play size={12} />
                  {isWebKind(doc.kind) ? "Open" : "Present"}
                </Link>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto relative">
          {generating && (
            <div className="p-6 max-w-lg mx-auto">
              <ProgressCard progress={generating} onCancel={onCancelGenerate} />
            </div>
          )}

          {!generating && doc && (
            <div className="p-4 h-full min-h-0">
              {isWebKind(doc.kind) ? <WebProjectCard doc={doc} /> : <LiveDeckCard doc={doc} />}
            </div>
          )}

          {!generating && !doc && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-11 h-11 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                <Sparkles size={18} className="text-text-tertiary" />
              </div>
              <p className="font-serif text-[22px] tracking-tight text-text mb-1.5">
                Preview
              </p>
              <p className="text-[13px] text-text-secondary max-w-sm">
                When Studio starts building, the live presentation, site, game, or app shows up here.
              </p>
            </div>
          )}

          {editing && doc && !generating && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1.5 shadow-sm">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[12px] text-text-secondary">Updating canvas…</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function WebProjectCard({ doc }: { doc: Presentation }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [activeFile, setActiveFile] = useState(doc.entry);
  const [deploying, setDeploying] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const html = assemblePreviewHtml(doc.files, doc.entry);
  const label = kindNoun(doc.kind);
  const file = doc.files?.find((f) => f.path === activeFile) ?? doc.files?.[0];

  useEffect(() => {
    setActiveFile(doc.entry);
    setTab("preview");
  }, [doc.id, doc.updatedAt, doc.entry]);

  async function deploy() {
    if (deploying) return;
    setDeploying(true);
    setDeployError(null);
    try {
      await publishPresentation(doc.id, "link");
      setLiveUrl(`${window.location.origin}/p/${doc.id}`);
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Deploy failed.");
    } finally {
      setDeploying(false);
    }
  }
  return (
    <div className="h-full min-h-0 flex flex-col self-stretch">
      <div className="pb-2 flex items-center justify-between gap-3">
        <div className="text-[12px] text-text-tertiary truncate">
          Try the {label}, then type a change in chat.
        </div>
        <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5 flex-shrink-0">
          {(
            [
              { key: "preview", label: "Preview" },
              { key: "code", label: "Code" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[11.5px] px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                tab === t.key ? "bg-surface-3 text-text font-medium" : "text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "preview" ? (
        <div className="pb-3 flex-1 min-h-0">
          <iframe
            key={doc.updatedAt}
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals"
            className="w-full h-full min-h-[280px] rounded-lg border border-border bg-white"
            title={doc.title}
          />
        </div>
      ) : (
        <div className="pb-3 flex-1 min-h-0">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-2 border-b border-border overflow-x-auto">
              {(doc.files ?? []).map((f) => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(f.path)}
                  className={`text-[11.5px] font-mono px-2 py-1 rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                    f.path === (file?.path ?? "")
                      ? "bg-surface-3 text-text"
                      : "text-text-secondary hover:text-text"
                  }`}
                >
                  {f.path}
                </button>
              ))}
            </div>
            <pre
              className="m-0 p-3 overflow-auto text-[11.5px] font-mono leading-relaxed bg-bg text-text-secondary"
              style={{ height: 420 }}
            >
              {file?.content ?? ""}
            </pre>
          </div>
        </div>
      )}
      {liveUrl && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-success/10 border border-success/30 rounded-xl px-3 py-2">
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span className="relative inline-flex rounded-full w-2 h-2 bg-success" />
          </span>
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-mono text-success truncate hover:underline flex-1 min-w-0"
          >
            {liveUrl}
          </a>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(liveUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-success/80 hover:text-success cursor-pointer flex-shrink-0"
            aria-label="Copy live URL"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
      {deployError && (
        <div className="mx-4 mb-2 text-[12px] text-danger flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" /> {deployError}
        </div>
      )}
      <div className="pb-3 flex items-center justify-end gap-2">
        <button
          onClick={() => void deploy()}
          disabled={deploying}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
        >
          {deploying ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
          {liveUrl ? "Redeploy" : "Deploy"}
        </button>
      </div>
    </div>
  );
}

function LiveDeckCard({ doc }: { doc: Presentation }) {
  const [index, setIndex] = useState(0);
  const slide = doc.slides[Math.min(index, doc.slides.length - 1)];
  useEffect(() => {
    setIndex(0);
  }, [doc.id, doc.updatedAt]);
  return (
    <div className="h-full min-h-0 flex flex-col self-stretch">
      <div className="pb-2 text-[12px] text-text-tertiary">
        Click the slide to try it, then type a change in chat.
      </div>
      <div className="pb-3 flex-1 min-h-0">
        <SlideRenderer
          slide={slide}
          theme={doc.theme}
          mode="live"
          animateKey={slide.id}
          rounded
          className="border border-border"
          onAction={(a) => {
            if (a.type === "next-slide") setIndex((i) => Math.min(doc.slides.length - 1, i + 1));
            if (a.type === "prev-slide") setIndex((i) => Math.max(0, i - 1));
            if (a.type === "goto-slide" && a.targetSlide !== undefined) {
              setIndex(Math.max(0, Math.min(doc.slides.length - 1, a.targetSlide)));
            }
          }}
        />
      </div>
      <div className="pb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="text-[12px] text-text-secondary hover:text-text disabled:opacity-30 cursor-pointer"
        >
          Previous
        </button>
        <span className="text-[12px] text-text-tertiary tabular-nums">
          {index + 1} / {doc.slides.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(doc.slides.length - 1, i + 1))}
          disabled={index === doc.slides.length - 1}
          className="text-[12px] text-text-secondary hover:text-text disabled:opacity-30 cursor-pointer"
        >
          Next
        </button>
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
