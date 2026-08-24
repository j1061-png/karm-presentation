/**
 * Generate webo app icons (favicon + PWA) from the browser/code mark.
 * Run: npx tsx scripts/make-icons.ts
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const MARK = readFileSync("public/brand/webo-mark.svg", "utf8");

const ICONS: { path: string; size: number; padPct: number; radiusPct: number }[] = [
  { path: "public/favicon.png", size: 64, padPct: 10, radiusPct: 22 },
  { path: "public/icons/apple-touch-icon.png", size: 180, padPct: 18, radiusPct: 0 },
  { path: "public/icons/icon-192.png", size: 192, padPct: 16, radiusPct: 22 },
  { path: "public/icons/icon-512.png", size: 512, padPct: 16, radiusPct: 22 },
];

function html(size: number, padPct: number, radiusPct: number): string {
  const pad = Math.round((size * padPct) / 100);
  const inner = size - pad * 2;
  const radius = Math.round((size * radiusPct) / 100);
  const mark = MARK.replace("<svg", `<svg width="${inner}" height="${inner}"`);
  return `<!doctype html><html><body style="margin:0">
  <div style="
    width:${size}px;height:${size}px;
    border-radius:${radius}px;
    background:#ffffff;
    display:flex;align-items:center;justify-content:center;
  ">${mark}</div></body></html>`;
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(html(icon.size, icon.padPct, icon.radiusPct));
    await page.screenshot({
      path: icon.path,
      omitBackground: true,
      clip: { x: 0, y: 0, width: icon.size, height: icon.size },
    });
    console.log(`wrote ${icon.path} (${icon.size}px)`);
  }
  await browser.close();
}

void main();
