"use client";

/** Drag handle between resizable panes. */
export function ResizeHandle({
  orientation = "vertical",
  onBegin,
  label = "Resize panel",
}: {
  orientation?: "vertical" | "horizontal";
  onBegin: (clientPos: number) => void;
  label?: string;
}) {
  const vertical = orientation === "vertical";
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      className={`flex-shrink-0 relative z-20 group touch-none ${
        vertical ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        onBegin(vertical ? e.clientX : e.clientY);
      }}
    >
      <div
        className={`absolute bg-border group-hover:bg-border-strong group-active:bg-accent transition-colors ${
          vertical
            ? "inset-y-0 left-1/2 -translate-x-1/2 w-px"
            : "inset-x-0 top-1/2 -translate-y-1/2 h-px"
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-tertiary group-hover:bg-text-secondary group-active:bg-accent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity ${
          vertical ? "h-10 w-1" : "w-10 h-1"
        }`}
      />
    </div>
  );
}

/**
 * Pointer-drag a panel size. A full-screen veil keeps iframes from eating
 * pointermove while the drag is in progress.
 */
export function beginPanelResize(
  startPos: number,
  startSize: number,
  dir: 1 | -1,
  min: number,
  max: number,
  setSize: (n: number) => void,
  axis: "x" | "y" = "x"
) {
  const cursor = axis === "x" ? "col-resize" : "row-resize";
  const prevCursor = document.body.style.cursor;
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = "none";

  const veil = document.createElement("div");
  veil.setAttribute("data-resize-veil", "");
  veil.style.cssText = `position:fixed;inset:0;z-index:2147483646;cursor:${cursor};`;
  document.body.appendChild(veil);

  const move = (e: PointerEvent) => {
    const pos = axis === "x" ? e.clientX : e.clientY;
    const next = Math.round(startSize + dir * (pos - startPos));
    setSize(Math.min(max, Math.max(min, next)));
  };
  const up = () => {
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevUserSelect;
    veil.remove();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
