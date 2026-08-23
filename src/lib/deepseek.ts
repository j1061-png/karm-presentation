/**
 * Server-side DeepSeek client. The API key never leaves the server —
 * all calls go through Next.js route handlers.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
  model?: "deepseek-chat" | "deepseek-reasoner";
}

export class DeepSeekError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new DeepSeekError("DEEPSEEK_API_KEY is not configured.", 500);

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 8000,
      // Reasoner ignores sampling knobs and can reject them.
      ...((options.model ?? DEFAULT_MODEL) === "deepseek-reasoner"
        ? {}
        : { temperature: options.temperature ?? 0.3 }),
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      stream: false,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DeepSeekError(
      `DeepSeek request failed (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new DeepSeekError("DeepSeek returned an empty response.", 502);
  return content;
}

/** Call DeepSeek expecting JSON; retries once with a stricter instruction on parse failure. */
export async function chatJson<T>(
  messages: ChatMessage[],
  parse: (raw: string) => T,
  options: ChatOptions = {}
): Promise<T> {
  const json = options.json !== false;
  const first = await chat(messages, { ...options, json });
  try {
    return parse(first);
  } catch (firstError) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: first.slice(0, 4000) },
      {
        role: "user",
        content:
          "Your previous response was not valid according to the required JSON schema. " +
          "Respond again with ONLY a single valid JSON object that follows the schema exactly. " +
          `Error: ${firstError instanceof Error ? firstError.message : "invalid JSON"}`,
      },
    ];
    const second = await chat(retryMessages, { ...options, json, temperature: 0.2 });
    return parse(second);
  }
}
