"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/state/editorStore";
import { aiEdit, savePresentation } from "@/lib/api";
import { ATTACH_ACCEPT, useAttachments } from "@/lib/use-attachments";
import { FileChips } from "@/components/chat/FileChips";
import { ArrowUp, Paperclip, Sparkles, AlertCircle, Loader2, UploadCloud } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  files?: string[];
  error?: boolean;
}

const QUICK_ACTIONS = [
  "Make this slide more visual",
  "Add an interactive chart",
  "Turn this into a timeline",
  "Make it more suitable for investors",
  "Make the presentation more engaging",
];

export function AIChat() {
  const presentation = useEditorStore((s) => s.presentation);
  const selectedSlideId = useEditorStore((s) => s.selectedSlideId);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const replacePresentation = useEditorStore((s) => s.replacePresentation);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { files, addFiles, removeFile, clearFiles, readySources, uploading, inputRef } =
    useAttachments();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!presentation?.chatThread?.length) return;
    setMessages(
      presentation.chatThread.map((t) => ({
        id: t.id,
        role: t.role,
        text: t.text,
        files: t.files,
        error: t.kind === "error",
      }))
    );
  }, [presentation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selection = (() => {
    if (!presentation || !selectedSlideId) return null;
    const idx = presentation.slides.findIndex((s) => s.id === selectedSlideId);
    if (idx === -1) return null;
    if (selectedElementId) {
      const el = presentation.slides[idx].elements.find((e) => e.id === selectedElementId);
      if (el) return `Slide ${idx + 1} · ${el.type} element`;
    }
    return `Slide ${idx + 1} · ${presentation.slides[idx].name}`;
  })();

  const canSend =
    (input.trim().length > 0 || readySources.length > 0) && !busy && !uploading && !!presentation;

  async function send(text: string) {
    const instruction =
      text.trim() || (readySources.length > 0 ? "Incorporate the attached files into the presentation." : "");
    if (!instruction || busy || !presentation || uploading) return;
    const attachedNames = files.filter((f) => f.status === "done").map((f) => f.name);
    const attached = readySources;
    setInput("");
    clearFiles();
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: `u${Date.now()}`, role: "user", text: instruction, files: attachedNames },
    ]);

    try {
      const result = await aiEdit({
        presentationId: presentation.id,
        instruction,
        presentation,
        selectedSlideId: selectedSlideId ?? undefined,
        selectedElementId: selectedElementId ?? undefined,
        files: attached,
      });
      const reply: Message = { id: `a${Date.now()}`, role: "assistant", text: result.summary };
      const base = result.changed ? result.presentation : presentation;
      setMessages((m) => {
        const next: Message[] = [...m, reply];
        const chatThread = next.map((msg) => ({
          id: msg.id,
          role: msg.role,
          text: msg.text,
          files: msg.files,
          kind: msg.error ? ("error" as const) : msg.role === "assistant" ? ("edit" as const) : undefined,
        }));
        const doc = { ...base, chatThread };
        replacePresentation(doc);
        void savePresentation(doc);
        return next;
      });
    } catch (e) {
      setMessages((m) => {
        const next: Message[] = [
          ...m,
          {
            id: `e${Date.now()}`,
            role: "assistant",
            text: e instanceof Error ? e.message : "Something went wrong. Please try again.",
            error: true,
          },
        ];
        void savePresentation({
          ...presentation,
          chatThread: next.map((msg) => ({
            id: msg.id,
            role: msg.role,
            text: msg.text,
            files: msg.files,
            kind: msg.error ? ("error" as const) : msg.role === "assistant" ? ("edit" as const) : undefined,
          })),
        });
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={panelRef}
      className="flex-1 min-h-0 flex flex-col relative"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        if (!panelRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="absolute inset-0 z-10 bg-bg/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-accent rounded-xl px-6 py-5 flex flex-col items-center gap-2">
            <UploadCloud size={22} className="text-accent" />
            <div className="text-[12.5px] font-medium">Drop files to attach</div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center text-center pt-10 px-2">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
              <Sparkles size={17} className="text-accent" />
            </div>
            <div className="text-[13.5px] font-medium mb-1">Edit with AI</div>
            <div className="text-[12.5px] text-text-secondary leading-relaxed mb-6">
              Select a slide or element, then describe any change. Attach files or drop them here
              to ground the edit.
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => void send(a)}
                  disabled={busy}
                  className="text-left text-[12.5px] text-text-secondary border border-border rounded-lg px-3 py-2 hover:border-border-strong hover:text-text transition-colors cursor-pointer bg-surface/60"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed animate-in-fade ${
              m.role === "user"
                ? "self-end bg-surface-3 text-text"
                : m.error
                  ? "self-start bg-danger/10 border border-danger/30 text-danger"
                  : "self-start bg-surface border border-border text-text"
            }`}
          >
            {m.error && <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />}
            {m.text}
            {m.files && m.files.length > 0 && (
              <div className="mt-1.5 text-[11px] text-text-tertiary">
                {m.files.join(" · ")}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="self-start flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-2.5">
            <Loader2 size={13} className="animate-spin text-accent" />
            <span className="text-[12.5px] text-text-secondary">Applying your changes...</span>
          </div>
        )}
      </div>

      {selection && (
        <div className="px-4 pb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary bg-surface border border-border rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Context: {selection}
          </span>
        </div>
      )}

      <div className="p-3 border-t border-border flex-shrink-0">
        <div
          className={`bg-surface border rounded-xl transition-colors ${
            dragging ? "border-accent" : "border-border focus-within:border-border-strong"
          }`}
        >
          <FileChips files={files} onRemove={removeFile} compact />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="m-2 w-8 h-8 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50 flex-shrink-0"
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip size={15} />
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder="Ask to change anything, or attach a file..."
              className="flex-1 bg-transparent resize-none outline-none px-1 py-3 text-[13px] placeholder:text-text-tertiary"
              disabled={busy}
            />
            <button
              onClick={() => void send(input)}
              disabled={!canSend}
              className="m-2 w-8 h-8 rounded-lg bg-accent text-accent-text flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-30 cursor-pointer flex-shrink-0"
              aria-label="Send"
            >
              <ArrowUp size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
