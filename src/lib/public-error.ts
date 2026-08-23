/** User-facing AI errors — never mention the provider or leak upstream bodies. */
export function publicAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  // The generic fallback below hid a month of hard upstream failures (a
  // retired model id) behind "something went wrong". Keep the real reason in
  // the server logs, where only operators can see it.
  console.error("[ai]", raw || error);
  if (/not configured/i.test(raw)) return "AI is not available right now. Please try again later.";
  if (/429|rate/i.test(raw)) return "The AI is busy. Please try again in a moment.";
  if (/timeout|abort/i.test(raw)) return "The AI request timed out. Please try again.";
  if (/empty response/i.test(raw)) return "The AI returned an empty response. Please try again.";
  return "Something went wrong with the AI. Please try again.";
}
