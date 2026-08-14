/**
 * Tests the AI-output validation/repair layer against malformed responses.
 * Run: npm run test:validation
 */
import { extractJson, repairPresentation, repairSlide } from "../src/lib/validate";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

function expect(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("extractJson:");

test("parses clean JSON", () => {
  expect((extractJson('{"a":1}') as { a: number }).a === 1, "should parse");
});

test("parses JSON in markdown fences", () => {
  const out = extractJson('Here you go:\n```json\n{"title":"X"}\n```\nHope that helps!') as { title: string };
  expect(out.title === "X", "should extract from fence");
});

test("parses JSON with chatter around it", () => {
  const out = extractJson('Sure! {"a": [1,2,3]} done.') as { a: number[] };
  expect(out.a.length === 3, "should extract object");
});

test("repairs truncated JSON", () => {
  const out = extractJson('{"slides": [{"id": "s1", "name": "One"}, {"id": "s2", "name": "Tw') as {
    slides: unknown[];
  };
  expect(Array.isArray(out.slides), "should repair truncation");
});

test("throws on garbage", () => {
  let threw = false;
  try {
    extractJson("complete nonsense with no braces");
  } catch {
    threw = true;
  }
  expect(threw, "should throw");
});

console.log("\nrepairSlide:");

test("fills missing ids and defaults", () => {
  const slide = repairSlide(
    { elements: [{ type: "heading", props: { text: "Hi" } }] },
    0
  );
  expect(!!slide, "slide should survive");
  expect(!!slide!.id && !!slide!.elements[0].id, "ids should be generated");
});

test("drops invalid elements but keeps valid ones", () => {
  const slide = repairSlide(
    {
      name: "Mixed",
      elements: [
        { type: "heading", props: { text: "Valid" } },
        { type: "hologram", props: {} },
        { type: "chart", props: { labels: ["A"], series: [{ name: "S", data: ["7"] }] } },
      ],
    },
    0
  );
  expect(slide!.elements.length === 2, `expected 2 valid elements, got ${slide!.elements.length}`);
});

test("pads chart series data to labels length and coerces numbers", () => {
  const slide = repairSlide(
    {
      elements: [
        { type: "chart", props: { labels: ["A", "B", "C"], series: [{ name: "S", data: [1] }] } },
      ],
    },
    0
  );
  const chart = slide!.elements[0] as { props: { series: { data: number[] }[] } };
  expect(chart.props.series[0].data.length === 3, "series padded to labels length");
});

test("strips unsafe image URLs", () => {
  const slide = repairSlide(
    {
      elements: [
        // eslint-disable-next-line no-script-url
        { type: "image", props: { src: "javascript:alert(1)", alt: "x" } },
      ],
    },
    0
  );
  const img = slide!.elements[0] as { props: { src: string } };
  expect(img.props.src === "", "unsafe URL should be removed");
});

test("clamps quiz correctIndex", () => {
  const slide = repairSlide(
    { elements: [{ type: "quiz", props: { question: "?", options: ["a", "b"], correctIndex: 99 } }] },
    0
  );
  const quiz = slide!.elements[0] as { props: { correctIndex: number } };
  expect(quiz.props.correctIndex === 1, "correctIndex clamped");
});

console.log("\nrepairPresentation:");

test("recovers a usable presentation from a messy doc", () => {
  const p = repairPresentation({
    title: "Test",
    theme: { colors: { accent: "#ff0000" } },
    slides: [
      { name: "One", elements: [{ type: "heading", props: { text: "Hello" } }] },
      "not a slide",
      { elements: [] },
    ],
  });
  expect(p.slides.length === 2, `expected 2 slides, got ${p.slides.length}`);
  expect(p.theme.colors.accent === "#ff0000", "theme merged");
  expect(p.theme.colors.background.length > 0, "theme defaults filled");
});

test("throws when nothing is recoverable", () => {
  let threw = false;
  try {
    repairPresentation({ slides: ["a", "b"] });
  } catch {
    threw = true;
  }
  expect(threw, "should throw with no valid slides");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
