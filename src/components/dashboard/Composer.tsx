"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp, Plus, UploadCloud, AlertCircle, Loader2, PlusCircle,
  Presentation as PresentationIcon, Globe, Gamepad2, AppWindow, MessageCircle,
} from "lucide-react";
import { aiEdit, chatWithAI, getPresentation, savePresentation } from "@/lib/api";
import { parseEffort, type Effort } from "@/lib/effort";
import { parseSseData } from "@/lib/sse";
import { ATTACH_ACCEPT, useAttachments } from "@/lib/use-attachments";
import { EffortPicker } from "@/components/chat/EffortPicker";
import { FileChips } from "@/components/chat/FileChips";
import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { ResizeHandle, beginPanelResize } from "@/components/ui/ResizeHandle";
import { inferProjectKind, isWebKind, kindLabel, kindNoun, type ChatTurn, type Presentation, type ProjectKind } from "@/lib/schema";

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
  chat: "Chat with webo about anything...",
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
  onCanvasChange,
  headerAccessory,
  onCreated,
  onReset,
}: {
  continueId?: string | null;
  onThreadChange?: (active: boolean) => void;
  onCanvasChange?: (open: boolean) => void;
  headerAccessory?: ReactNode;
  onCreated?: () => void;
  onReset?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState<GenProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [effort, setEffort] = useState<Effort>("standard");
  const [chatWidth, setChatWidth] = useState(380);
  const [canvasPane, setCanvasPane] = useState(300);
  const [narrowSplit, setNarrowSplit] = useState(false);
  const [kind, setKind] = useState<ComposerMode>(() => {
    try {
      const saved = localStorage.getItem("pk-kind");
      if (saved === "chat" || saved === "presentation" || saved === "website" || saved === "game" || saved === "app") {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return "chat";
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeDoc, setActiveDoc] = useState<Presentation | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const { files, addFiles, removeFile, clearFiles, readySources, uploading, inputRef } =
    useAttachments();
  const loadedId = useRef<string | null>(null);

  const threadActive = messages.length > 0;
  const showCanvas = !!generating || !!activeDoc;

  useEffect(() => {
    if (!continueId || loadedId.current === continueId) return;
    loadedId.current = continueId;
    const myRun = ++runId.current;
    abortRef.current?.abort();
    setGenerating(null);
    setEditing(false);
    setChatting(false);
    void (async () => {
      try {
        const doc = await getPresentation(continueId);
        if (myRun !== runId.current) return;
        setActiveDoc(doc);
        if (doc.kind === "website" || doc.kind === "game" || doc.kind === "app" || doc.kind === "presentation") {
          setKind(doc.kind);
        }
        setMessages(
          doc.chatThread?.length
            ? fromChatTurns(doc.chatThread, doc.id)
            : [{ id: `r-${doc.id}`, role: "assistant", kind: "result", presentationId: doc.id }]
        );
      } catch {
        if (myRun !== runId.current) return;
        setMessages([
          {
            id: "e-load",
            role: "assistant",
            kind: "error",
            text: "Couldn't reopen that project. Try again from Recents.",
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
    onCanvasChange?.(showCanvas);
  }, [showCanvas, onCanvasChange]);

  useEffect(() => {
    try {
      setEffort(parseEffort(localStorage.getItem("pk-effort")));
      const w = Number(localStorage.getItem("pk-chat-width"));
      if (w >= 280 && w <= 720) setChatWidth(w);
      const h = Number(localStorage.getItem("pk-canvas-pane"));
      if (h >= 180 && h <= 720) setCanvasPane(h);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pk-chat-width", String(chatWidth));
    } catch {
      /* ignore */
    }
  }, [chatWidth]);

  useEffect(() => {
    try {
      localStorage.setItem("pk-canvas-pane", String(canvasPane));
    } catch {
      /* ignore */
    }
  }, [canvasPane]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setNarrowSplit(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
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
    runId.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setActiveDoc(null);
    setGenerating(null);
    setEditing(false);
    setChatting(false);
    setPrompt("");
    clearFiles();
    loadedId.current = null;
    try {
      const saved = localStorage.getItem("pk-kind");
      if (
        saved === "chat" ||
        saved === "presentation" ||
        saved === "website" ||
        saved === "game" ||
        saved === "app"
      ) {
        setKind(saved);
      } else {
        setKind("chat");
      }
    } catch {
      setKind("chat");
    }
    onThreadChange?.(false);
    onCanvasChange?.(false);
    onReset?.();
  }, [clearFiles, onThreadChange, onCanvasChange, onReset]);

  function pushUser(text: string, attachedNames: string[] = []) {
    setMessages((m) => [
      ...m,
      { id: `u${Date.now()}`, role: "user", text, files: attachedNames },
    ]);
  }

  function cancelRun() {
    runId.current += 1;
    abortRef.current?.abort();
    setGenerating(null);
    setEditing(false);
    setChatting(false);
    setMessages((m) =>
      m.filter((msg) => !(msg.role === "assistant" && msg.kind === "progress"))
    );
  }

  async function generate(preText?: string, extraFiles?: typeof readySources) {
    const usingPre = typeof preText === "string";
    if (!usingPre && !canSend) return;
    const text = usingPre
      ? preText
      : prompt.trim() ||
        (readySources.length > 0 ? `Create a ${kindNoun(kind)} from the attached files.` : "");
    if (!text) return;
    const attached = usingPre ? extraFiles ?? [] : readySources;
    const buildKind = inferProjectKind(text, kind);
    if (buildKind !== kind) {
      setKind(buildKind);
    }
    if (!usingPre) {
      const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
      setPrompt("");
      clearFiles();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      pushUser(text, attachedNames);
    }
    const myRun = ++runId.current;
    abortRef.current?.abort();
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
          kind: buildKind,
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
          const data = parseSseData(evt) as {
            stage?: string;
            presentationId?: string;
            message?: string;
            detail?: string;
            done?: number;
            total?: number;
          } | null;
          if (!data || !data.stage) continue;
          if (data.stage === "complete") {
            finishedId = data.presentationId ?? null;
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
      updateProgress({ stage: "finalising", detail: `Saving your ${kindNoun(buildKind)}` });
      const doc = await getPresentation(finishedId);
      if (myRun !== runId.current) {
        setGenerating(null);
        setMessages((m) => m.filter((msg) => msg.id !== progressId));
        return;
      }
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
      if (myRun !== runId.current || controller.signal.aborted) {
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
        (readySources.length > 0 ? `Incorporate the attached files into the ${kindNoun(activeDoc.kind)}.` : "");
    if (!text) return;
    const attached = usingPre ? [] : readySources;
    if (!usingPre) {
      const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
      setPrompt("");
      clearFiles();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      pushUser(text, attachedNames);
    }
    const myRun = ++runId.current;
    setEditing(true);
    try {
      const result = await aiEdit({
        presentationId: activeDoc.id,
        instruction: text,
        presentation: activeDoc,
        files: attached,
      });
      if (myRun !== runId.current) return;
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
      if (myRun !== runId.current) return;
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
      if (myRun === runId.current) setEditing(false);
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
    const myRun = ++runId.current;
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
        sources,
      });
    } catch (e) {
      if (myRun !== runId.current) return;
      if (chatMode || activeDoc) {
        // Don't kick off a rebuild/edit when the router itself failed — that
        // is what made follow-ups look like the AI crashed.
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
      // First message with no project yet: still try to build so the prompt isn't lost.
      decision = { mode: "build", reply: "" };
    }
    if (myRun !== runId.current) return;
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
    else await generate(text, sources);
  }

  const composerBox = (
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
              aria-label="Send"
              title="Send (Enter)"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

  );

  const kindChips = (
    <div className="flex justify-center gap-1.5 flex-wrap">
      {KIND_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = kind === opt.kind;
        return (
          <button
            key={opt.kind}
            type="button"
            onClick={() => {
              setKind(opt.kind);
              try {
                localStorage.setItem("pk-kind", opt.kind);
              } catch {
                /* ignore */
              }
            }}
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
  );

  const chatHeader = (
    <div className="h-12 flex items-center gap-2 px-3 flex-shrink-0">
      <div className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
        {activeDoc ? activeDoc.title : "Chat"}
      </div>
      {activeDoc && (
        <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 rounded-full px-2 py-0.5 flex-shrink-0">
          {kindLabel(activeDoc.kind)}
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {headerAccessory}
        <button
          type="button"
          onClick={resetThread}
          className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
          title="New chat"
        >
          <PlusCircle size={14} />
          <span className="max-[420px]:hidden">New</span>
        </button>
      </div>
    </div>
  );

  const chatMessages = (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
      {messages.map((m) => (
        <ThreadMessage
          key={m.id}
          message={m}
          doc={activeDoc}
          onCancelGenerate={generating ? cancelRun : undefined}
        />
      ))}
      {chatting && (
        <div className="self-start flex items-center gap-2.5 bg-surface-2/80 rounded-xl px-3.5 py-2.5">
          <Loader2 size={13} className="animate-spin text-accent" />
          <span className="text-[12.5px] text-text-secondary">Thinking...</span>
        </div>
      )}
    </div>
  );

  const chatFooter = (
    <div className="px-3 pb-3 pt-1 flex-shrink-0">
      {!activeDoc && !generating && <div className="mb-2">{kindChips}</div>}
      {composerBox}
    </div>
  );

  const chatColumn = (
    <div className="flex flex-col min-h-0 min-w-0 h-full bg-bg">
      {chatHeader}
      {chatMessages}
      {chatFooter}
    </div>
  );

  return (
    <div className={`w-full flex flex-col ${threadActive ? "flex-1 min-h-0" : "max-w-[680px] mx-auto"}`}>
      {dragging && (
        <div className="fixed inset-0 z-40 bg-bg/85 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in-fade">
          <div className="border-2 border-dashed border-accent rounded-2xl px-14 py-10 bg-surface flex flex-col items-center gap-3">
            <UploadCloud size={32} className="text-accent" />
            <div className="font-medium text-[14.5px]">Drop files to attach them</div>
            <div className="text-[12.5px] text-text-secondary">PDF, PowerPoint, Word, CSV, images, text</div>
          </div>
        </div>
      )}

      {threadActive && showCanvas ? (
        <div
          className={`flex-1 min-h-0 ${narrowSplit ? "flex flex-col" : "flex"}`}
        >
          {narrowSplit ? (
            <>
              <div className="min-h-0 flex-shrink-0" style={{ height: canvasPane }}>
                <WorkspaceCanvas
                  doc={activeDoc}
                  generating={generating}
                  editing={editing}
                  onCancelGenerate={generating ? cancelRun : undefined}
                />
              </div>
              <ResizeHandle
                orientation="horizontal"
                label="Resize canvas"
                onBegin={(y) => {
                  const max = Math.max(180, Math.round(window.innerHeight * 0.7));
                  beginPanelResize(y, canvasPane, 1, 180, max, setCanvasPane, "y");
                }}
              />
              <div className="flex-1 min-h-0 min-w-0">{chatColumn}</div>
            </>
          ) : (
            <>
              <div className="flex-shrink-0 min-h-0 h-full" style={{ width: chatWidth }}>
                {chatColumn}
              </div>
              <ResizeHandle
                label="Resize chat"
                onBegin={(x) => {
                  const max = Math.max(280, Math.min(640, Math.round(window.innerWidth * 0.52)));
                  beginPanelResize(x, chatWidth, 1, 280, max, setChatWidth);
                }}
              />
              <div className="flex-1 min-w-0 min-h-0 h-full">
                <WorkspaceCanvas
                  doc={activeDoc}
                  generating={generating}
                  editing={editing}
                  onCancelGenerate={generating ? cancelRun : undefined}
                />
              </div>
            </>
          )}
        </div>
      ) : threadActive ? (
        <div className="flex-1 min-h-0 flex flex-col w-full max-w-[720px] mx-auto">
          {chatColumn}
        </div>
      ) : (
        <>
          {kindChips}
          <div className="mt-3">{composerBox}</div>
          {prompt.length === 0 && files.length === 0 && (
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
        </>
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
    return (
      <div className="self-start flex items-center gap-2 text-[13px] text-text-secondary">
        <Loader2 size={13} className="animate-spin flex-shrink-0" />
        <span>{message.progress.detail || "Working on the canvas…"}</span>
        {onCancelGenerate && (
          <button
            type="button"
            onClick={onCancelGenerate}
            className="text-[12px] text-text-tertiary hover:text-text cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    );
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

  const meta = isWebKind(doc.kind)
    ? kindLabel(doc.kind)
    : `${doc.slides.length} slide${doc.slides.length === 1 ? "" : "s"}`;
  return (
    <div className="self-start flex items-center gap-2 text-[13px] text-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
      <span>
        <span className="font-medium text-text">{doc.title}</span>
        {" "}is on the canvas
        <span className="text-text-tertiary"> · {meta}</span>
      </span>
    </div>
  );
}
