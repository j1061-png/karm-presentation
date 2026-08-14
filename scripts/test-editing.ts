/**
 * Editor interaction test: verifies in a real browser that double-click
 * inline editing works — heading text edits commit, list items edit, no
 * doubled text while editing. Screenshots go to /tmp/karm-shots.
 *
 * Run: E2E_BASE_URL=http://localhost:3001 npx tsx scripts/test-editing.ts
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
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );

  const email = `editing-${Date.now()}@presentkarm.test`;
  const password = "Editing-Test-42!";
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  // Sign in through the real login form
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // let React hydrate (dev server is slow)
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL("**/dashboard**", { timeout: 20000 });
  } catch (err) {
    console.error("Sign-in did not navigate. URL:", page.url());
    console.error("Page text:", (await page.locator("main, body").first().innerText()).slice(0, 600));
    await page.screenshot({ path: `${OUT}/21-signin-failed.png` });
    throw err;
  }

  // Create a deck through the API from inside the signed-in browser session
  const doc = await page.evaluate(async () => {
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const { presentation } = await res.json();
    presentation.title = "Editing Test";
    presentation.slides = [
      {
        id: "s1",
        name: "Edit me",
        transition: "fade",
        elements: [
          { id: "h1", type: "heading", x: 6, y: 10, w: 60, h: 14, z: 1, opacity: 1, rotation: 0, props: { text: "ORIGINAL-HEADING", level: 2 } },
          { id: "t1", type: "text", x: 6, y: 30, w: 60, h: 14, z: 1, opacity: 1, rotation: 0, props: { text: "ORIGINAL-TEXT" } },
          { id: "l1", type: "list", x: 6, y: 50, w: 60, h: 30, z: 1, opacity: 1, rotation: 0, props: { items: ["ITEM-ONE", "ITEM-TWO"], ordered: false, marker: "dot" } },
        ],
      },
    ];
    await fetch(`/api/presentations/${presentation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presentation }),
    });
    return presentation;
  });

  await page.goto(`${BASE}/editor/${doc.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-element-id="h1"]', { timeout: 20000 });
  await page.waitForTimeout(800);

  let failures = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) console.log(`✓ ${name}`);
    else {
      failures++;
      console.error(`✗ ${name}`);
    }
  };

  // Thumbnails also render elements; the canvas copy comes last in the DOM.
  const canvasEl = (id: string) => page.locator(`[data-element-id="${id}"]`).last();

  async function dblclickElement(id: string) {
    const box = await canvasEl(id).boundingBox();
    if (!box) throw new Error(`no bounding box for ${id}`);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
  }

  // ---- Heading edit
  await dblclickElement("h1");
  const editor = page.locator('[role="textbox"][contenteditable="true"]');
  check("double-click opens inline editor", (await editor.count()) === 1);
  check(
    "original element hidden while editing (no doubled text)",
    await canvasEl("h1").evaluate((n) => getComputedStyle(n).visibility === "hidden")
  );
  await page.screenshot({ path: `${OUT}/21-editing-heading.png` });
  await page.keyboard.type("EDITED-HEADING");
  await page.keyboard.press("Enter"); // Enter commits headings
  await page.waitForTimeout(400);
  check("typed heading text committed", await page.getByText("EDITED-HEADING").first().isVisible());
  check("editor closed after commit", (await editor.count()) === 0);

  // ---- Text edit, commit by clicking away
  await dblclickElement("t1");
  check("text editor opens", (await editor.count()) === 1);
  await page.keyboard.type("EDITED-TEXT LINE");
  await page.mouse.click(1500, 900); // blur by clicking outside the slide
  await page.waitForTimeout(400);
  check("text commit on blur", await page.getByText("EDITED-TEXT LINE").first().isVisible());

  // ---- List edit: one item per line
  await dblclickElement("l1");
  check("list editor opens", (await editor.count()) === 1);
  await page.keyboard.type("NEW-A\nNEW-B\nNEW-C");
  await page.mouse.click(1500, 900);
  await page.waitForTimeout(400);
  check(
    "list items committed",
    (await page.getByText("NEW-A").count()) > 0 &&
      (await page.getByText("NEW-C").count()) > 0
  );

  // ---- Escape cancels
  await dblclickElement("h1");
  await page.keyboard.type("SHOULD-NOT-APPEAR");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("escape cancels the edit", (await page.getByText("SHOULD-NOT-APPEAR").count()) === 0);
  check("heading kept committed value after cancel", (await page.getByText("EDITED-HEADING").count()) > 0);

  // ---- Autosave persisted the edits
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("edits survive reload (autosave)", (await page.getByText("EDITED-HEADING").count()) > 0);

  await page.screenshot({ path: `${OUT}/22-editing-after.png` });

  const realErrors = consoleErrors.filter((e) => !e.includes("favicon"));
  check("no browser console errors", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors.slice(0, 5));

  await browser.close();

  // Cleanup: remove the QA user and its storage
  await admin.storage
    .from("presentations")
    .remove([`users/${created.user!.id}/docs/${doc.id}.json`, `users/${created.user!.id}/index.json`]);
  await admin.auth.admin.deleteUser(created.user!.id);

  console.log(failures === 0 ? "\nALL EDITING TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
