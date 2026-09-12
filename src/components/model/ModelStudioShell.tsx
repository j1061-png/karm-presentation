"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Box, Camera, Circle, Copy, Cylinder, Download, Focus, Lamp, Plus, Trash2,
  Triangle, Move3d, RotateCcw, Scaling, MousePointer2, BoxSelect, Sun, Bot, Droplets, Columns2, Minus,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandLogo";
import { ShareButton } from "@/components/share/ShareButton";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { ResizeHandle, beginPanelResize } from "@/components/ui/ResizeHandle";
import { aiEdit, savePresentation } from "@/lib/api";
import {
  createModelObject,
  duplicateModelObject,
  insertKeyframe,
  insertSolarCleaningKit,
  insertSolarSurroundKit,
  repairScene,
} from "@/lib/model-scene";
import type { ModelObject, ModelObjectType, ModelScene, Presentation, Vec3 } from "@/lib/schema";
import { ModelOutliner } from "./ModelOutliner";
import { ModelProperties } from "./ModelProperties";
import { ModelTimeline } from "./ModelTimeline";
import { ModelViewport } from "./ModelViewport";
import type { ShadingMode, StudioEngine, TransformMode } from "./studio-engine";

type SaveState = "saved" | "saving" | "dirty" | "error";

const SOLAR_ADD: { type: ModelObjectType; label: string; icon: typeof Box }[] = [
  { type: "solarPanel", label: "Solar panel", icon: Sun },
  { type: "mount", label: "Tilt mount", icon: Columns2 },
  { type: "rail", label: "Guide rail", icon: Minus },
  { type: "cleaner", label: "Cleaning robot", icon: Bot },
  { type: "brush", label: "Brush roller", icon: Cylinder },
  { type: "nozzle", label: "Spray nozzle", icon: Droplets },
  { type: "tank", label: "Water tank", icon: Box },
];

const PRIMITIVE_ADD: { type: ModelObjectType; label: string; icon: typeof Box }[] = [
  { type: "cube", label: "Cube", icon: Box },
  { type: "sphere", label: "Sphere", icon: Circle },
  { type: "cylinder", label: "Cylinder", icon: Cylinder },
  { type: "cone", label: "Cone", icon: Triangle },
  { type: "plane", label: "Plane", icon: BoxSelect },
  { type: "torus", label: "Torus", icon: Circle },
  { type: "ico", label: "Ico Sphere", icon: Circle },
  { type: "light", label: "Light", icon: Lamp },
  { type: "camera", label: "Camera", icon: Camera },
  { type: "empty", label: "Empty", icon: Plus },
];

