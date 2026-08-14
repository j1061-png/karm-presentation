/**
 * Live end-to-end test of the DeepSeek generation pipeline (plan → slides →
 * validation). Makes real API calls. Run: npm run test:generate
 */
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  const { generatePresentation } = await import("../src/lib/generate");

  const prompt =
    "A short 4-slide overview of KarmSolar's solar capacity growth for internal staff. Include one chart with plausible numbers and one timeline.";

  console.log(`Prompt: ${prompt}\n`);
  const start = Date.now();

  const presentation = await generatePresentation(prompt, [], (stage) => {
    console.log(
      `  [${((Date.now() - start) / 1000).toFixed(1)}s] ${stage.stage}` +
        ("detail" in stage && stage.detail ? ` — ${stage.detail}` : "")
    );
  });

  console.log(`\nTitle: ${presentation.title}`);
  console.log(`Theme: ${presentation.theme.name} (${presentation.theme.mode}), accent ${presentation.theme.colors.accent}`);
  console.log(`Slides: ${presentation.slides.length}`);
  for (const [i, slide] of presentation.slides.entries()) {
    const types = slide.elements.map((e) => e.type).join(", ");
    console.log(`  ${i + 1}. ${slide.name} — [${types}]`);
  }

  const hasChart = presentation.slides.some((s) => s.elements.some((e) => e.type === "chart"));
  const hasTimeline = presentation.slides.some((s) => s.elements.some((e) => e.type === "timeline"));
  console.log(`\nChart present: ${hasChart} | Timeline present: ${hasTimeline}`);
  console.log(`Total time: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("Pipeline test failed:", e);
  process.exit(1);
});
