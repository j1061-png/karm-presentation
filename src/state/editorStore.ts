"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import type { Presentation, Slide, SlideElement, Theme } from "@/lib/schema";

export type SaveState = "saved" | "saving" | "dirty" | "error";

interface EditorState {
  presentation: Presentation | null;
  selectedSlideId: string | null;
  selectedElementId: string | null;

  setPresentation: (p: Presentation) => void;
  replacePresentation: (p: Presentation) => void;
  selectSlide: (id: string | null) => void;
  selectElement: (id: string | null) => void;

  setTitle: (title: string) => void;
  updateTheme: (
    patch: Omit<Partial<Theme>, "colors"> & { colors?: Partial<Theme["colors"]> }
  ) => void;

  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  addSlide: (afterId?: string) => void;
  duplicateSlide: (slideId: string) => void;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;

  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
  patchElementProps: (slideId: string, elementId: string, propsPatch: Record<string, unknown>) => void;
  patchElementStyle: (slideId: string, elementId: string, stylePatch: Record<string, unknown>) => void;
  addElement: (slideId: string, element: SlideElement) => void;
  duplicateElement: (slideId: string, elementId: string) => void;
  deleteElement: (slideId: string, elementId: string) => void;
  bringForward: (slideId: string, elementId: string, dir: 1 | -1) => void;
}

function touch(p: Presentation): Presentation {
  return { ...p, updatedAt: new Date().toISOString() };
}

function mapSlide(p: Presentation, slideId: string, fn: (s: Slide) => Slide): Presentation {
  return touch({ ...p, slides: p.slides.map((s) => (s.id === slideId ? fn(s) : s)) });
}

