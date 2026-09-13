import type { ProjectFile } from "./schema";

/**
 * Preview iframes stay sandboxed without allow-same-origin so generated JS
 * cannot read the app session. Games/apps that call localStorage then throw
 * unless we install an in-memory stand-in first.
 */
export const PREVIEW_STORAGE_SHIM = `<script>(function(){function mem(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[String(k)]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}function needsShim(store){try{store.setItem("__injaz","1");store.removeItem("__injaz");return false}catch(e){return true}}var fallback=mem();if(typeof localStorage==="undefined"||needsShim(localStorage)){try{Object.defineProperty(window,"localStorage",{value:fallback})}catch(e){window.localStorage=fallback}}if(typeof sessionStorage==="undefined"||needsShim(sessionStorage)){try{Object.defineProperty(window,"sessionStorage",{value:mem()})}catch(e){window.sessionStorage=mem()}}})()</script>`;

function injectStorageShim(html: string): string {
  if (html.includes("__injaz")) return html;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${PREVIEW_STORAGE_SHIM}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${PREVIEW_STORAGE_SHIM}</head>`);
  }
  return `${PREVIEW_STORAGE_SHIM}${html}`;
}

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

  return injectStorageShim(html);
}
