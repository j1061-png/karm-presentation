"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useEditorStore, useSelectedSlide } from "@/state/editorStore";
import { SlideRenderer, SLIDE_W } from "@/components/renderer/SlideRenderer";
import type { SlideElement } from "@/lib/schema";
import { extractFile } from "@/lib/api";
import { InsertBar, createDefaultElement } from "./InsertBar";
import { Loader2, Minus, Plus, Maximize } from "lucide-react";

type DragState =
  | { kind: "move"; elementId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
  | {
      kind: "resize";
      elementId: string;
      handle: string;
      startX: number;
      startY: number;
      orig: { x: number; y: number; w: number; h: number };
    };

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize", se: "nwse-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
};

export function Canvas() {
  const presentation = useEditorStore((s) => s.presentation);
  const slide = useSelectedSlide();
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const selectElement = useEditorStore((s) => s.selectElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const patchElementProps = useEditorStore((s) => s.patchElementProps);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const duplicateElement = useEditorStore((s) => s.duplicateElement);
  const addElement = useEditorStore((s) => s.addElement);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ----------------------------------------------- contained fit + zoom
  // The slide frame is sized from measurements, never from raw CSS, so the
  // presentation can never overflow or take over the app layout.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(960);
  const [zoom, setZoom] = useState(1); // 1 = fit to viewport

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => {
      const rect = vp.getBoundingClientRect();
      const w = Math.min(rect.width - 56, ((rect.height - 56) * 16) / 9);
      setFitWidth(Math.max(280, Math.floor(w)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  const frameWidth = Math.round(fitWidth * zoom);
  const zoomPct = Math.round((frameWidth / SLIDE_W) * 100);

  const slideId = slide?.id;

  // --------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing || !slideId) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
        e.preventDefault();
        deleteElement(slideId, selectedElementId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedElementId) {
        e.preventDefault();
        duplicateElement(slideId, selectedElementId);
      } else if (e.key === "Escape") {
        selectElement(null);
      } else if (e.key.startsWith("Arrow") && selectedElementId && slide) {
        e.preventDefault();
        const el = slide.elements.find((el) => el.id === selectedElementId);
        if (!el) return;
        const step = e.shiftKey ? 2.5 : 0.5;
        const patch: Partial<SlideElement> = {};
        if (e.key === "ArrowLeft") patch.x = el.x - step;
        if (e.key === "ArrowRight") patch.x = el.x + step;
        if (e.key === "ArrowUp") patch.y = el.y - step;
        if (e.key === "ArrowDown") patch.y = el.y + step;
        updateElement(slideId, selectedElementId, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideId, slide, selectedElementId, deleteElement, duplicateElement, selectElement, updateElement]);

  // ------------------------------------------------------ drag handlers
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame || !slideId) return;
      const rect = frame.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

      if (drag.kind === "move") {
        if (Math.abs(dxPct) + Math.abs(dyPct) > 0.15) drag.moved = true;
        updateElement(slideId, drag.elementId, {
          x: Math.round((drag.origX + dxPct) * 10) / 10,
          y: Math.round((drag.origY + dyPct) * 10) / 10,
        });
      } else {
        const { orig, handle } = drag;
        let { x, y, w, h } = orig;
        if (handle.includes("e")) w = orig.w + dxPct;
        if (handle.includes("s")) h = orig.h + dyPct;
        if (handle.includes("w")) {
          w = orig.w - dxPct;
          x = orig.x + dxPct;
        }
        if (handle.includes("n")) {
          h = orig.h - dyPct;
          y = orig.y + dyPct;
        }
        if (w < 3) { w = 3; x = Math.min(x, orig.x + orig.w - 3); }
        if (h < 3) { h = 3; y = Math.min(y, orig.y + orig.h - 3); }
        updateElement(slideId, drag.elementId, {
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          w: Math.round(w * 10) / 10,
          h: Math.round(h * 10) / 10,
        });
      }
    },
    [slideId, updateElement]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    // Resume history and commit one entry for the whole gesture.
    const temporal = useEditorStore.temporal.getState();
    temporal.resume();
    const state = useEditorStore.getState();
    if (state.presentation) {
      // Touch the doc so the post-drag state lands in history as one step.
      useEditorStore.setState({ presentation: { ...state.presentation } });
    }
  }, [onPointerMove]);

  function startDrag(e: React.PointerEvent, drag: DragState) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = drag;
    useEditorStore.temporal.getState().pause();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag, { once: true });
  }

  // --------------------------------------------------------- drop files
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropHover(false);
    if (!slideId || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100 - 4));
    const yPct = Math.max(0, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100 - 4));

    // Component from the insert bar
    const componentType = e.dataTransfer.getData("application/x-karm-component");
    if (componentType) {
      const el = createDefaultElement(componentType, xPct, yPct);
      if (el) addElement(slideId, el);
      return;
    }

    // Image files dropped straight onto the slide
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      setUploadingImage(true);
      try {
        for (const [i, file] of files.entries()) {
          const uploaded = await extractFile(file);
          if (uploaded.imageUrl) {
            addElement(slideId, {
              id: nanoid(8),
              type: "image",
              x: Math.min(xPct + i * 4, 60), y: Math.min(yPct + i * 4, 60), w: 34, h: 38,
              z: 5, opacity: 1, rotation: 0,
              props: { src: uploaded.imageUrl, alt: file.name, fit: "cover" },
            } as SlideElement);
          }
        }
      } catch {
        /* upload errors surface via the image placeholder */
      } finally {
        setUploadingImage(false);
      }
    }
  }

  if (!presentation || !slide) return null;
  const theme = presentation.theme;
  const editingElement = editingId ? slide.elements.find((e) => e.id === editingId) : null;

  return (
    <div className="relative flex-1 min-w-0 flex flex-col bg-bg">
      <InsertBar
        onInsert={(type) => {
          if (!slideId) return;
          const el = createDefaultElement(type, 30, 30);
          if (el) addElement(slideId, el);
        }}
      />

      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 overflow-auto"
        onClick={() => {
          selectElement(null);
          setEditingId(null);
        }}
      >
        {/* Grid wrapper centers the frame when it fits and scrolls when zoomed in */}
        <div className="min-w-full min-h-full grid place-items-center p-7">
          <div
            className={`relative flex-shrink-0 ${dropHover ? "ring-2 ring-accent rounded-lg" : ""}`}
            style={{ width: frameWidth, aspectRatio: "16/9" }}
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropHover(true);
            }}
            onDragLeave={() => setDropHover(false)}
            onDrop={(e) => void handleDrop(e)}
          >
            <div
              ref={frameRef}
              className="relative w-full h-full rounded-lg ring-1 ring-border"
              style={{ boxShadow: "0 12px 40px var(--shadow-color)" }}
            >
            <SlideRenderer
              slide={slide}
              theme={theme}
              mode="edit"
              hideElementId={editingId}
              className="rounded-lg overflow-hidden"
              rounded
            />

            {/* ------------------------------------------ overlay layer */}
            <div className="absolute inset-0" onPointerDown={() => { selectElement(null); setEditingId(null); }}>
              {slide.elements.map((el) => {
                const isSelected = el.id === selectedElementId;
                const isEditing = el.id === editingId;
                if (isEditing) return null; // the inline editor owns this region
                return (
                  <div
                    key={el.id}
                    className={isSelected ? "el-selected" : "el-hover"}
                    style={{
                      position: "absolute",
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.w}%`,
                      height: `${el.h}%`,
                      zIndex: 100 + el.z,
                      cursor: isEditing ? "text" : "move",
                      pointerEvents: isEditing ? "none" : "auto",
                    }}
                    onPointerDown={(e) => {
                      if (isEditing) return;
                      selectElement(el.id);
                      setEditingId(null);
                      startDrag(e, {
                        kind: "move",
                        elementId: el.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                        moved: false,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (["heading", "text", "quote", "list"].includes(el.type)) setEditingId(el.id);
                    }}
                  >
                    {/* Resize handles */}
                    {isSelected &&
                      !isEditing &&
                      HANDLES.map((h) => {
                        const style: React.CSSProperties = {
                          position: "absolute",
                          width: 9,
                          height: 9,
                          background: "#fff",
                          border: "1.5px solid var(--color-accent)",
                          borderRadius: 3,
                          cursor: HANDLE_CURSORS[h],
                          zIndex: 20,
                          pointerEvents: "auto",
                        };
                        if (h.includes("n")) style.top = -5;
                        if (h.includes("s")) style.bottom = -5;
                        if (h.includes("w")) style.left = -5;
                        if (h.includes("e")) style.right = -5;
                        if (h === "n" || h === "s") { style.left = "50%"; style.marginLeft = -4.5; }
                        if (h === "e" || h === "w") { style.top = "50%"; style.marginTop = -4.5; }
                        return (
                          <div
                            key={h}
                            style={style}
                            onPointerDown={(e) =>
                              startDrag(e, {
                                kind: "resize",
                                elementId: el.id,
                                handle: h,
                                startX: e.clientX,
                                startY: e.clientY,
                                orig: { x: el.x, y: el.y, w: el.w, h: el.h },
                              })
                            }
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* --------------------------------------- inline text editor */}
            {editingElement && (
              <InlineTextEditor
                key={editingElement.id}
                element={editingElement}
                frameWidth={frameWidth}
                onCommit={(text) => {
                  if (slideId) {
                    if (editingElement.type === "list") {
                      const items = text.split("\n").map((l) => l.trim()).filter(Boolean);
                      patchElementProps(slideId, editingElement.id, {
                        items: items.length > 0 ? items : ["List item"],
                      });
                    } else {
                      patchElementProps(slideId, editingElement.id, { text });
                    }
                  }
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
                theme={theme}
              />
            )}

            {uploadingImage && (
              <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center z-50">
                <div className="flex items-center gap-2.5 bg-surface border border-border-strong rounded-xl px-4 py-3 text-[13px]">
                  <Loader2 size={15} className="animate-spin text-accent" />
                  Uploading image...
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-11 right-4 z-30 flex items-center gap-0.5 bg-surface border border-border rounded-lg p-0.5"
        style={{ boxShadow: "0 4px 16px var(--shadow-color)" }}
      >
        <button
          onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
          className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          aria-label="Zoom out"
        >
          <Minus size={13} />
        </button>
        <span className="text-[11px] text-text-secondary tabular-nums w-10 text-center select-none">
          {zoomPct}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
          className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          aria-label="Zoom in"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          aria-label="Fit to screen"
          title="Fit to screen"
        >
          <Maximize size={12} />
        </button>
      </div>

      {/* Hint bar */}
      <div className="h-8 flex items-center justify-center gap-5 text-[11px] text-text-tertiary border-t border-border flex-shrink-0 overflow-hidden whitespace-nowrap px-3">
        <span>Double-click text to edit</span>
        <span className="hidden md:inline">⌘D duplicate</span>
        <span className="hidden md:inline">⌫ delete</span>
        <span className="hidden lg:inline">Arrows nudge</span>
        <span className="hidden lg:inline">Drag files onto the slide</span>
      </div>
    </div>
  );
}

/**
 * WYSIWYG inline editor: replaces the element with an editable copy that
 * matches the rendered typography exactly (the original is hidden while
 * editing, so there is no double text and no dark overlay box).
 */
function InlineTextEditor({
  element,
  frameWidth,
  onCommit,
  onCancel,
  theme,
}: {
  element: SlideElement;
  frameWidth: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
  theme: { colors: { text: string; accent: string } };
}) {
  const props = element.props as { text?: string; items?: string[]; level?: number };
  const initial = element.type === "list" ? (props.items ?? []).join("\n") : (props.text ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const scale = frameWidth / SLIDE_W;
  const s = element.style ?? {};

  const isHeading = element.type === "heading";
  const isQuote = element.type === "quote";
  const isList = element.type === "list";
  const defaultSize = isHeading
    ? (({ 1: 56, 2: 40, 3: 28 } as Record<number, number>)[props.level ?? 1] ?? 56)
    : isQuote
      ? 28
      : 20;
  const fontSize = (s.fontSize ?? defaultSize) * scale;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const finish = (commit: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit) onCommit(ref.current?.innerText ?? "");
    else onCancel();
  };

  // Vertical alignment mirrors ElementView: text is top-aligned, everything
  // else centers within its box.
  const justify = element.type === "text" ? "flex-start" : "center";

  return (
    <div
      className="absolute z-[300] flex flex-col"
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.w}%`,
        height: `${element.h}%`,
        justifyContent: justify,
        boxShadow: `0 0 0 1.5px ${theme.colors.accent}, 0 0 0 5px color-mix(in srgb, ${theme.colors.accent} 18%, transparent)`,
        borderRadius: 6,
        background: s.background ?? "transparent",
        paddingLeft: isQuote ? (s.padding ?? 28) * scale : (s.padding ?? 0) * scale,
        paddingRight: (s.padding ?? 0) * scale,
        borderLeft: isQuote ? `3px solid ${theme.colors.accent}` : undefined,
        cursor: "text",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!isHeading}
        className="w-full outline-none whitespace-pre-wrap break-words"
        style={{
          fontSize,
          fontWeight: s.fontWeight ?? (isHeading ? 650 : isQuote ? 500 : 400),
          textAlign: s.textAlign,
          lineHeight: s.lineHeight ?? (isHeading ? 1.1 : isQuote ? 1.4 : isList ? 1.9 : 1.55),
          letterSpacing: s.letterSpacing ?? (isHeading ? -0.5 * scale : undefined),
          fontStyle: isQuote ? "italic" : undefined,
          color: s.color ?? theme.colors.text,
          caretColor: theme.colors.accent,
        }}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (isHeading && !e.shiftKey))) {
            e.preventDefault();
            finish(true);
          }
        }}
      >
        {initial}
      </div>
      {isList && (
        <div
          className="absolute -bottom-7 left-0 text-[11px] px-2 py-0.5 rounded-md pointer-events-none"
          style={{ background: theme.colors.accent, color: "#000", opacity: 0.9 }}
        >
          One item per line
        </div>
      )}
    </div>
  );
}