function mapElement(
  p: Presentation,
  slideId: string,
  elementId: string,
  fn: (e: SlideElement) => SlideElement
): Presentation {
  return mapSlide(p, slideId, (s) => ({
    ...s,
    elements: s.elements.map((e) => (e.id === elementId ? fn(e) : e)),
  }));
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      presentation: null,
      selectedSlideId: null,
      selectedElementId: null,

      setPresentation: (p) =>
        set({
          presentation: p,
          selectedSlideId: p.slides[0]?.id ?? null,
          selectedElementId: null,
        }),

      replacePresentation: (p) =>
        set((state) => ({
          presentation: {
            ...p,
            chatThread: p.chatThread ?? state.presentation?.chatThread,
          },
          selectedSlideId: p.slides.some((s) => s.id === state.selectedSlideId)
            ? state.selectedSlideId
            : p.slides[0]?.id ?? null,
          selectedElementId: null,
        })),

      selectSlide: (id) => set({ selectedSlideId: id, selectedElementId: null }),
      selectElement: (id) => set({ selectedElementId: id }),

      setTitle: (title) => {
        const p = get().presentation;
        if (!p) return;
        set({ presentation: touch({ ...p, title }) });
      },

      updateTheme: (patch) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: touch({
            ...p,
            theme: {
              ...p.theme,
              ...patch,
              colors: { ...p.theme.colors, ...(patch.colors ?? {}) },
            },
          }),
        });
      },

      updateSlide: (slideId, patch) => {
        const p = get().presentation;
        if (!p) return;
        set({ presentation: mapSlide(p, slideId, (s) => ({ ...s, ...patch })) });
      },

      addSlide: (afterId) => {
        const p = get().presentation;
        if (!p) return;
        const slide: Slide = {
          id: nanoid(8),
          name: `Slide ${p.slides.length + 1}`,
          transition: "fade",
          elements: [
            {
              id: nanoid(8),
              type: "heading",
              x: 6, y: 10, w: 80, h: 14, z: 1, opacity: 1, rotation: 0,
              props: { text: "New slide", level: 2 },
            } as SlideElement,
          ],
        };
        const idx = afterId ? p.slides.findIndex((s) => s.id === afterId) + 1 : p.slides.length;
        const slides = [...p.slides.slice(0, idx), slide, ...p.slides.slice(idx)];
        set({
          presentation: touch({ ...p, slides }),
          selectedSlideId: slide.id,
          selectedElementId: null,
        });
      },

      duplicateSlide: (slideId) => {
        const p = get().presentation;
        if (!p) return;
        const idx = p.slides.findIndex((s) => s.id === slideId);
        if (idx === -1) return;
        const src = p.slides[idx];
        const copy: Slide = {
          ...structuredClone(src),
          id: nanoid(8),
          name: `${src.name} (copy)`,
          elements: src.elements.map((e) => ({ ...structuredClone(e), id: nanoid(8) })),
        };
        const slides = [...p.slides.slice(0, idx + 1), copy, ...p.slides.slice(idx + 1)];
        set({ presentation: touch({ ...p, slides }), selectedSlideId: copy.id });
      },

      deleteSlide: (slideId) => {
        const p = get().presentation;
        if (!p || p.slides.length <= 1) return;
        const idx = p.slides.findIndex((s) => s.id === slideId);
        const slides = p.slides.filter((s) => s.id !== slideId);
        const nextSelected = slides[Math.max(0, idx - 1)]?.id ?? slides[0]?.id ?? null;
        set({
          presentation: touch({ ...p, slides }),
          selectedSlideId: get().selectedSlideId === slideId ? nextSelected : get().selectedSlideId,
          selectedElementId: null,
        });
      },

      reorderSlides: (fromIndex, toIndex) => {
        const p = get().presentation;
        if (!p) return;
        const slides = [...p.slides];
        const [moved] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, moved);
        set({ presentation: touch({ ...p, slides }) });
      },

      updateElement: (slideId, elementId, patch) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapElement(p, slideId, elementId, (e) => ({ ...e, ...patch }) as SlideElement),
        });
      },

      patchElementProps: (slideId, elementId, propsPatch) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapElement(p, slideId, elementId, (e) => ({
            ...e,
            props: { ...e.props, ...propsPatch },
          }) as SlideElement),
        });
      },

      patchElementStyle: (slideId, elementId, stylePatch) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapElement(p, slideId, elementId, (e) => ({
            ...e,
            style: { ...(e.style ?? {}), ...stylePatch },
          }) as SlideElement),
        });
      },

      addElement: (slideId, element) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapSlide(p, slideId, (s) => ({ ...s, elements: [...s.elements, element] })),
          selectedElementId: element.id,
        });
      },

      duplicateElement: (slideId, elementId) => {
        const p = get().presentation;
        if (!p) return;
        const slide = p.slides.find((s) => s.id === slideId);
        const el = slide?.elements.find((e) => e.id === elementId);
        if (!el) return;
        const copy = {
          ...structuredClone(el),
          id: nanoid(8),
          x: Math.min(el.x + 3, 90),
          y: Math.min(el.y + 3, 90),
        } as SlideElement;
        set({
          presentation: mapSlide(p, slideId, (s) => ({ ...s, elements: [...s.elements, copy] })),
          selectedElementId: copy.id,
        });
      },

      deleteElement: (slideId, elementId) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapSlide(p, slideId, (s) => ({
            ...s,
            elements: s.elements.filter((e) => e.id !== elementId),
          })),
          selectedElementId:
            get().selectedElementId === elementId ? null : get().selectedElementId,
        });
      },

      bringForward: (slideId, elementId, dir) => {
        const p = get().presentation;
        if (!p) return;
        set({
          presentation: mapElement(p, slideId, elementId, (e) => ({
            ...e,
            z: Math.max(0, Math.min(200, e.z + dir)),
          }) as SlideElement),
        });
      },
    }),
    {
      // Only track the document itself for undo/redo.
      partialize: (state) => ({ presentation: state.presentation }),
      limit: 100,
      equality: (a, b) => a.presentation === b.presentation,
    }
  )
);

/** Convenience selectors */
export function useSelectedSlide(): Slide | null {
  return useEditorStore((s) => {
    if (!s.presentation) return null;
    return s.presentation.slides.find((sl) => sl.id === s.selectedSlideId) ?? null;
  });
}

export function useSelectedElement(): SlideElement | null {
  return useEditorStore((s) => {
    if (!s.presentation || !s.selectedSlideId || !s.selectedElementId) return null;
    const slide = s.presentation.slides.find((sl) => sl.id === s.selectedSlideId);
    return slide?.elements.find((e) => e.id === s.selectedElementId) ?? null;
  });
}
