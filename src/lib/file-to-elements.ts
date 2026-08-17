import { nanoid } from "nanoid";
import type { SlideElement } from "./schema";
import type { UploadedSource } from "./api";
import { sanitizeEmbedHtml } from "./sanitize-html";

function parseDelimited(content: string): string[][] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  return lines.map((line) =>
    line.split(/,|\t/).map((cell) => cell.trim().replace(/^["']|["']$/g, "")).slice(0, 6)
  );
}

function looksNumeric(rows: string[][]): boolean {
  const values = rows.slice(1).flat().slice(0, 12);
  if (values.length < 2) return false;
  const nums = values.filter((v) => /^-?\d+(\.\d+)?$/.test(v.replace(/[%$,]/g, "")));
  return nums.length >= values.length * 0.5;
}

/** Turn an uploaded file into one or more slide elements at (x, y). */
export function elementsFromUpload(
  source: UploadedSource,
  x: number,
  y: number,
  offset = 0
): SlideElement[] {
  const ox = Math.min(x + offset * 3, 62);
  const oy = Math.min(y + offset * 3, 58);
  const base = { z: 6, opacity: 1, rotation: 0 };

  if (source.kind === "image" && source.imageUrl) {
    return [
      {
        id: nanoid(8),
        type: "image",
        x: ox,
        y: oy,
        w: 34,
        h: 38,
        ...base,
        props: { src: source.imageUrl, alt: source.name, fit: "cover" },
      } as SlideElement,
    ];
  }

  if (source.kind === "html") {
    // The user's own HTML, kept byte-for-byte (minus the usual script/handler
    // strip) inside a sandboxed embed rather than decomposed into elements.
    return [
      {
        id: nanoid(8),
        type: "embed",
        x: ox,
        y: Math.max(4, oy - 6),
        w: 70,
        h: 60,
        ...base,
        props: { html: sanitizeEmbedHtml(source.content) },
      } as SlideElement,
    ];
  }

  if (source.kind === "data") {
    const grid = parseDelimited(source.content);
    if (grid.length >= 2 && grid[0].length >= 2) {
      const columns = grid[0];
      const rows = grid.slice(1, 8);
      if (looksNumeric(grid) && columns.length <= 6) {
        const labels = rows.map((r) => r[0] || "").slice(0, 8);
        const series = columns.slice(1, 4).map((name, i) => ({
          name: name || `Series ${i + 1}`,
          data: rows.map((r) => {
            const n = Number(String(r[i + 1] ?? "0").replace(/[%$,]/g, ""));
            return Number.isFinite(n) ? n : 0;
          }),
        }));
        return [
          {
            id: nanoid(8),
            type: "chart",
            x: ox,
            y: Math.max(8, oy - 4),
            w: 52,
            h: 46,
            ...base,
            props: {
              chartType: "bar",
              title: source.name.replace(/\.[^.]+$/, ""),
              labels,
              series,
              stacked: false,
              showLegend: series.length > 1,
              showGrid: true,
            },
          } as SlideElement,
        ];
      }
      return [
        {
          id: nanoid(8),
          type: "table",
          x: ox,
          y: oy,
          w: 56,
          h: 36,
          ...base,
          props: { columns, rows, compact: rows.length > 4 },
        } as SlideElement,
      ];
    }
  }

  const lines = source.content
    .split(/\n+/)
    .map((l) => l.replace(/^\[Slide \d+\]\s*/, "").trim())
    .filter((l) => l.length > 2 && l.length < 180)
    .slice(0, 6);

  const heading: SlideElement = {
    id: nanoid(8),
    type: "heading",
    x: ox,
    y: oy,
    w: 50,
    h: 10,
    ...base,
    props: { text: source.name.replace(/\.[^.]+$/, ""), level: 3 },
  } as SlideElement;

  if (lines.length >= 2) {
    return [
      heading,
      {
        id: nanoid(8),
        type: "list",
        x: ox,
        y: oy + 12,
        w: 48,
        h: Math.min(40, 8 + lines.length * 6),
        ...base,
        props: { items: lines, ordered: false, marker: "dot" },
      } as SlideElement,
    ];
  }

  return [
    heading,
    {
      id: nanoid(8),
      type: "text",
      x: ox,
      y: oy + 12,
      w: 48,
      h: 22,
      ...base,
      props: { text: lines[0] || "Attached file — double-click to edit." },
    } as SlideElement,
  ];
}