export function ModelStudioShell({
  initial,
  role = "owner",
}: {
  initial: Presentation;
  role?: "owner" | "editor";
}) {
  const [doc, setDoc] = useState<Presentation>(() => ({
    ...initial,
    scene: repairScene(initial.scene),
  }));
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [selectedId, setSelectedId] = useState<string | null>(
    doc.scene?.objects.find((o) => o.type === "cleaner")?.id ??
      doc.scene?.objects.find((o) => o.type === "solarPanel")?.id ??
      null
  );
  const [mode, setMode] = useState<TransformMode>("translate");
  const [shading, setShading] = useState<ShadingMode>("material");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [leftW, setLeftW] = useState(220);
  const [rightW, setRightW] = useState(260);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const engineRef = useRef<StudioEngine | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);
  latest.current = doc;
  const scene = doc.scene ?? repairScene(undefined);

  const persist = useCallback(async (next: Presentation) => {
    setSaveState("saving");
    try {
      await savePresentation(next);
      setSaveState(latest.current === next ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    }
  }, []);

  const updateScene = useCallback(
    (fn: (s: ModelScene) => ModelScene) => {
      setDoc((prev) => {
        const next: Presentation = {
          ...prev,
          scene: fn(prev.scene ?? repairScene(undefined)),
          updatedAt: new Date().toISOString(),
        };
        latest.current = next;
        setSaveState("dirty");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void persist(latest.current), 900);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function patchObject(id: string, patch: Partial<ModelObject>) {
    updateScene((s) => ({
      ...s,
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch, material: patch.material ?? o.material, light: patch.light ?? o.light } : o)),
    }));
  }

  function addObject(type: ModelObjectType) {
    const obj = createModelObject(type);
    updateScene((s) => ({ ...s, objects: [...s.objects, obj] }));
    setSelectedId(obj.id);
    setAddOpen(false);
  }

  function addCleaningRow() {
    updateScene((s) => insertSolarCleaningKit(s));
    setAddOpen(false);
  }

  function addSurroundingArray() {
    updateScene((s) => insertSolarSurroundKit(s));
    setAddOpen(false);
  }

  function removeSelected() {
    if (!selectedId) return;
    updateScene((s) => ({
      ...s,
      objects: s.objects.filter((o) => o.id !== selectedId),
      keyframes: s.keyframes.filter((k) => k.objectId !== selectedId),
    }));
    setSelectedId(null);
  }

  function duplicateSelected() {
    const obj = scene.objects.find((o) => o.id === selectedId);
    if (!obj) return;
    const copy = duplicateModelObject(obj);
    updateScene((s) => ({ ...s, objects: [...s.objects, copy] }));
    setSelectedId(copy.id);
  }

  function onTransform(id: string, next: { position: Vec3; rotation: Vec3; scale: Vec3 }) {
    patchObject(id, next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "g" || k === "w") setMode("translate");
      else if (k === "r") setMode("rotate");
      else if (k === "s" && !e.metaKey && !e.ctrlKey) setMode("scale");
      else if (k === "q") setMode("select");
      else if (k === "x" || e.key === "Delete") removeSelected();
      else if (k === "d" && e.shiftKey) {
        e.preventDefault();
        duplicateSelected();
      } else if (k === "i") {
        if (selectedId) updateScene((sc) => insertKeyframe(sc, selectedId, Math.round(frame)));
      } else if (k === "f") engineRef.current?.focusSelected();
      else if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (k === "z" && (e.metaKey || e.ctrlKey)) {
        /* reserved */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function runAi() {
    const instruction = aiText.trim();
    if (!instruction || aiBusy) return;
    setAiText("");
    setAiBusy(true);
    try {
      const result = await aiEdit({
        presentationId: doc.id,
        instruction,
        presentation: latest.current,
      });
      if (result.changed) {
        setDoc(result.presentation);
        latest.current = result.presentation;
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function exportGlb() {
    const blob = await engineRef.current?.exportGLB();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\w-]+/g, "-") || "model"}.glb`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const selected = scene.objects.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <header className="h-[52px] flex items-center gap-2 px-3 border-b border-border flex-shrink-0">
        <Link href="/dashboard" className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2" aria-label="Back">
          <ArrowLeft size={16} />
        </Link>
        <BrandMark size={22} />
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            const t = titleDraft.trim() || "Untitled model";
            setTitleDraft(t);
            if (t !== doc.title) {
              const next = { ...doc, title: t, updatedAt: new Date().toISOString() };
              setDoc(next);
              latest.current = next;
              void persist(next);
            }
          }}
          className="bg-transparent text-[13.5px] font-medium outline-none rounded-md px-2 py-1 hover:bg-surface-2 max-w-[260px] truncate"
        />
        <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 rounded-full px-2 py-0.5">Model</span>
        <span className="text-[12px] text-text-tertiary">
          {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved" : saveState === "error" ? "Retry save" : "Saved"}
        </span>
        <div className="flex-1" />
        <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5">
          {(["wire", "solid", "material"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShading(s)}
              className={`text-[12px] px-2.5 py-1 rounded-[6px] capitalize ${
                shading === s ? "bg-surface-3 font-medium" : "text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <NotificationsBell />
        <button type="button" onClick={() => void exportGlb()} className="flex items-center gap-1.5 text-[12.5px] border border-border rounded-lg px-3 py-2 hover:bg-surface-2">
          <Download size={13} />
          glTF
        </button>
        <ShareButton presentationId={doc.id} title={doc.title} isOwner={role === "owner"} />
        <Link
          href={`/presentations/${doc.id}`}
          className="flex items-center gap-1.5 text-[12.5px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover"
        >
          View
        </Link>
      </header>

      <div className="h-11 flex items-center gap-1 px-2 border-b border-border flex-shrink-0">
        {(
          [
            { key: "select", icon: MousePointer2, title: "Select (Q)" },
            { key: "translate", icon: Move3d, title: "Move (G)" },
            { key: "rotate", icon: RotateCcw, title: "Rotate (R)" },
            { key: "scale", icon: Scaling, title: "Scale (S)" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            title={t.title}
            onClick={() => setMode(t.key)}
            className={`p-2 rounded-lg ${mode === t.key ? "bg-surface-2 text-text" : "text-text-secondary hover:bg-surface-2"}`}
          >
            <t.icon size={15} />
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[12.5px] px-2.5 py-1.5 rounded-lg hover:bg-surface-2"
          >
            <Plus size={14} /> Add
          </button>
          {addOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 w-56 bg-surface border border-border rounded-xl py-1 shadow-lg max-h-[70vh] overflow-y-auto">
              <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-tertiary">
                Solar kit
              </div>
              <button
                type="button"
                onClick={addSurroundingArray}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-surface-2"
              >
                <Sun size={13} /> Surrounding array
              </button>
              <button
                type="button"
                onClick={addCleaningRow}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-surface-2"
              >
                <Minus size={13} /> Cleaning row
              </button>
              {SOLAR_ADD.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addObject(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-surface-2"
                >
                  <item.icon size={13} /> {item.label}
                </button>
              ))}
              <div className="px-3 pt-2 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-tertiary">
                Primitives
              </div>
              {PRIMITIVE_ADD.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addObject(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-surface-2"
                >
                  <item.icon size={13} /> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={duplicateSelected} className="p-2 rounded-lg text-text-secondary hover:bg-surface-2" title="Duplicate (⇧D)">
          <Copy size={14} />
        </button>
        <button type="button" onClick={removeSelected} className="p-2 rounded-lg text-text-secondary hover:bg-surface-2" title="Delete (X)">
          <Trash2 size={14} />
        </button>
        <button type="button" onClick={() => engineRef.current?.focusSelected()} className="p-2 rounded-lg text-text-secondary hover:bg-surface-2" title="Focus (F)">
          <Focus size={14} />
        </button>
        <div className="flex-1" />
        <form
          className="flex items-center gap-2 max-w-md w-full"
          onSubmit={(e) => {
            e.preventDefault();
            void runAi();
          }}
        >
          <input
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Ask Injaz to surround the yard with panels or add a cleaning pass…"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[13px] outline-none"
          />
          <button type="submit" disabled={aiBusy || !aiText.trim()} className="text-[12.5px] px-3 py-1.5 rounded-lg bg-text text-bg disabled:opacity-30">
            {aiBusy ? "…" : "Edit"}
          </button>
        </form>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="flex-shrink-0 flex flex-col min-h-0 bg-sidebar" style={{ width: leftW }}>
          <div className="h-9 flex items-center px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
            Outliner
          </div>
          <ModelOutliner
            objects={scene.objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggle={patchObject}
          />
        </aside>
        <ResizeHandle onBegin={(x) => beginPanelResize(x, leftW, 1, 160, 360, setLeftW)} label="Resize outliner" />
        <div className="flex-1 min-w-0 min-h-0 relative bg-[#12110f]">
          <ModelViewport
            scene={scene}
            selectedId={selectedId}
            mode={mode}
            shading={shading}
            frame={frame}
            playing={playing}
            onSelect={setSelectedId}
            onTransform={onTransform}
            onReady={(engine) => {
              engineRef.current = engine;
            }}
          />
        </div>
        <ResizeHandle onBegin={(x) => beginPanelResize(x, rightW, -1, 200, 400, setRightW)} label="Resize properties" />
        <aside className="flex-shrink-0 flex flex-col min-h-0 bg-sidebar" style={{ width: rightW }}>
          <div className="h-9 flex items-center px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
            Properties
          </div>
          <ModelProperties object={selected} onChange={(patch) => selectedId && patchObject(selectedId, patch)} />
        </aside>
      </div>

      <ModelTimeline
        frame={frame}
        duration={scene.duration}
        fps={scene.fps}
        playing={playing}
        selectedId={selectedId}
        keyframes={scene.keyframes}
        onFrame={(n) => {
          setPlaying(false);
          setFrame(n);
        }}
        onPlay={setPlaying}
        onInsert={() => selectedId && updateScene((s) => insertKeyframe(s, selectedId, Math.round(frame)))}
      />
    </div>
  );
}
