import { extractJson } from "./validate";

export type ChatDecision = { mode: "chat" | "build"; reply: string };

/**
 * Turn a model reply into a chat/build decision without throwing on the
 * shapes we actually see in production: valid JSON, fenced JSON, or the
 * model ignoring instructions and writing prose.
 *
 * Follow-ups used to 502 whenever the router missed the JSON schema, and
 * the client then kicked off a full rebuild — which is what felt like the
 * AI "crashing" after the first successful generation.
 */
export function parseChatDecision(raw: string): ChatDecision {
  const text = (raw ?? "").trim();
  if (!text) throw new Error("Missing mode/reply.");

  try {
    const obj = extractJson(text) as { mode?: unknown; reply?: unknown };
    if (obj.mode === "build") return { mode: "build", reply: "" };
    if (typeof obj.reply === "string" && obj.reply.trim()) {
      return { mode: "chat", reply: obj.reply.trim() };
    }
    if (obj.mode === "chat") {
      return { mode: "chat", reply: typeof obj.reply === "string" && obj.reply.trim() ? obj.reply.trim() : "Okay." };
    }
  } catch {
    /* fall through to prose */
  }

  if (/^\s*\{\s*"mode"\s*:\s*"build"/i.test(text)) return { mode: "build", reply: "" };
  return { mode: "chat", reply: text.slice(0, 2000) };
}
