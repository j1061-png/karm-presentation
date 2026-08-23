"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  chatWithAI, generateProject, type UploadedSource,
} from "@/lib/api";
import { ATTACH_ACCEPT, formatFileSize, useAttachments } from "@/lib/use-attachments";
import {
  Plus, ArrowUp, Loader2, AlertCircle, FileText, Trash2, X, ClipboardPaste,
  Presentation as PresentationIcon, HelpCircle, Layers, FileBarChart2,
  Network, Table2, Gamepad2, ExternalLink, Sparkles, StickyNote, NotebookPen,
} from "lucide-react";

/**
 * Notebooks: NotebookLM-style workspaces. Each notebook has its own sources,
 * grounded chat, and generated studio outputs. Users can create, rename,
 * switch, and delete notebooks.
 */

interface NotebookSource {
  id: string;
  name: string;
  kind: string;
  content: string;
}

interface NotebookMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

interface NotebookOutput {
  id: string;
  title: string;
  label: string;
  createdAt: string;
}

interface Notebook {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sources: NotebookSource[];
  messages: NotebookMessage[];
  outputs: NotebookOutput[];
}

interface NotebookStore {
  notebooks: Notebook[];
  activeId: string;
}

interface StudioAction {
  key: string;
  label: string;
  icon: typeof Plus;
  tint: string;
  kind: "presentation" | "website" | "game" | "app";
  prompt: string;
}

const STUDIO_ACTIONS: StudioAction[] = [
  {
    key: "deck",
    label: "Slide deck",
    icon: PresentationIcon,
    tint: "#f5a623",
    kind: "presentation",
    prompt:
      "Create a rich interactive presentation covering the key insights, figures, and takeaways of the attached source material.",
  },
  {
    key: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    tint: "#7c9cf5",
    kind: "presentation",
    prompt:
      "Create an interactive quiz deck that tests understanding of the attached source material. Most content slides should feature quiz widgets with plausible wrong answers, plus a title slide and a results/recap close.",
  },
  {
    key: "flashcards",
    label: "Flashcards",
    icon: Layers,
    tint: "#e66df2",
    kind: "presentation",
    prompt:
      "Create a flashcard study deck from the attached source material. Every content slide should use flip cards — term or question on the front, clear explanation on the back — grouped by topic.",
  },
  {
    key: "report",
    label: "Report",
    icon: FileBarChart2,
    tint: "#5ecf8a",
    kind: "website",
    prompt:
      "Build a clean, beautifully typeset single-page written report that summarizes the attached source material: an executive summary, titled sections, pull quotes, and a table of the key figures.",
  },
  {
    key: "infographic",
    label: "Infographic",
    icon: Sparkles,
    tint: "#f2786d",
    kind: "website",
    prompt:
      "Build a single-page visual infographic of the attached source material: big headline numbers, simple charts drawn with inline SVG/CSS, icons, and short punchy captions. Vertical scroll, strong visual hierarchy.",
  },
  {
    key: "mindmap",
    label: "Mind map",
    icon: Network,
    tint: "#5bc8d6",
    kind: "website",
    prompt:
      "Build an interactive mind map of the attached source material using inline SVG and JavaScript: a central topic with expandable branches, pan and zoom, and a detail panel when a node is clicked.",
  },
  {
    key: "table",
    label: "Data table",
    icon: Table2,
    tint: "#b48af5",
    kind: "app",
    prompt:
      "Build an interactive data explorer over the key data points extracted from the attached source material: a searchable, sortable table with column filters and a summary row.",
  },
  {
    key: "game",
    label: "Game",
    icon: Gamepad2,
    tint: "#f5d76d",
    kind: "game",
    prompt:
      "Build a fun, playable browser game that teaches the attached source material — for example a fast-paced quiz arcade with score, streaks, and a results screen.",
  },
];

const STORE_KEY = "studio-notebooks-v2";
const LEGACY_KEY = "studio-notebook-v1";
const MAX_SOURCE_CHARS = 60_000;

