/**
 * Collects browser console errors/warnings for the given pages.
 * Run: node scripts/console-check.mjs [url ...]
 */
import { chromium } from "playwright";

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["http://localhost:3001/"];

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const msgs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) msgs.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => msgs.push(`pageerror: ${e.message}`));

for (const url of urls) {
  msgs.push(`== ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}

console.log(msgs.join("\n") || "no console issues");
await browser.close();
