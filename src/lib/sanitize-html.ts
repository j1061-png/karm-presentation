/**
 * Defense-in-depth stripping for user- or AI-supplied "embed" HTML.
 *
 * The real security boundary is the sandboxed iframe the caller renders this
 * into (srcdoc + `sandbox="allow-same-origin"`, no `allow-scripts`) — the
 * browser will not execute JS from that frame no matter what slips past this
 * regex pass. This function just keeps obviously dangerous constructs out of
 * storage and out of the DOM in the first place.
 */
export function sanitizeEmbedHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']?import["']?[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
    .slice(0, 60000);
}
