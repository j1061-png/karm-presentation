/**
 * Server-side DeepSeek client. The API key never leaves the server —
 * all calls go through Next.js route handlers.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

/** Hard cap per upstream attempt so a hung connection fails fast enough to retry. */
const ATTEMPT_TIMEOUT_MS = 150_000;
/** Transient failures (network, 429, 5xx) are retried this many extra times. */
const MAX_TRANSIENT_RETRIES = 2;
const RETRY_DELAYS_MS = [1_500, 4_000];

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One upstream attempt with its own timeout, linked to the caller's signal. */
async function attempt(body: string, callerSignal: AbortSignal | undefined): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DeepSeekError("DeepSeek request timed out.", 504)),
    ATTEMPT_TIMEOUT_MS
  );
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  if (callerSignal?.aborted) controller.abort(callerSignal.reason);

  try {
    return await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new DeepSeekError("DEEPSEEK_API_KEY is not configured.", 500);

  const body = JSON.stringify({
    model: options.model ?? DEFAULT_MODEL,
    messages,
    max_tokens: options.maxTokens ?? 8000,
    // Reasoner ignores sampling knobs and can reject them.
    ...((options.model ?? DEFAULT_MODEL) === "deepseek-reasoner"
      ? {}
      : { temperature: options.temperature ?? 0.3 }),
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
    stream: false,
  });

  // Transient upstream failures (dropped connection, 429, 5xx, per-attempt
  // timeout) used to surface immediately as "Something went wrong with the
  // AI". Retry them a couple of times with backoff before giving up; only
  // non-retryable statuses (4xx other than 429) and caller aborts fail fast.
  let lastError: unknown = null;
  for (let i = 0; i <= MAX_TRANSIENT_RETRIES; i++) {
    if (options.signal?.aborted) throw new DeepSeekError("Request aborted.", 499);
    if (i > 0) await sleep(RETRY_DELAYS_MS[i - 1] ?? 4_000);

    let res: Response;
    try {
      res = await attempt(body, options.signal);
    } catch (e) {
      if (options.signal?.aborted) throw new DeepSeekError("Request aborted.", 499);
      lastError = e instanceof DeepSeekError ? e : new DeepSeekError(`DeepSeek request failed: ${e instanceof Error ? e.message : "network error"}`, 502);
      continue; // network error / timeout — retry
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new DeepSeekError(`DeepSeek request failed (${res.status}): ${text.slice(0, 300)}`, res.status);
      if (res.status === 429 || res.status >= 500) {
        lastError = err;
        continue; // transient — retry
      }
      throw err; // real request problem — retrying won't help
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      lastError = new DeepSeekError("DeepSeek returned an empty response.", 502);
      continue; // occasionally transient — retry
    }
    return content;
  }

  throw lastError instanceof Error
    ? lastError
    : new DeepSeekError("DeepSeek request failed after retries.", 502);
}

/** Call DeepSeek expecting JSON; retries once with a stricter instruction on parse failure. */
export async function chatJson<T>(
  messages: ChatMessage[],
  parse: (raw: string) => T,
  options: ChatOptions = {}
): Promise<T> {
  const first = await chat(messages, { ...options, json: true });
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
    const second = await chat(retryMessages, { ...options, json: true, temperature: 0.3 });
    return parse(second);
  }
}
