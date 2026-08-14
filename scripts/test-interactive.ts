/**
 * Interaction test: publishes a fixture deck full of interactive elements and
 * verifies in a real browser that they respond (tabs switch, flip cards flip,
 * quiz answers reveal, charts render). Screenshots go to /tmp/karm-shots.
 *
 * Run: E2E_BASE_URL=http://localhost:3001 npx tsx scripts/test-interactive.ts
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

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

  const email = `interact-${Date.now()}@presentkarm.test`;
  const password = "Interact-Test-42!";
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

  // Fixture deck with every interactive element type
  const createRes = await fetch(`${BASE}/api/presentations`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: "{}",
  });
  const { presentation: doc } = await createRes.json();
  doc.title = "Interactivity Test";
  doc.slides = [
    {
      id: "s1",
      name: "Interactive",
      transition: "fade",
      elements: [
        { id: "h1", type: "heading", x: 6, y: 6, w: 60, h: 10, z: 1, opacity: 1, rotation: 0, props: { text: "Interactive elements", level: 2 } },
        { id: "tabs1", type: "tabs", x: 6, y: 20, w: 42, h: 40, z: 1, opacity: 1, rotation: 0, props: { tabs: [
          { label: "Alpha", title: "Alpha view", content: "ALPHA-CONTENT" },
          { label: "Beta", title: "Beta view", content: "BETA-CONTENT" },
        ] } },
        { id: "flip1", type: "flipcards", x: 52, y: 20, w: 42, h: 28, z: 1, opacity: 1, rotation: 0, props: { cards: [
          { front: "FRONT-ONE", back: "BACK-ONE", icon: "sun" },
          { front: "FRONT-TWO", back: "BACK-TWO", icon: "zap" },
        ] } },
        { id: "quiz1", type: "quiz", x: 52, y: 52, w: 42, h: 40, z: 1, opacity: 1, rotation: 0, props: {
          question: "Pick the right answer", options: ["WRONG-A", "RIGHT-B"], correctIndex: 1, explanation: "EXPLAIN-TEXT",
        } },
        { id: "chart1", type: "chart", x: 6, y: 64, w: 42, h: 30, z: 1, opacity: 1, rotation: 0, props: {
          chartType: "bar", labels: ["A", "B", "C"], series: [{ name: "S", data: [3, 7, 5] }],
          stacked: false, showLegend: false, showGrid: true,
        } },
      ],
    },
  ];
  await fetch(`${BASE}/api/presentations/${doc.id}`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ presentation: doc }),
  });
  await fetch(`${BASE}/api/presentations/${doc.id}/publish`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: "link" }),
  });

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`${BASE}/p/${doc.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  let failures = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) console.log(`✓ ${name}`);
    else {
      failures++;
      console.error(`✗ ${name}`);
    }
  };

  // Charts rendered as SVG
  check("chart renders SVG bars", (await page.locator(".recharts-bar-rectangle").count()) === 3);

  // Tabs: Alpha visible, Beta hidden — then click Beta
  check("tab 1 content visible", await page.getByText("ALPHA-CONTENT").isVisible());
  check("tab 2 content hidden initially", (await page.getByText("BETA-CONTENT").count()) === 0);
  await page.getByText("Beta", { exact: true }).click();
  await page.waitForTimeout(400);
  check("clicking tab switches content", await page.getByText("BETA-CONTENT").isVisible());

  // Flip card: back hidden until clicked
  const cardOne = page.getByText("FRONT-ONE");
  check("flip card front visible", await cardOne.isVisible());
  await cardOne.click();
  await page.waitForTimeout(700);
  const flipped = await page.locator(".pk-flip.flipped").count();
  check("clicking flips the card", flipped === 1);

  // Quiz: answer and see explanation
  check("quiz explanation hidden initially", (await page.getByText("EXPLAIN-TEXT").count()) === 0);
  await page.getByText("RIGHT-B").click();
  await page.waitForTimeout(400);
  check("answering quiz reveals explanation", await page.getByText("EXPLAIN-TEXT").isVisible());

  await page.screenshot({ path: `${OUT}/20-interactive-after.png` });

  await browser.close();

  // Cleanup
  await fetch(`${BASE}/api/presentations/${doc.id}`, { method: "DELETE", headers: { Cookie: cookie } });
  await admin.auth.admin.deleteUser(created.user!.id);

  console.log(failures === 0 ? "\nALL INTERACTION TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
