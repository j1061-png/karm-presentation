"use client";

import { useEffect, useRef } from "react";
import type { ModelScene, Vec3 } from "@/lib/schema";
import { StudioEngine, type ShadingMode, type TransformMode } from "./studio-engine";

export function ModelViewport({
  scene,
  selectedId,
  mode,
  shading,
  frame,
  playing,
  interactive = true,
  onSelect,
  onTransform,
  onReady,
}: {
  scene: ModelScene;
  selectedId: string | null;
  mode: TransformMode;
  shading: ShadingMode;
  frame: number;
  playing: boolean;
  interactive?: boolean;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, next: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
  onReady?: (engine: StudioEngine) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StudioEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new StudioEngine(canvas, scene, { onSelect, onTransform }, interactive);
    engineRef.current = engine;
    onReady?.(engine);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Fresh engine when the canvas mounts — scene updates go through rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.sync(scene);
  }, [scene]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    engineRef.current?.setShading(shading);
  }, [shading]);

  useEffect(() => {
    if (!playing) engineRef.current?.setFrame(frame);
  }, [frame, playing]);

  useEffect(() => {
    engineRef.current?.setPlaying(playing);
  }, [playing]);

  return (
    <div className="absolute inset-0 w-full h-full min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
