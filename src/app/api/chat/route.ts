import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { chatJson } from "@/lib/deepseek";
import { extractJson } from "@/lib/validate";
import { publicAiError } from "@/lib/public-error";

export const maxDuration = 60;

/**
 * Conversational endpoint: lets people talk to Studio like a normal chatbot.
 * The model decides whether the latest message is small talk / a question
 * (answer directly) or a request to build something (the client then runs
 * the generation pipeline).
 */

interface ChatBody {
  messages?: { role?: string; text?: string }[];
  hasProject?: boolean;
  kind?: string;
}

function systemPrompt(hasProject: boolean, kind: string): string {
  const buildMeaning = hasProject
    ? `asks you to CHANGE, EDIT, ADD TO, or REDESIGN the currently open ${kind} (e.g. "make the header blue", "add a slide about pricing", "fix the bug")`
    : `asks you to CREATE or BUILD something (a presentation, website, game, or app — e.g. "make me a snake game", "build a portfolio site", "create a pitch deck")`;

  return `You are Studio, a friendly AI workspace assistant. You chat naturally AND you can build presentations, websites, games, and apps.

Decide what the LATEST user message is:
- If it ${buildMeaning}, respond with ONLY: {"mode":"build"}
- Otherwise (greetings, questions, brainstorming, advice, feedback, anything conversational), respond with ONLY: {"mode":"chat","reply":"<your answer>"}

Rules for "reply":
- Be warm, helpful, and concise (a short paragraph or a few bullet points; never a wall of text).
- You can help brainstorm ideas, explain what you can build, give feedback, and answer general questions.
- If the user seems unsure, you may suggest something you could build for them.
- Plain text only, no markdown headers.

Respond with ONLY the JSON object. No other text.`;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as ChatBody;
  const turns = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
  if (turns.length === 0) return NextResponse.json({ error: "No message." }, { status: 400 });

  const messages = [
    { role: "system" as const, content: systemPrompt(body.hasProject === true, body.kind ?? "project") },
    ...turns.map((t) => ({
      role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: (t.text ?? "").slice(0, 4000),
    })),
  ];

  try {
    const result = await chatJson(
      messages,
      (raw) => {
        const obj = extractJson(raw) as { mode?: string; reply?: string };
        if (obj.mode === "build") return { mode: "build" as const, reply: "" };
        if (typeof obj.reply === "string" && obj.reply.trim()) {
          return { mode: "chat" as const, reply: obj.reply.trim() };
        }
        throw new Error("Missing mode/reply.");
      },
      { maxTokens: 1000, temperature: 0.6, json: true }
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: publicAiError(e) }, { status: 502 });
  }
}