function sid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function blankNotebook(title = "Untitled notebook"): Notebook {
  const now = new Date().toISOString();
  return { id: sid(), title, createdAt: now, updatedAt: now, sources: [], messages: [], outputs: [] };
}

function loadStore(): NotebookStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<NotebookStore>;
      if (Array.isArray(data.notebooks) && data.notebooks.length > 0) {
        const activeId = data.notebooks.some((n) => n.id === data.activeId)
          ? (data.activeId as string)
          : data.notebooks[0].id;
        return { notebooks: data.notebooks, activeId };
      }
    }
    // Migrate the old single-notebook format.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as Partial<{
        sources: NotebookSource[];
        messages: NotebookMessage[];
        outputs: NotebookOutput[];
      }>;
      const nb = blankNotebook("My notebook");
      nb.sources = Array.isArray(data.sources) ? data.sources : [];
      nb.messages = Array.isArray(data.messages) ? data.messages : [];
      nb.outputs = Array.isArray(data.outputs) ? data.outputs : [];
      localStorage.removeItem(LEGACY_KEY);
      return { notebooks: [nb], activeId: nb.id };
    }
  } catch {
    /* start fresh */
  }
  const nb = blankNotebook();
  return { notebooks: [nb], activeId: nb.id };
}

export function NotebookView() {
  const [store, setStore] = useState<NotebookStore | null>(null);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [genDetail, setGenDetail] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { files, addFiles, removeFile, uploading, inputRef } = useAttachments(10);
  const absorbed = useRef(new Set<string>());
  // Ref mirror so async flows always write into the notebook they started in.
  const activeIdRef = useRef<string>("");

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    if (!store) return;
    activeIdRef.current = store.activeId;
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          ...store,
          notebooks: store.notebooks.map((n) => ({
            ...n,
            messages: n.messages.slice(-40),
            outputs: n.outputs.slice(0, 20),
          })),
        })
      );
    } catch {
      /* storage full — keep in memory */
    }
  }, [store]);

  const nb = store?.notebooks.find((n) => n.id === store.activeId) ?? null;

  /** Update one notebook by id (defaults to the notebook active when called). */
  const updateNotebook = useCallback(
    (updater: (n: Notebook) => Notebook, id?: string) => {
      const target = id ?? activeIdRef.current;
      setStore((s) =>
        s
          ? {
              ...s,
              notebooks: s.notebooks.map((n) =>
                n.id === target ? { ...updater(n), updatedAt: new Date().toISOString() } : n
              ),
            }
          : s
      );
    },
    []
  );

  // Absorb finished uploads into the active notebook's sources.
  useEffect(() => {
    for (const f of files) {
      if (f.status !== "done" || !f.source || absorbed.current.has(f.id)) continue;
      absorbed.current.add(f.id);
      const src = f.source as UploadedSource;
      updateNotebook((n) => ({
        ...n,
        sources: [
          ...n.sources,
          {
            id: sid(),
            name: src.name || f.name,
            kind: src.kind || "file",
            content: (src.content ?? "").slice(0, MAX_SOURCE_CHARS),
          },
        ],
      }));
      removeFile(f.id);
    }
  }, [files, removeFile, updateNotebook]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [nb?.messages, chatting]);

  // ------------------------------------------------- notebook management
  function createNotebook() {
    const fresh = blankNotebook();
    setStore((s) => (s ? { notebooks: [fresh, ...s.notebooks], activeId: fresh.id } : s));
  }

  function deleteNotebook() {
    if (!store || !nb) return;
    if (!confirm(`Delete “${nb.title}”? Its sources and chat cannot be recovered.`)) return;
    setStore((s) => {
      if (!s) return s;
      const remaining = s.notebooks.filter((n) => n.id !== s.activeId);
      if (remaining.length === 0) {
        const fresh = blankNotebook();
        return { notebooks: [fresh], activeId: fresh.id };
      }
      return { notebooks: remaining, activeId: remaining[0].id };
    });
  }

  // -------------------------------------------------------------- chat
  async function send(textOverride?: string) {
    if (!nb) return;
    const text = (textOverride ?? input).trim();
    if (!text || chatting) return;
    const notebookId = nb.id;
    setInput("");
    const userMsg: NotebookMessage = { id: sid(), role: "user", text };
    updateNotebook((n) => ({ ...n, messages: [...n.messages, userMsg] }), notebookId);
    setChatting(true);
    try {
      const history = [...nb.messages, userMsg].slice(-12).map((m) => ({ role: m.role, text: m.text }));
      const decision = await chatWithAI({
        messages: history,
        hasProject: false,
        kind: "presentation",
        sources: nb.sources.map((s) => ({ name: s.name, content: s.content })),
      });
      if (decision.mode === "chat") {
        updateNotebook(
          (n) => ({ ...n, messages: [...n.messages, { id: sid(), role: "assistant", text: decision.reply }] }),
          notebookId
        );
      } else {
        setChatting(false);
        await runGeneration("chat", "Custom", "presentation", text);
        return;
      }
    } catch (e) {
      updateNotebook(
        (n) => ({
          ...n,
          messages: [
            ...n.messages,
            {
              id: sid(),
              role: "assistant",
              text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
              error: true,
            },
          ],
        }),
        notebookId
      );
    } finally {
      setChatting(false);
    }
  }

  // ------------------------------------------------------ studio output
  async function runGeneration(
    key: string,
    label: string,
    kind: StudioAction["kind"],
    prompt: string
  ) {
    if (genBusy || !nb) return;
    const notebookId = nb.id;
    setGenBusy(key);
    setGenError(null);
    setGenDetail("Starting...");
    try {
      const id = await generateProject(
        {
          prompt,
          kind,
          files: nb.sources.map((s) => ({ name: s.name, kind: s.kind, content: s.content })),
        },
        (s) => setGenDetail(s.detail ?? s.stage)
      );
      const output: NotebookOutput = {
        id,
        title: label,
        label,
        createdAt: new Date().toISOString(),
      };
      updateNotebook(
        (n) => ({
          ...n,
          outputs: [output, ...n.outputs],
          messages: [
            ...n.messages,
            {
              id: sid(),
              role: "assistant",
              text: `Done — your ${label.toLowerCase()} is ready in Studio outputs on the right.`,
            },
          ],
        }),
        notebookId
      );
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenBusy(null);
      setGenDetail("");
    }
  }

  function addPastedText() {
    const content = pasteText.trim();
    if (!content || !nb) return;
    updateNotebook((n) => ({
      ...n,
      sources: [
        ...n.sources,
        {
          id: sid(),
          name: pasteName.trim() || `Pasted text ${n.sources.length + 1}`,
          kind: "text",
          content: content.slice(0, MAX_SOURCE_CHARS),
        },
      ],
    }));
    setPasteText("");
    setPasteName("");
    setPasteOpen(false);
  }

  if (!store || !nb) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const hasSources = nb.sources.length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ------------------------------------------------ notebook bar */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl pl-3 pr-2 py-1.5 min-w-0">
          <NotebookPen size={14} className="text-accent flex-shrink-0" />
          <input
            value={nb.title}
            onChange={(e) => updateNotebook((n) => ({ ...n, title: e.target.value }), nb.id)}
            onBlur={() =>
              updateNotebook((n) => ({ ...n, title: n.title.trim() || "Untitled notebook" }), nb.id)
            }
            className="bg-transparent text-[13.5px] font-medium outline-none w-[220px] max-w-[40vw]"
            aria-label="Notebook title"
          />
        </div>

        {store.notebooks.length > 1 && (
          <select
            value={store.activeId}
            onChange={(e) => setStore((s) => (s ? { ...s, activeId: e.target.value } : s))}
            className="bg-surface border border-border rounded-xl px-2.5 py-2 text-[12.5px] text-text-secondary outline-none cursor-pointer focus:border-border-strong max-w-[220px]"
            aria-label="Switch notebook"
          >
            {store.notebooks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        <button
          onClick={deleteNotebook}
          title="Delete this notebook"
          aria-label="Delete this notebook"
          className="p-2 rounded-xl border border-border text-text-tertiary hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={createNotebook}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-text text-bg rounded-xl px-3.5 py-2 hover:opacity-85 transition-opacity cursor-pointer"
        >
          <Plus size={13} /> Create notebook
        </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 p-3">
        {/* ---------------------------------------------------- sources */}
        <div className="w-[250px] flex-shrink-0 bg-surface border border-border rounded-2xl flex flex-col min-h-0">
          <div className="px-4 pt-3.5 pb-2 text-[13px] font-semibold">Sources</div>
          <div className="px-3 pb-2 flex gap-1.5">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium border border-border rounded-xl py-2 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add sources
            </button>
            <button
              onClick={() => setPasteOpen(true)}
              title="Paste text"
              aria-label="Paste text"
              className="w-9 flex items-center justify-center border border-border rounded-xl hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary"
            >
              <ClipboardPaste size={13} />
            </button>
          </div>
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

          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 border border-border rounded-xl px-2.5 py-2">
                {f.status === "error" ? (
                  <AlertCircle size={13} className="text-danger flex-shrink-0" />
                ) : (
                  <Loader2 size={13} className="animate-spin text-accent flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] truncate">{f.name}</div>
                  <div className="text-[10.5px] text-text-tertiary">
                    {f.status === "error" ? f.error : `Reading... ${f.progress}%`}
                  </div>
                </div>
                {f.status === "error" && (
                  <button onClick={() => removeFile(f.id)} className="text-text-tertiary hover:text-text cursor-pointer">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}

            {nb.sources.map((s) => (
              <div key={s.id} className="group flex items-center gap-2 border border-border rounded-xl px-2.5 py-2">
                <FileText size={13} className="text-text-tertiary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] truncate" title={s.name}>{s.name}</div>
                  <div className="text-[10.5px] text-text-tertiary">{formatFileSize(s.content.length)} of text</div>
                </div>
                <button
                  onClick={() =>
                    updateNotebook((n) => ({ ...n, sources: n.sources.filter((x) => x.id !== s.id) }), nb.id)
                  }
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity cursor-pointer"
                  aria-label={`Remove ${s.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {!hasSources && files.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-3 py-6">
                <FileText size={18} className="text-text-tertiary" />
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Saved sources appear here.
                  <br />
                  Add files or paste text, then ask questions or create things based on them.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- chat */}
        <div className="flex-1 min-w-0 bg-surface border border-border rounded-2xl flex flex-col min-h-0">
          <div className="px-4 pt-3.5 pb-2 text-[13px] font-semibold border-b border-border">Chat</div>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5">
            {nb.messages.length === 0 && (
              <div className="max-w-[440px] mx-auto text-center mt-8">
                <div className="text-[28px] mb-3">👋</div>
                <div className="text-[18px] font-semibold mb-2">Let&apos;s start your notebook...</div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed mb-5">
                  This is your canvas to understand, create, or make progress on something new. Add
                  sources on the left, then ask questions — or generate a deck, quiz, report, and more
                  from the Studio panel.
                </p>
                <div className="flex flex-col items-center gap-1.5">
                  {["Learn about a new topic", "Summarize my sources", "What should I create from this?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="text-[12px] border border-border rounded-full px-3.5 py-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {nb.messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="self-end max-w-[85%] rounded-2xl bg-surface-3 px-4 py-2.5 text-[13.5px] leading-relaxed">
                  {m.text}
                </div>
              ) : m.error ? (
                <div key={m.id} className="self-start max-w-[90%] rounded-2xl bg-danger/10 border border-danger/30 text-danger px-4 py-2.5 text-[13px]">
                  <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="self-start max-w-[90%] rounded-2xl bg-surface-2 border border-border px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {m.text}
                </div>
              )
            )}
            {chatting && (
              <div className="self-start flex items-center gap-2.5 bg-surface-2 border border-border rounded-xl px-3.5 py-2.5">
                <Loader2 size={13} className="animate-spin text-accent" />
                <span className="text-[12.5px] text-text-secondary">Thinking...</span>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2 bg-bg border border-border rounded-2xl px-4 py-2.5 focus-within:border-border-strong transition-colors">
              <textarea
                value={input}
                disabled={chatting}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask a question or create something"
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-[13.5px] leading-relaxed placeholder:text-text-tertiary disabled:opacity-60"
              />
              <span className="text-[11px] text-text-tertiary flex-shrink-0 pb-0.5">
                {nb.sources.length} source{nb.sources.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => void send()}
                disabled={!input.trim() || chatting || uploading}
                className="w-8 h-8 rounded-full bg-text text-bg flex items-center justify-center hover:opacity-85 disabled:opacity-25 cursor-pointer flex-shrink-0"
                aria-label="Send"
              >
                {chatting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------- studio */}
        <div className="w-[280px] flex-shrink-0 bg-surface border border-border rounded-2xl flex flex-col min-h-0">
          <div className="px-4 pt-3.5 pb-2 text-[13px] font-semibold">Studio</div>
          <div className="px-3 grid grid-cols-2 gap-1.5">
            {STUDIO_ACTIONS.map((a) => {
              const Icon = a.icon;
              const busy = genBusy === a.key;
              return (
                <button
                  key={a.key}
                  disabled={!hasSources || !!genBusy}
                  onClick={() => void runGeneration(a.key, a.label, a.kind, a.prompt)}
                  title={hasSources ? `Generate ${a.label.toLowerCase()} from your sources` : "Add sources first"}
                  className="flex items-center gap-2 border border-border rounded-xl px-2.5 py-2.5 text-left hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: a.tint }} />
                  ) : (
                    <Icon size={14} className="flex-shrink-0" style={{ color: a.tint }} />
                  )}
                  <span className="text-[11.5px] font-medium truncate">{a.label}</span>
                </button>
              );
            })}
          </div>

          {genBusy && (
            <div className="mx-3 mt-2 flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
              <Loader2 size={12} className="animate-spin text-accent flex-shrink-0" />
              <span className="text-[11.5px] text-text-secondary truncate">{genDetail || "Generating..."}</span>
            </div>
          )}
          {genError && (
            <div className="mx-3 mt-2 text-[11.5px] text-danger flex items-center gap-1.5">
              <AlertCircle size={12} className="flex-shrink-0" /> {genError}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
            {nb.outputs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4">
                <StickyNote size={18} className="text-text-tertiary" />
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Studio output will be saved here.
                  <br />
                  After adding sources, click to generate a slide deck, quiz, mind map, and more!
                </div>
              </div>
            ) : (
              nb.outputs.map((o) => (
                <Link
                  key={`${o.id}-${o.createdAt}`}
                  href={`/editor/${o.id}`}
                  className="flex items-center gap-2.5 border border-border rounded-xl px-3 py-2.5 hover:bg-surface-2 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate">{o.title}</div>
                    <div className="text-[10.5px] text-text-tertiary">
                      {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <ExternalLink size={12} className="text-text-tertiary group-hover:text-text flex-shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- paste modal */}
      {pasteOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPasteOpen(false)}
        >
          <div
            className="w-full max-w-[480px] bg-surface border border-border-strong rounded-2xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Paste text source"
          >
            <div className="text-[13.5px] font-semibold">Paste text as a source</div>
            <input
              value={pasteName}
              onChange={(e) => setPasteName(e.target.value)}
              placeholder="Source name (optional)"
              className="bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-border-strong transition-colors placeholder:text-text-tertiary"
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste notes, an article, meeting minutes, data..."
              rows={8}
              className="bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-border-strong transition-colors resize-none placeholder:text-text-tertiary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPasteOpen(false)}
                className="text-[12.5px] border border-border rounded-xl px-3.5 py-2 hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={addPastedText}
                disabled={!pasteText.trim()}
                className="text-[12.5px] font-medium bg-accent text-accent-text rounded-xl px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                Add source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
