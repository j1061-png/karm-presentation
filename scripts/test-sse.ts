/**
 * Tests the /api/generate SSE endpoint end-to-end with a real session and a
 * real DeepSeek generation. Run: npx tsx scripts/test-sse.ts
 */
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  const email = `e2e-sse-${Date.now()}@presentkarm.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}-42!`;
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs: { name: string; value: string }[]) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  await ssr.auth.signInWithPassword({ email, password });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  console.log("Streaming /api/generate ...");
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "A 3-slide mini deck about rooftop solar benefits for homeowners, with one stat slide.",
      files: [{ name: "notes.txt", kind: "text", content: "Rooftop solar cuts bills by ~40% in Egypt. Payback period ~5 years." }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`generate returned ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const stages: string[] = [];
  let presentationId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      stages.push(data.stage);
      console.log(`  stage: ${data.stage}${data.detail ? ` — ${data.detail}` : ""}`);
      if (data.stage === "complete") presentationId = data.presentationId;
      if (data.stage === "error") throw new Error(`pipeline error: ${data.message}`);
    }
  }

  if (!presentationId) throw new Error("no complete event received");
  console.log(`✓ SSE stream completed, presentation ${presentationId}`);

  const getRes = await fetch(`${BASE}/api/presentations/${presentationId}`, { headers: { Cookie: cookie } });
  const getBody = await getRes.json();
  if (getRes.status !== 200 || !getBody.presentation?.slides?.length) {
    throw new Error("generated presentation was not persisted");
  }
  console.log(`✓ persisted with ${getBody.presentation.slides.length} slides: "${getBody.presentation.title}"`);

  await fetch(`${BASE}/api/presentations/${presentationId}`, { method: "DELETE", headers: { Cookie: cookie } });
  await admin.auth.admin.deleteUser(created.user!.id);
  console.log("✓ cleaned up. SSE TEST PASSED");
}

main().catch((e) => {
  console.error("SSE test failed:", e);
  process.exit(1);
});
