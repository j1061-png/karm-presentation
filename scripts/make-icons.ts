/**
 * Generate the Studio app icons (favicon + PWA icons) — an "S" monogram on an
 * accent rounded square. Run: npx tsx scripts/make-icons.ts
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const ICONS: { path: string; size: number; radiusPct: number }[] = [
  { path: "public/favicon.png", size: 64, radiusPct: 24 },
  { path: "public/icons/apple-touch-icon.png", size: 180, radiusPct: 0 },
  { path: "public/icons/icon-192.png", size: 192, radiusPct: 22 },
  { path: "public/icons/icon-512.png", size: 512, radiusPct: 22 },
];

function html(size: number, radiusPct: number): string {
  return `<!doctype html><html><body style="margin:0">
  <div style="
    width:${size}px;height:${size}px;
    border-radius:${(size * radiusPct) / 100}px;
    background:linear-gradient(135deg,#f7b733 0%,#f5a623 55%,#e08e0b 100%);
    display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;
  ">
    <span style="
      color:#1a1204;font-weight:800;line-height:1;
      font-size:${Math.round(size * 0.58)}px;
      letter-spacing:${-size * 0.02}px;
      transform:translateY(${-size * 0.01}px);
    ">S</span>
  </div></body></html>`;
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
    await page.setContent(html(icon.size, icon.radiusPct));
    await page.screenshot({ path: icon.path, omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
    console.log(`wrote ${icon.path} (${icon.size}px)`);
  }
  await browser.close();
}

void main();
