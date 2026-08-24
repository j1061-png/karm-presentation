/**
 * Tests AI resilience helpers: chat routing, SSE parsing, empty-model
 * payloads, and follow-up edits that must never throw.
 * Run: npx tsx scripts/test-ai-resilience.ts
 */
import { parseChatDecision } from "../src/lib/chat-decision";
import { extractMessageContent } from "../src/lib/deepseek";
import { applyOperations } from "../src/lib/generate";
import { parseSseData } from "../src/lib/sse";
import { repairPresentation } from "../src/lib/validate";

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

console.log("parseChatDecision:");

test("reads a clean JSON chat reply", () => {
  const d = parseChatDecision('{"mode":"chat","reply":"Hello there"}');
  expect(d.mode === "chat" && d.reply === "Hello there", "chat json");
});

test("reads a build decision", () => {
  const d = parseChatDecision('{"mode":"build"}');
  expect(d.mode === "build" && d.reply === "", "build json");
});

test("extracts JSON from markdown fences", () => {
  const d = parseChatDecision('Sure!\n```json\n{"mode":"chat","reply":"On it."}\n```');
  expect(d.mode === "chat" && d.reply === "On it.", "fenced");
});

test("treats prose as a chat reply instead of crashing", () => {
  const d = parseChatDecision("Happy to help — what would you like to change?");
  expect(d.mode === "chat" && d.reply.includes("Happy to help"), "prose fallback");
});

test("still detects a truncated build object", () => {
  const d = parseChatDecision('{ "mode": "build"');
  expect(d.mode === "build", "truncated build");
});

console.log("\nextractMessageContent:");

test("reads normal content", () => {
  const { content, finishReason } = extractMessageContent({
    choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }],
  });
  expect(content === '{"a":1}' && finishReason === "stop", "content");
});

test("empty thinking payload is empty content, not a throw", () => {
  const { content, finishReason } = extractMessageContent({
    choices: [{ message: { content: "", reasoning_content: "let me think..." }, finish_reason: "length" }],
  });
  expect(content === "" && finishReason === "length", "empty thinking");
});

test("garbage payload does not throw", () => {
  const { content } = extractMessageContent(null);
  expect(content === "", "null");
});

console.log("\nparseSseData:");

test("parses a stage event", () => {
  const data = parseSseData("data: {\"stage\":\"planning\",\"detail\":\"ok\"}") as { stage: string };
  expect(data.stage === "planning", "stage");
});

test("ignores malformed JSON instead of throwing", () => {
  expect(parseSseData("data: {not json") === null, "junk");
});

test("ignores keep-alives", () => {
  expect(parseSseData("data: [DONE]") === null, "done");
});

console.log("\napplyOperations:");

const now = new Date().toISOString();
const deck = repairPresentation({
  id: "deck12345678",
  title: "Deck",
  createdAt: now,
  updatedAt: now,
  slides: [{ name: "One", elements: [{ type: "heading", props: { text: "Hi" } }] }],
});

test("applies a title change", () => {
  const next = applyOperations(deck, { summary: "ok", operations: [{ op: "setTitle", title: "New" }] });
  expect(next.title === "New", "title");
});

test("skips a replaceSlide that cannot be repaired instead of throwing", () => {
  const next = applyOperations(deck, {
    summary: "ok",
    operations: [{ op: "replaceSlide", slideId: deck.slides[0].id, slide: { name: "x" } as never }],
  });
  expect(next.slides.length === 1, "still one slide");
});

test("never throws on a mixed bag of ops", () => {
  const next = applyOperations(deck, {
    summary: "ok",
    operations: [
      { op: "deleteSlide", slideId: "missing" },
      { op: "setTitle", title: "Still here" },
      { op: "updateElement", slideId: deck.slides[0].id, elementId: "nope", element: { type: "hologram" } as never },
    ],
  });
  expect(next.title === "Still here", "survived mixed ops");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
