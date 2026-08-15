"use client";

/** Vertical drag handle between editor columns. */
export function ResizeHandle({
  onBegin,
}: {
  onBegin: (clientX: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="w-1.5 flex-shrink-0 cursor-col-resize relative group"
      onPointerDown={(e) => {
        e.preventDefault();
        onBegin(e.clientX);
      }}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-accent group-active:bg-accent transition-colors" />
    </div>
  );
}

export function beginPanelResize(
  startX: number,
  startWidth: number,
  dir: 1 | -1,
  min: number,
  max: number,
  setWidth: (w: number) => void
) {
  const move = (e: PointerEvent) => {
    const next = Math.round(startWidth + dir * (e.clientX - startX));
    setWidth(Math.min(max, Math.max(min, next)));
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
