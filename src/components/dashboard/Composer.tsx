"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp, Plus, UploadCloud, AlertCircle, Check, Loader2, PencilRuler, Play, PlusCircle,
  Presentation as PresentationIcon, Globe, Gamepad2, AppWindow, MessageCircle, Rocket, Copy,
} from "lucide-react";
import { aiEdit, chatWithAI, getPresentation, publishPresentation, savePresentation } from "@/lib/api";
import { parseEffort, type Effort } from "@/lib/effort";
import { ATTACH_ACCEPT, useAttachments } from "@/lib/use-attachments";
import { EffortPicker } from "@/components/chat/EffortPicker";
import { FileChips } from "@/components/chat/FileChips";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { assemblePreviewHtml } from "@/lib/web-preview";
import { isWebKind, type ChatTurn, type Presentation, type ProjectKind } from "@/lib/schema";

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
  { key: "planning", label: "Planning the structure" },
  { key: "designing", label: "Designing and building" },
  { key: "interactive", label: "Adding interactions" },
  { key: "finalising", label: "Finalising" },
];

/** What the composer is set to make — a project kind, or plain conversation. */
type ComposerMode = ProjectKind | "chat";

const KIND_OPTIONS: { kind: ComposerMode; label: string; icon: typeof Globe }[] = [
  { kind: "chat", label: "Chat", icon: MessageCircle },
  { kind: "presentation", label: "Presentation", icon: PresentationIcon },
  { kind: "website", label: "Website", icon: Globe },
  { kind: "game", label: "Game", icon: Gamepad2 },
  { kind: "app", label: "App", icon: AppWindow },
];

const KIND_PLACEHOLDER: Record<ComposerMode, string> = {
  chat: "Chat with Studio about anything...",
  presentation: "Chat, or describe the presentation you want to create...",
  website: "Chat, or describe the website you want to build...",
  game: "Chat, or describe the game you want to play...",
  app: "Chat, or describe the app you want to build...",
};

const SUGGESTIONS: Record<ComposerMode, string[]> = {
  chat: [
    "Help me brainstorm ideas",
    "What can you build for me?",
    "Explain something to me",
    "Give me feedback on a plan",
  ],
  presentation: [
    "Company overview deck",
    "Q3 performance review",
    "Product launch pitch",
    "Team onboarding training",
  ],
  website: [
    "Personal portfolio site",
    "Landing page for a coffee shop",
    "Event invite page with RSVP",
    "One-page product site",
  ],
  game: [
    "Snake game with a scoreboard",
    "Memory card matching game",
    "Trivia quiz game",
    "2D platformer with keyboard controls",
  ],
  app: [
    "Expense splitter calculator",
    "Pomodoro timer with tasks",
    "Habit tracker with streaks",
    "Markdown notes app",
  ],
};

function toChatTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m): m is Exclude<ChatMessage, { kind: "progress" }> => m.role === "user" || m.kind !== "progress")
    .map((m) => {
      if (m.role === "user") return { id: m.id, role: "user" as const, text: m.text, files: m.files };
      return {
        id: m.id,
        role: "assistant" as const,
        text: m.kind === "result" ? "Created the project. Try it out — then ask for a change." : m.text,
        kind: m.kind === "error" ? "error" : m.kind === "edit" ? "edit" : "result",
      };
    });
}

function fromChatTurns(turns: ChatTurn[], presentationId: string): ChatMessage[] {
  return turns.map((t) => {
    if (t.role === "user") return { id: t.id, role: "user" as const, text: t.text, files: t.files };
    if (t.kind === "error") return { id: t.id, role: "assistant" as const, kind: "error" as const, text: t.text };
    if (t.kind === "edit") return { id: t.id, role: "assistant" as const, kind: "edit" as const, text: t.text };
    return { id: t.id, role: "assistant" as const, kind: "result" as const, presentationId };
  });
}

