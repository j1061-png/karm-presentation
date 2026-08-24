/** Parse one SSE `data:` payload. Returns null for keep-alives or junk. */
export function parseSseData(block: string): unknown | null {
  const line = block.split("\n").find((l) => l.startsWith("data: "));
  if (!line) return null;
  const payload = line.slice(6).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
