"use client";

import { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import type { ModelScene, Presentation } from "@/lib/schema";
import { emptyModelScene, repairScene } from "@/lib/model-scene";
import { ModelViewport } from "./ModelViewport";

export function ModelViewer({
  presentation,
  scene,
  className = "",
}: {
  presentation?: Presentation;
  scene?: ModelScene;
  className?: string;
}) {
  const resolved = useMemo(
    () => scene ?? (presentation?.scene ? repairScene(presentation.scene) : emptyModelScene()),
    [scene, presentation?.scene, presentation?.updatedAt]
  );
  const [playing, setPlaying] = useState(resolved.keyframes.length > 0);
  const [frame, setFrame] = useState(0);

  return (
    <div className={`relative w-full h-full min-h-0 bg-[#161412] ${className}`}>
      <ModelViewport
        scene={resolved}
        selectedId={null}
        mode="select"
        shading="material"
        frame={frame}
        playing={playing}
        interactive
        onSelect={() => undefined}
        onTransform={() => undefined}
      />
      {resolved.keyframes.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setPlaying((p) => !p);
            setFrame(0);
          }}
          className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-[12px] bg-surface/90 border border-border rounded-lg px-2.5 py-1.5"
        >
          {playing ? <Square size={12} /> : <Play size={12} />}
          {playing ? "Stop" : "Play"}
        </button>
      )}
    </div>
  );
}
