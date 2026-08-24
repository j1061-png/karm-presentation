/**
 * End-to-end API test against a running dev server (localhost:3000).
 * Creates a temporary confirmed user via the Supabase admin API, signs in,
 * and exercises: auth guards, CRUD, autosave, duplicate, AI edit,
 * standalone rendering, and cleanup.
 *
 * Run: npx tsx scripts/test-api.ts
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
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------- test user
  const email = `e2e-test-${Date.now()}@presentkarm.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}-42!`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`createUser failed: ${createErr?.message}`);
  const userId = created.user.id;
  console.log(`✓ created test user ${email}`);

  // Sign in through @supabase/ssr so cookies are produced in the exact
  // format the Next.js middleware expects (incl. chunking/encoding).
  const jar = new Map<string, string>();
  const ssrClient = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs: { name: string; value: string }[]) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { error: signInErr } = await ssrClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  console.log(`✓ signed in, session cookie built (${jar.size} cookie(s))`);

  const authed = (path: string, init: RequestInit = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { Cookie: cookieHeader, "Content-Type": "application/json", ...(init.headers ?? {}) },
      redirect: "manual",
    });

  let failures = 0;
  const check = (name: string, cond: boolean, extra = "") => {
    if (cond) console.log(`✓ ${name}`);
    else {
      failures++;
      console.error(`✗ ${name} ${extra}`);
    }
  };

  // ---------------------------------------------------------- auth guards
  const unauthApi = await fetch(`${BASE}/api/presentations`, { redirect: "manual" });
  check("unauthenticated API returns 401", unauthApi.status === 401, `got ${unauthApi.status}`);

  const unauthPage = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check(
    "unauthenticated /dashboard redirects to /",
    unauthPage.status === 307 || unauthPage.status === 302,
    `got ${unauthPage.status}`
  );

  const landing = await fetch(`${BASE}/`, { redirect: "manual" });
  check("landing page renders", landing.status === 200);
  const landingHtml = await landing.text();
  check("landing has webo branding", landingHtml.includes("webo"));

  const authedDashboard = await authed("/dashboard");
  check("authenticated /dashboard renders", authedDashboard.status === 200, `got ${authedDashboard.status}`);

  // ---------------------------------------------------------------- CRUD
  const createRes = await authed("/api/presentations", { method: "POST", body: JSON.stringify({}) });
  const createBody = await createRes.json();
  check("create blank presentation", createRes.status === 200 && !!createBody.presentation?.id);
  const pid = createBody.presentation.id as string;

  const listRes = await authed("/api/presentations");
  const listBody = await listRes.json();
  check(
    "list contains created presentation",
    listBody.presentations?.some((m: { id: string }) => m.id === pid)
  );

  const renameRes = await authed(`/api/presentations/${pid}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "E2E Renamed Deck" }),
  });
  const renameBody = await renameRes.json();
  check("rename works", renameBody.presentation?.title === "E2E Renamed Deck");

  // Autosave: full-document PATCH with an extra slide
  const doc = renameBody.presentation;
  doc.slides.push({
    id: "e2eslide2",
    name: "Added by autosave",
    transition: "fade",
    elements: [
      { id: "e2eel1", type: "heading", x: 6, y: 10, w: 80, h: 14, z: 1, opacity: 1, rotation: 0, props: { text: "Autosaved slide", level: 2 } },
      { id: "e2eel2", type: "chart", x: 6, y: 30, w: 80, h: 50, z: 1, opacity: 1, rotation: 0, props: { chartType: "bar", labels: ["A", "B"], series: [{ name: "S", data: [1, 2] }], stacked: false, showLegend: true, showGrid: true } },
    ],
  });
  const saveRes = await authed(`/api/presentations/${pid}`, {
    method: "PATCH",
    body: JSON.stringify({ presentation: doc }),
  });
  const saveBody = await saveRes.json();
  check("autosave full document", saveBody.presentation?.slides?.length === 2, JSON.stringify(saveBody).slice(0, 200));

  // Malformed autosave is rejected cleanly
  const badSave = await authed(`/api/presentations/${pid}`, {
    method: "PATCH",
    body: JSON.stringify({ presentation: { slides: "garbage" } }),
  });
  check("malformed save rejected with 400", badSave.status === 400, `got ${badSave.status}`);

  // Duplicate
  const dupRes = await authed(`/api/presentations/${pid}/duplicate`, { method: "POST" });
  const dupBody = await dupRes.json();
  check("duplicate works", dupRes.status === 200 && dupBody.presentation?.id !== pid);

  // Ownership: a second user must not see this presentation
  const other = await admin.auth.admin.createUser({
    email: `e2e-other-${Date.now()}@presentkarm.test`,
    password,
    email_confirm: true,
  });
  const jar2 = new Map<string, string>();
  const ssr2 = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar2.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs: { name: string; value: string }[]) => cs.forEach((c) => jar2.set(c.name, c.value)),
    },
  });
  await ssr2.auth.signInWithPassword({ email: other.data.user!.email!, password });
  const cookie2 = [...jar2.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  const crossRes = await fetch(`${BASE}/api/presentations/${pid}`, {
    headers: { Cookie: cookie2 },
  });
  check("other user cannot access presentation (404)", crossRes.status === 404, `got ${crossRes.status}`);

  // Standalone presentation page
  const standaloneRes = await authed(`/presentations/${pid}`);
  const standaloneHtml = await standaloneRes.text();
  check("standalone presentation page renders", standaloneRes.status === 200);
  check("standalone page contains presentation data", standaloneHtml.includes("Autosaved slide"));

  // Editor page
  const editorRes = await authed(`/editor/${pid}`);
  check("editor page renders", editorRes.status === 200, `got ${editorRes.status}`);

  // ------------------------------------------------------------- AI edit
  console.log("  (calling DeepSeek for a live AI edit...)");
  const editRes = await authed("/api/ai-edit", {
    method: "POST",
    body: JSON.stringify({
      presentationId: pid,
      instruction: "Change the heading on the second slide to say 'Edited by AI' and nothing else.",
      presentation: saveBody.presentation,
      selectedSlideId: "e2eslide2",
    }),
  });
  const editBody = await editRes.json();
  check(
    "AI edit returns updated document",
    editRes.status === 200 && editBody.changed === true && !!editBody.summary,
    JSON.stringify(editBody).slice(0, 200)
  );

  // ------------------------------------------------------------- cleanup
  const delRes = await authed(`/api/presentations/${pid}`, { method: "DELETE" });
  check("delete works", delRes.status === 200);
  if (dupBody.presentation?.id) {
    await authed(`/api/presentations/${dupBody.presentation.id}`, { method: "DELETE" });
  }
  const listAfter = await (await authed("/api/presentations")).json();
  check(
    "deleted presentation gone from list",
    !listAfter.presentations?.some((m: { id: string }) => m.id === pid)
  );

  await admin.auth.admin.deleteUser(userId);
  if (other.data.user) await admin.auth.admin.deleteUser(other.data.user.id);
  console.log("✓ test users deleted");

  console.log(failures === 0 ? "\nALL API TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("API test crashed:", e);
  process.exit(1);
});
