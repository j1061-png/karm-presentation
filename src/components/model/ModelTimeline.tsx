"use client";

import { Diamond, Pause, Play, SkipBack } from "lucide-react";
import type { ModelKeyframe } from "@/lib/schema";

export function ModelTimeline({
  frame,
  duration,
  fps,
  playing,
  selectedId,
  keyframes,
  onFrame,
  onPlay,
  onInsert,
}: {
  frame: number;
  duration: number;
  fps: number;
  playing: boolean;
  selectedId: string | null;
  keyframes: ModelKeyframe[];
  onFrame: (n: number) => void;
  onPlay: (p: boolean) => void;
  onInsert: () => void;
}) {
  const marks = keyframes.filter((k) => !selectedId || k.objectId === selectedId);
  return (
    <div className="h-14 flex-shrink-0 border-t border-border bg-sidebar flex items-center gap-2 px-3">
      <button type="button" className="p-1.5 rounded-md hover:bg-surface-2" onClick={() => onFrame(0)} title="Jump to start">
        <SkipBack size={13} />
      </button>
      <button
        type="button"
        className="p-1.5 rounded-md hover:bg-surface-2"
        onClick={() => onPlay(!playing)}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <button
        type="button"
        className="p-1.5 rounded-md hover:bg-surface-2 text-text-secondary"
        onClick={onInsert}
        disabled={!selectedId}
        title="Insert keyframe (I)"
      >
        <Diamond size={13} />
      </button>
      <span className="text-[11.5px] tabular-nums text-text-tertiary w-16">
        {Math.round(frame)} / {duration}
      </span>
      <div className="relative flex-1 h-6">
        <input
          type="range"
          min={0}
          max={duration}
          value={Math.min(duration, frame)}
          onChange={(e) => onFrame(Number(e.target.value))}
          className="w-full accent-current"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2">
          {marks.map((k) => (
            <span
              key={k.id}
              className="absolute top-0 w-1 h-2 bg-accent rounded-sm"
              style={{ left: `${(k.frame / duration) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <span className="text-[11px] text-text-tertiary">{fps} fps</span>
    </div>
  );
}