export function Composer({
  continueId,
  onThreadChange,
  onCreated,
  onReset,
}: {
  continueId?: string | null;
  onThreadChange?: (active: boolean) => void;
  onCreated?: () => void;
  onReset?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState<GenProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [effort, setEffort] = useState<Effort>("standard");
  const [kind, setKind] = useState<ComposerMode>("presentation");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeDoc, setActiveDoc] = useState<Presentation | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { files, addFiles, removeFile, clearFiles, readySources, uploading, inputRef } =
    useAttachments();
  const loadedId = useRef<string | null>(null);

  const threadActive = messages.length > 0;

  useEffect(() => {
    if (!continueId || loadedId.current === continueId) return;
    loadedId.current = continueId;
    abortRef.current?.abort();
    setGenerating(null);
    setEditing(false);
    void (async () => {
      try {
        const doc = await getPresentation(continueId);
        setActiveDoc(doc);
        setMessages(
          doc.chatThread?.length
            ? fromChatTurns(doc.chatThread, doc.id)
            : [{ id: `r-${doc.id}`, role: "assistant", kind: "result", presentationId: doc.id }]
        );
      } catch {
        setMessages([
          {
            id: "e-load",
            role: "assistant",
            kind: "error",
            text: "Couldn't reopen that presentation. Try again from Recents.",
          },
        ]);
      }
    })();
  }, [continueId]);

  async function persistThread(doc: Presentation, msgs: ChatMessage[]) {
    try {
      await savePresentation({ ...doc, chatThread: toChatTurns(msgs) });
    } catch {
      /* keep chatting even if history fails to save */
    }
  }

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

  const busy = !!generating || editing || chatting;
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
    loadedId.current = null;
    onThreadChange?.(false);
    onReset?.();
  }, [clearFiles, onThreadChange, onReset]);

  function pushUser(text: string, attachedNames: string[] = []) {
    setMessages((m) => [
      ...m,
      { id: `u${Date.now()}`, role: "user", text, files: attachedNames },
    ]);
  }

  async function generate(preText?: string) {
    const usingPre = typeof preText === "string";
    if (!usingPre && !canSend) return;
    const text = usingPre
      ? preText
      : prompt.trim() ||
        (readySources.length > 0 ? "Create a presentation from the attached files." : "");
    if (!text) return;
    const attached = usingPre ? [] : readySources;
    if (!usingPre) {
      const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
      setPrompt("");
      clearFiles();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      pushUser(text, attachedNames);
    }
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
        body: JSON.stringify({
          prompt: text,
          files: attached,
          effort,
          kind: kind === "chat" ? "presentation" : kind,
        }),
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
      setGenerating(null);
      loadedId.current = doc.id;
      setMessages((m) => {
        const next = m.map((msg) =>
          msg.id === progressId
            ? { id: progressId, role: "assistant" as const, kind: "result" as const, presentationId: finishedId }
            : msg
        );
        const withThread = { ...doc, chatThread: toChatTurns(next) };
        setActiveDoc(withThread);
        void persistThread(withThread, next);
        return next;
      });
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

  async function editDeck(preText?: string) {
    const usingPre = typeof preText === "string";
    if (!activeDoc || (!usingPre && !canSend)) return;
    const text = usingPre
      ? preText
      : prompt.trim() ||
        (readySources.length > 0 ? "Incorporate the attached files into the presentation." : "");
    if (!text) return;
    const attached = usingPre ? [] : readySources;
    if (!usingPre) {
      const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
      setPrompt("");
      clearFiles();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      pushUser(text, attachedNames);
    }
    setEditing(true);
    try {
      const result = await aiEdit({
        presentationId: activeDoc.id,
        instruction: text,
        presentation: activeDoc,
        files: attached,
      });
      const nextDoc = result.changed ? result.presentation : activeDoc;
      const editMsg = { id: `a${Date.now()}`, role: "assistant" as const, kind: "edit" as const, text: result.summary };
      setMessages((m) => {
        const next = [...m, editMsg];
        const withThread = { ...nextDoc, chatThread: toChatTurns(next) };
        setActiveDoc(withThread);
        void persistThread(withThread, next);
        return next;
      });
      onCreated?.();
    } catch (e) {
      setMessages((m) => {
        const next: ChatMessage[] = [
          ...m,
          {
            id: `e${Date.now()}`,
            role: "assistant",
            kind: "error",
            text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
          },
        ];
        void persistThread(activeDoc, next);
        return next;
      });
    } finally {
      setEditing(false);
    }
  }

  function send() {
    if (!canSend) return;
    const chatMode = kind === "chat" && !activeDoc;
    // Attached files mean "build/edit with these" — except in pure chat mode,
    // where they become conversation sources.
    if (readySources.length > 0 && !chatMode) {
      if (activeDoc) void editDeck();
      else void generate();
      return;
    }
    void routeMessage();
  }

  /** Let the assistant decide: answer conversationally, or kick off a build/edit. */
  async function routeMessage() {
    const chatMode = kind === "chat" && !activeDoc;
    const text =
      prompt.trim() || (chatMode && readySources.length > 0 ? "What do you make of these files?" : "");
    if (!text) return;
    const sources = chatMode ? readySources : undefined;
    const attachedNames = chatMode
      ? files.filter((f) => f.status === "done").map((f) => f.name)
      : [];
    setPrompt("");
    if (chatMode) clearFiles();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    pushUser(text, attachedNames);
    setChatting(true);

    const history: { role: "user" | "assistant"; text: string }[] = [];
    for (const m of messages) {
      if (m.role === "user") history.push({ role: "user", text: m.text });
      else if (m.kind === "edit" || m.kind === "error") history.push({ role: "assistant", text: m.text });
    }

    let decision: { mode: "chat" | "build"; reply: string };
    try {
      decision = await chatWithAI({
        messages: [...history.slice(-12), { role: "user", text }],
        hasProject: !!activeDoc,
        kind: activeDoc?.kind ?? (kind === "chat" ? undefined : kind),
        forceChat: chatMode,
        sources,
      });
    } catch (e) {
      if (chatMode) {
        // Pure chat has no build fallback — surface the error.
        setChatting(false);
        setMessages((m) => [
          ...m,
          {
            id: `e${Date.now()}`,
            role: "assistant",
            kind: "error",
            text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
          },
        ]);
        return;
      }
      // If the router fails, fall back to the build path so nothing is lost.
      decision = { mode: "build", reply: "" };
    }
    setChatting(false);

    if (decision.mode === "chat") {
      const reply: ChatMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        kind: "edit",
        text: decision.reply,
      };
      setMessages((m) => {
        const next = [...m, reply];
        if (activeDoc) {
          const withThread = { ...activeDoc, chatThread: toChatTurns(next) };
          setActiveDoc(withThread);
          void persistThread(withThread, next);
        }
        return next;
      });
      return;
    }

    if (activeDoc) await editDeck(text);
    else await generate(text);
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
              {activeDoc?.title ?? "New project"}
            </div>
            {activeDoc && (
              <div className="text-[11.5px] text-text-tertiary">
                {isWebKind(activeDoc.kind)
                  ? `${activeDoc.kind} · keep chatting to edit`
                  : `${activeDoc.slides.length} slide${activeDoc.slides.length === 1 ? "" : "s"} · keep chatting to edit`}
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
                  target={isWebKind(activeDoc.kind) ? "_blank" : undefined}
                  className="flex items-center gap-1.5 text-[12px] font-medium bg-accent text-accent-text rounded-lg px-2.5 py-1.5 hover:bg-accent-hover transition-colors"
                >
                  <Play size={12} />
                  {isWebKind(activeDoc.kind) ? "Open" : "Present"}
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
              <span className="text-[12.5px] text-text-secondary">Working on it...</span>
            </div>
          )}
          {chatting && (
            <div className="self-start flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-2.5">
              <Loader2 size={13} className="animate-spin text-accent" />
              <span className="text-[12.5px] text-text-secondary">Thinking...</span>
            </div>
          )}
        </div>
      )}

      {!activeDoc && !threadActive && (
        <div className="flex justify-center gap-1.5 mb-3">
          {KIND_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = kind === opt.kind;
            return (
              <button
                key={opt.kind}
                type="button"
                onClick={() => setKind(opt.kind)}
                className={`flex items-center gap-1.5 text-[12.5px] font-medium rounded-full px-3.5 py-1.5 border transition-colors cursor-pointer ${
                  active
                    ? "bg-text text-bg border-transparent"
                    : "border-border text-text-secondary hover:text-text hover:bg-surface-2"
                }`}
              >
                <Icon size={13} />
                {opt.label}
              </button>
            );
          })}
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
            activeDoc ? "Ask for a change, ask a question, or just chat..." : KIND_PLACEHOLDER[kind]
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
            {!activeDoc && kind !== "chat" && (
              <EffortPicker
                value={effort}
                disabled={busy}
                onChange={(next) => {
                  setEffort(next);
                  try {
                    localStorage.setItem("pk-effort", next);
                  } catch {
                    /* ignore */
                  }
                }}
              />
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
          {SUGGESTIONS[kind].map((s) => (
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
      <div className="self-start text-[13px] text-text-secondary">Project ready.</div>
    );
  }

  if (isWebKind(doc.kind)) return <WebProjectCard doc={doc} />;
  return <LiveDeckCard doc={doc} />;
}

function WebProjectCard({ doc }: { doc: Presentation }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [activeFile, setActiveFile] = useState(doc.entry);
  const [deploying, setDeploying] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const html = assemblePreviewHtml(doc.files, doc.entry);
  const label = doc.kind === "game" ? "game" : doc.kind === "app" ? "app" : "website";
  const file = doc.files?.find((f) => f.path === activeFile) ?? doc.files?.[0];

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
    <div className="self-stretch bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-medium truncate">{doc.title}</div>
          <div className="text-[12px] text-text-tertiary mt-0.5">
            Your {label} is live below — try it, then type a change.
          </div>
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
        <div className="px-4 pb-3">
          <iframe
            key={doc.updatedAt}
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals"
            className="w-full rounded-lg border border-border bg-white"
            style={{ height: 420 }}
            title={doc.title}
          />
        </div>
      ) : (
        <div className="px-4 pb-3">
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
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="flex-1" />
        <Link
          href={`/editor/${doc.id}`}
          className="flex items-center gap-1.5 text-[12.5px] font-medium border border-border rounded-lg px-3 py-1.5 hover:bg-surface-2 transition-colors"
        >
          <PencilRuler size={13} />
          Open editor
        </Link>
        <Link
          href={`/presentations/${doc.id}`}
          target="_blank"
          className="flex items-center gap-1.5 text-[12.5px] font-medium border border-border rounded-lg px-3 py-1.5 hover:bg-surface-2 transition-colors"
        >
          <Play size={13} />
          Full screen
        </Link>
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
  return (
    <div className="self-stretch bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <div className="text-[14px] font-medium">{doc.title}</div>
        <div className="text-[12px] text-text-tertiary mt-0.5">
          Click the slide — flip cards, tabs, quizzes, and buttons work. Then type a change below.
        </div>
      </div>
      <div className="px-4 pb-3">
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
      <div className="px-4 pb-3 flex items-center gap-2">
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
        <div className="flex-1" />
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
