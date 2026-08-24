import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { parseChatDecision } from "@/lib/chat-decision";
import { chat } from "@/lib/deepseek";
import { publicAiError } from "@/lib/public-error";

export const maxDuration = 60;

/**
 * Conversational endpoint: lets people talk to webo like a normal chatbot.
 * The model decides whether the latest message is small talk / a question
 * (answer directly) or a request to build something (the client then runs
 * the generation pipeline).
 */

interface ChatBody {
  messages?: { role?: string; text?: string }[];
  hasProject?: boolean;
  kind?: string;
  /** Optional source material to ground the answer. */
  sources?: { name?: string; content?: string }[];
  /** Pure chat mode: always answer conversationally, never signal a build. */
  forceChat?: boolean;
}

const MAX_SOURCE_CHARS = 9000;
const MAX_TOTAL_SOURCE_CHARS = 27000;

function sourcesContext(sources: ChatBody["sources"]): string {
  if (!Array.isArray(sources) || sources.length === 0) return "";
  let total = 0;
  const parts: string[] = [];
  for (const s of sources.slice(0, 10)) {
    if (typeof s?.content !== "string" || !s.content.trim()) continue;
    const room = Math.min(MAX_SOURCE_CHARS, MAX_TOTAL_SOURCE_CHARS - total);
    if (room <= 0) break;
    const body = s.content.slice(0, room);
    total += body.length;
    parts.push(`--- SOURCE: ${typeof s.name === "string" ? s.name : "untitled"} ---\n${body}`);
  }
  if (parts.length === 0) return "";
  return `\n\nThe user has added source material. Ground your answers in it — quote figures and facts from the sources, say which source they came from when useful, and say clearly when the sources do not contain the answer.\n\n${parts.join("\n\n")}`;
}

function chatOnlyPrompt(): string {
  return `You are webo, a friendly AI assistant inside an AI workspace that builds presentations, websites, games, and apps.

You are in pure chat mode. ALWAYS respond with ONLY: {"mode":"chat","reply":"<your answer>"}

Rules for "reply":
- Be warm, helpful, and concise (a short paragraph or a few bullet points; never a wall of text).
- Help with anything: brainstorming, explanations, feedback, planning, general questions.
- If the user asks you to build something, explain what you'd make and tell them to switch the picker to Presentation, Website, Game, or App to generate it.
- Plain text only, no markdown headers.

Respond with ONLY the JSON object. No other text.`;
}

function systemPrompt(hasProject: boolean, kind: string): string {
  const buildMeaning = hasProject
    ? `asks you to CHANGE, EDIT, ADD TO, or REDESIGN the currently open ${kind} (e.g. "make the header blue", "add a slide about pricing", "fix the bug")`
    : `asks you to CREATE or BUILD something (a presentation, website, game, or app — e.g. "make me a snake game", "build a portfolio site", "create a pitch deck")`;

  return `You are webo, a friendly AI workspace assistant. You chat naturally AND you can build presentations, websites, games, and apps.

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
    {
      role: "system" as const,
      content:
        (body.forceChat === true
          ? chatOnlyPrompt()
          : systemPrompt(body.hasProject === true, body.kind ?? "project")) +
        sourcesContext(body.sources),
    },
    ...turns.map((t) => ({
      role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: (t.text ?? "").slice(0, 4000),
    })),
  ];

  try {
    const raw = await chat(messages, { maxTokens: 1000, temperature: 0.6, json: true });
    return NextResponse.json(parseChatDecision(raw));
  } catch (e) {
    return NextResponse.json({ error: publicAiError(e) }, { status: 502 });
  }
}
