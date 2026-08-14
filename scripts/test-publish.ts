/**
 * End-to-end test of the publish + share system against a running dev server.
 * Covers: publish lifecycle, draft/publish separation, visibility rules,
 * ownership, OG image, and unpublish.
 *
 * Run: E2E_BASE_URL=http://localhost:3001 npx tsx scripts/test-publish.ts
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

  async function makeUser(tag: string) {
    const email = `e2e-${tag}-${Date.now()}@presentkarm.test`;
    const password = `Test-${Math.random().toString(36).slice(2)}-42!`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const jar = new Map<string, string>();
    const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cs: { name: string; value: string }[]) => cs.forEach((c) => jar.set(c.name, c.value)),
      },
    });
    await ssr.auth.signInWithPassword({ email, password });
    const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
    return { id: data.user!.id, cookie };
  }

  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  console.log("✓ created owner + stranger users (email/password accounts work)");

  const authed = (cookie: string) => (path: string, init: RequestInit = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { Cookie: cookie, "Content-Type": "application/json", ...(init.headers ?? {}) },
      redirect: "manual",
    });
  const asOwner = authed(owner.cookie);
  const asStranger = authed(stranger.cookie);

  let failures = 0;
  const check = (name: string, cond: boolean, extra = "") => {
    if (cond) console.log(`✓ ${name}`);
    else {
      failures++;
      console.error(`✗ ${name} ${extra}`);
    }
  };

  // Create a presentation
  const createBody = await (await asOwner("/api/presentations", { method: "POST", body: "{}" })).json();
  const pid = createBody.presentation.id as string;

  // Give it a recognisable heading
  const doc = createBody.presentation;
  doc.title = "Publish Flow Test";
  doc.slides[0].elements[0].props.text = "VERSION ONE";
  await asOwner(`/api/presentations/${pid}`, { method: "PATCH", body: JSON.stringify({ presentation: doc }) });

  // Status before publish
  const st0 = await (await asOwner(`/api/presentations/${pid}/publish`)).json();
  check("status starts unpublished", st0.published === false);

  // Public URL 404 before publish
  const pub0 = await fetch(`${BASE}/p/${pid}`, { redirect: "manual" });
  check("public URL 404 before publish", pub0.status === 404, `got ${pub0.status}`);

  // Publish (link visibility)
  const pubRes = await asOwner(`/api/presentations/${pid}/publish`, {
    method: "POST",
    body: JSON.stringify({ visibility: "link" }),
  });
  const pubBody = await pubRes.json();
  check("publish succeeds", pubRes.status === 200 && pubBody.published === true);

  // Public URL now works WITHOUT auth
  const pub1 = await fetch(`${BASE}/p/${pid}`);
  const html1 = await pub1.text();
  check("public URL live without auth", pub1.status === 200);
  check("public page shows published content", html1.includes("VERSION ONE"));
  check("public page has OG metadata", html1.includes('property="og:title"') && html1.includes("Publish Flow Test"));

  // OG image renders
  const og = await fetch(`${BASE}/p/${pid}/opengraph-image`);
  check(
    "OG preview image renders",
    og.status === 200 && (og.headers.get("content-type") ?? "").includes("image/png"),
    `got ${og.status} ${og.headers.get("content-type")}`
  );

  // Draft/publish separation: edit the draft, public stays on old version
  doc.slides[0].elements[0].props.text = "VERSION TWO";
  doc.updatedAt = new Date().toISOString();
  await asOwner(`/api/presentations/${pid}`, { method: "PATCH", body: JSON.stringify({ presentation: doc }) });
  const pub2 = await fetch(`${BASE}/p/${pid}`);
  const html2 = await pub2.text();
  check("draft edits do NOT change public version", html2.includes("VERSION ONE") && !html2.includes("VERSION TWO"));

  const st1 = await (await asOwner(`/api/presentations/${pid}/publish`)).json();
  check("status reports unpublished changes", st1.hasUnpublishedChanges === true);

  // Republish → public updates
  await asOwner(`/api/presentations/${pid}/publish`, { method: "POST", body: JSON.stringify({ visibility: "link" }) });
  const pub3 = await fetch(`${BASE}/p/${pid}`);
  check("republish updates public version", (await pub3.text()).includes("VERSION TWO"));

  // Visibility: private
  await asOwner(`/api/presentations/${pid}/publish`, { method: "PATCH", body: JSON.stringify({ visibility: "private" }) });
  const privAnon = await fetch(`${BASE}/p/${pid}`, { redirect: "manual" });
  check("private presentation blocked for anonymous", privAnon.status === 404, `got ${privAnon.status}`);
  const privStranger = await asStranger(`/p/${pid}`);
  check("private presentation blocked for other users", privStranger.status === 404, `got ${privStranger.status}`);
  const privOwner = await asOwner(`/p/${pid}`);
  check("private presentation visible to owner", privOwner.status === 200, `got ${privOwner.status}`);

  // Ownership: stranger cannot publish/unpublish someone else's presentation
  const strangerPub = await asStranger(`/api/presentations/${pid}/publish`, {
    method: "POST",
    body: JSON.stringify({ visibility: "public" }),
  });
  check("stranger cannot publish someone else's deck", strangerPub.status === 404, `got ${strangerPub.status}`);
  const strangerUnpub = await asStranger(`/api/presentations/${pid}/publish`, { method: "DELETE" });
  check("stranger cannot unpublish someone else's deck", strangerUnpub.status === 404, `got ${strangerUnpub.status}`);

  // Unpublish
  const unpub = await asOwner(`/api/presentations/${pid}/publish`, { method: "DELETE" });
  check("owner can unpublish", unpub.status === 200);
  const gone = await fetch(`${BASE}/p/${pid}`, { redirect: "manual" });
  check("public URL 404 after unpublish", gone.status === 404, `got ${gone.status}`);

  // Reset password page reachable
  const reset = await fetch(`${BASE}/auth/reset`);
  check("reset password page renders", reset.status === 200, `got ${reset.status}`);

  // Cleanup
  await asOwner(`/api/presentations/${pid}`, { method: "DELETE" });
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(stranger.id);
  console.log("✓ cleaned up test users");

  console.log(failures === 0 ? "\nALL PUBLISH TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Publish test crashed:", e);
  process.exit(1);
});
