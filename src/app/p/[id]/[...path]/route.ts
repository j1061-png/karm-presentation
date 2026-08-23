import { getUser } from "@/lib/supabase/server";
import { getPublished } from "@/lib/store";

/**
 * Serves the file tree of a published web project (website / game / app):
 *   /p/{id}/index.html, /p/{id}/styles.css, /p/{id}/app.js, ...
 * Relative links inside the project resolve naturally under /p/{id}/.
 */

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json",
  ico: "image/x-icon",
};

/** Self-contained sites only: no external calls except Google Fonts. */
const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "img-src 'self' data: blob:",
  "media-src data: blob:",
  "connect-src 'self'",
  "frame-ancestors *",
].join("; ");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path } = await params;
  if (!/^[\w-]+$/.test(id)) return new Response("Not found", { status: 404 });

  const published = await getPublished(id).catch(() => null);
  if (!published) return new Response("Not found", { status: 404 });
  if (published.visibility === "private") {
    const user = await getUser();
    if (!user || user.id !== published.ownerId) return new Response("Not found", { status: 404 });
  }

  const p = published.presentation;
  const files = p.files ?? [];
  const requested = decodeURIComponent(path.join("/"));
  const file =
    files.find((f) => f.path === requested) ??
    (requested === "" || requested === "index.html"
      ? files.find((f) => f.path === p.entry)
      : undefined);

  if (!file) return new Response("Not found", { status: 404 });

  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8";

  return new Response(file.content, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...(ext === "html" ? { "Content-Security-Policy": CSP } : {}),
      ...(published.visibility === "public" ? {} : { "X-Robots-Tag": "noindex" }),
    },
  });
}
