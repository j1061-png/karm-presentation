import type { ProjectFile } from "./schema";

/**
 * Assemble a single self-contained HTML document from a project file tree so
 * it can be previewed in an iframe via srcDoc (where relative URLs do not
 * resolve). Local stylesheet links and script tags are inlined.
 */
export function assemblePreviewHtml(files: ProjectFile[] | undefined, entry: string): string {
  const list = files ?? [];
  const byPath = new Map(list.map((f) => [f.path, f.content] as const));
  let html =
    byPath.get(entry) ??
    byPath.get("index.html") ??
    list[0]?.content ??
    "<!doctype html><title>Empty project</title><p style='font-family:sans-serif;padding:2rem'>This project has no files yet.</p>";

  const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const [path, content] of byPath) {
    if (path.endsWith(".css")) {
      const link = new RegExp(
        `<link[^>]*href=["'](?:\\./)?${escapeForRegex(path)}["'][^>]*/?>`,
        "gi"
      );
      html = html.replace(link, () => `<style>\n${content}\n</style>`);
    } else if (path.endsWith(".js")) {
      const script = new RegExp(
        `<script[^>]*src=["'](?:\\./)?${escapeForRegex(path)}["'][^>]*>\\s*</script>`,
        "gi"
      );
      html = html.replace(script, () => `<script>\n${content}\n</script>`);
    }
  }

  return html;
}
