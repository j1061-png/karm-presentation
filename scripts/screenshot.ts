/**
 * Visual QA: sign in as a seeded test user and screenshot every core page
 * in dark and light themes. Output: /tmp/karm-shots/*.png
 *
 * Run: E2E_BASE_URL=http://localhost:3001 npx tsx scripts/screenshot.ts
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const OUT = "/tmp/karm-shots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  // Seed user
  const email = `shot-${Date.now()}@presentkarm.test`;
  const password = "Screenshot-Test-42!";
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Malek Zahran" },
  });
  const userId = created.user!.id;

  const jar = new Map<string, string>();
  const ssr = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs: { name: string; value: string }[]) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  await ssr.auth.signInWithPassword({ email, password });
  const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  // Seed a blank presentation so the editor has content to show
  const createRes = await fetch(`${BASE}/api/presentations`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Company overview" }),
  });
  const { presentation } = await createRes.json();
  const pid = presentation.id as string;
  // A couple more so recents look real
  for (const title of ["Q3 performance review", "Investor pitch — Aswan 50MW"]) {
    const r = await fetch(`${BASE}/api/presentations`, {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: "{}",
    });
    const { presentation: p } = await r.json();
    p.title = title;
    await fetch(`${BASE}/api/presentations/${p.id}`, {
      method: "PATCH",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ presentation: p }),
    });
  }
  // Publish one so a Live badge shows
  await fetch(`${BASE}/api/presentations/${pid}/publish`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: "link" }),
  });

  const browser = await chromium.launch();

  async function makeContext(theme: "dark" | "light", authed: boolean): Promise<BrowserContext> {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(`localStorage.setItem("pk-theme", "${theme}")`);
    if (authed) {
      const cookies = [...jar.entries()].map(([name, value]) => ({
        name,
        value: encodeURIComponent(value),
        url: BASE,
      }));
      await context.addCookies(cookies);
    }
    return context;
  }

  async function shot(
    name: string,
    path: string,
    opts: {
      theme?: "dark" | "light";
      authed?: boolean;
      click?: string;
      settle?: number;
      viewport?: { width: number; height: number };
    } = {}
  ) {
    if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return;
    const context = await makeContext(opts.theme ?? "dark", opts.authed ?? true);
    const page = await context.newPage();
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) console.log(`  [console.${m.type()}] ${m.text()}`);
    });
    page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
    if (opts.viewport) await page.setViewportSize(opts.viewport);
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if (opts.click) {
      await page.click(opts.click);
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(opts.settle ?? 800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await context.close();
    console.log(`✓ ${name}`);
  }

  await shot("01-landing-dark", "/", { authed: false });
  await shot("02-landing-light", "/", { authed: false, theme: "light" });
  await shot("03-home-dark", "/dashboard");
  await shot("04-home-light", "/dashboard", { theme: "light" });
  await shot("05-presentations-dark", "/dashboard", { click: "text=Presentations" });
  await shot("06-templates-dark", "/dashboard", { click: "text=Templates" });
  await shot("07-settings-light", "/dashboard", { theme: "light", click: "text=Settings" });
  await shot("08-editor-dark", `/editor/${pid}`, { settle: 1600 });
  await shot("09-editor-light", `/editor/${pid}`, { theme: "light", settle: 1600 });
  await shot("10-public-view", `/p/${pid}`, { authed: false, settle: 1600 });
  await shot("11-sidebar-collapsed", "/dashboard", { click: "[aria-label='Collapse sidebar']" });
  await shot("12-home-laptop", "/dashboard", { viewport: { width: 1024, height: 700 } });
  await shot("13-editor-preview", `/editor/${pid}`, { click: "text=Preview", settle: 1600 });

  await browser.close();

  // Cleanup
  const listRes = await fetch(`${BASE}/api/presentations`, { headers: { Cookie: cookieHeader } });
  const { presentations } = await listRes.json();
  for (const m of presentations ?? []) {
    await fetch(`${BASE}/api/presentations/${m.id}`, { method: "DELETE", headers: { Cookie: cookieHeader } });
  }
  await admin.auth.admin.deleteUser(userId);
  console.log("done — screenshots in", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
