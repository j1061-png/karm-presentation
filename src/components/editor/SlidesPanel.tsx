"use client";

import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/state/editorStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import type { Slide, Theme } from "@/lib/schema";
import { Plus, Copy, Trash2, GripVertical } from "lucide-react";

function SlideThumb({
  slide,
  index,
  theme,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  slide: Slide;
  index: number;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="group relative px-3"
    >
      <div className="flex gap-2 items-start">
        <div className="flex flex-col items-center gap-0.5 pt-1 w-5 flex-shrink-0">
          <span className={`text-[10.5px] tabular-nums ${selected ? "text-accent font-semibold" : "text-text-tertiary"}`}>
            {index + 1}
          </span>
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-text-tertiary opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical size={11} />
          </button>
        </div>

        {/* div, not button: slide thumbs can contain interactive elements */}
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
          className={`flex-1 min-w-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
            selected ? "border-accent shadow-lg shadow-accent/10" : "border-border hover:border-border-strong"
          }`}
        >
          <div className="pointer-events-none">
            <SlideRenderer slide={slide} theme={theme} mode="thumb" />
          </div>
        </div>
      </div>

      {/* Hover actions — always visible on touch devices */}
      <div className="absolute right-4 top-1.5 flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-white border border-white/10 cursor-pointer"
          title="Duplicate slide"
        >
          <Copy size={11} />
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-danger border border-white/10 cursor-pointer"
            title="Delete slide"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      <div className="text-[10.5px] text-text-tertiary truncate mt-1 ml-7">{slide.name}</div>
    </div>
  );
}

export function SlidesPanel({ width = 200 }: { width?: number | string }) {
  const presentation = useEditorStore((s) => s.presentation);
  const selectedSlideId = useEditorStore((s) => s.selectedSlideId);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const reorderSlides = useEditorStore((s) => s.reorderSlides);
  const addSlide = useEditorStore((s) => s.addSlide);
  const duplicateSlide = useEditorStore((s) => s.duplicateSlide);
  const deleteSlide = useEditorStore((s) => s.deleteSlide);
  const [, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!presentation) return null;
  const slides = presentation.slides;

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) reorderSlides(from, to);
  }

  return (
    <aside
      className="flex-shrink-0 border-r border-border bg-surface/40 flex flex-col min-h-0"
      style={{ width }}
    >
      <div className="flex items-center justify-between px-4 h-10 border-b border-border flex-shrink-0">
        <span className="text-[11.5px] font-medium text-text-secondary uppercase tracking-wider">
          Slides
        </span>
        <button
          onClick={() => addSlide(selectedSlideId ?? undefined)}
          className="p-1 rounded-md text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          title="Add slide"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setDraggingId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {slides.map((slide, i) => (
              <SlideThumb
                key={slide.id}
                slide={slide}
                index={i}
                theme={presentation.theme}
                selected={slide.id === selectedSlideId}
                onSelect={() => selectSlide(slide.id)}
                onDuplicate={() => duplicateSlide(slide.id)}
                onDelete={() => deleteSlide(slide.id)}
                canDelete={slides.length > 1}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={() => addSlide(slides[slides.length - 1]?.id)}
          className="mx-3 ml-10 border border-dashed border-border rounded-lg py-3 text-[12px] text-text-tertiary hover:text-text hover:border-border-strong transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus size={13} /> Add slide
        </button>
      </div>
    </aside>
  );
}
