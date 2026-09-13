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

/**
 * True when the user is asking a question / giving feedback, not requesting
 * a generate or edit. Used so "what do you think?" on an open project stays
 * conversational instead of kicking off /api/ai-edit.
 */
export function looksLikeConversation(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length > 400) return false;
  if (/^(hi|hello|hey|thanks|thank you|thx|ok|okay|cool|nice|great|got it|cheers)[\s!.]*$/i.test(t)) {
    return true;
  }
  const question =
    /\?$/.test(t) ||
    /^(what|why|how|who|when|where|which|whose|whom)\b/i.test(t) ||
    /^(can|could|would|will) you (explain|tell|describe|summarize|walk me|help me understand)/i.test(t) ||
    /\b(what do you think|do you think|your (thoughts|opinion|feedback)|explain|summarize)\b/i.test(t);
  const editIntent =
    /\b(add|remove|delete|change|fix|update|replace|move|redesign|rebuild|insert|rename|recolor|resize|rotate|scale|generate|create|build|make me|make a|make the|make it)\b/i.test(
      t
    );
  return question && !editIntent;
}
