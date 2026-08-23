/* Ad-hoc smoke test for web-kind validation, preview assembly, and domains. */
import { repairPresentation, repairFiles, sanitizeFilePath } from "../src/lib/validate";
import { assemblePreviewHtml } from "../src/lib/web-preview";
import { normalizeHostname } from "../src/lib/domains";
import { applyWebEdit } from "../src/lib/generate";

let failed = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failed++;
}

// sanitizeFilePath
check("accepts index.html", sanitizeFilePath("index.html") === "index.html");
check("strips leading ./", sanitizeFilePath("./styles.css") === "styles.css");
check("rejects traversal", sanitizeFilePath("../secret") === null);
check("rejects nested traversal", sanitizeFilePath("a/../../b") === null);
check("rejects absolute-ish", sanitizeFilePath("/etc/passwd") === "etc/passwd");
check("rejects weird chars", sanitizeFilePath("a<script>.js") === null);

// repairFiles
const files = repairFiles([
  { path: "index.html", content: "<!doctype html><title>x</title>" },
  { path: "index.html", content: "dupe" },
  { path: "../evil.js", content: "x" },
  { path: "app.js", content: "console.log(1)" },
  { path: "bad", content: 42 },
]);
check("dedupes + drops bad entries", files.length === 2 && files[0].path === "index.html");

// repairPresentation for web kind
const now = new Date().toISOString();
const web = repairPresentation({
  id: "abc123def456",
  title: "My site",
  kind: "website",
  files: [{ path: "index.html", content: "<!doctype html><h1>hello world this is content</h1>" }],
  createdAt: now,
  updatedAt: now,
});
check("web kind keeps files", web.kind === "website" && (web.files?.length ?? 0) === 1);
check("web kind allows zero slides", web.slides.length === 0);
check("entry defaults to index.html", web.entry === "index.html");

// presentation kind still requires slides
let threw = false;
try {
  repairPresentation({ id: "x", kind: "presentation", slides: [], createdAt: now, updatedAt: now });
} catch {
  threw = true;
}
check("presentation with no slides throws", threw);

// assemblePreviewHtml inlines assets
const html = assemblePreviewHtml(
  [
    { path: "index.html", content: `<html><head><link rel="stylesheet" href="styles.css"></head><body><script src="./app.js"></script></body></html>` },
    { path: "styles.css", content: "body{color:red}" },
    { path: "app.js", content: "console.log('hi')" },
  ],
  "index.html"
);
check("inlines css", html.includes("<style>\nbody{color:red}\n</style>"));
check("inlines js", html.includes("console.log('hi')"));
check("no leftover link tag", !html.includes("styles.css"));

// applyWebEdit merge semantics
const edited = applyWebEdit(web, {
  summary: "s",
  files: [{ path: "about.html", content: "<h1>about</h1>" }],
  deleteFiles: [],
});
check("edit adds file", (edited.files?.length ?? 0) === 2);
const deleted = applyWebEdit(edited, { summary: "s", files: [], deleteFiles: ["about.html"] });
check("edit deletes file", (deleted.files?.length ?? 0) === 1);
check("entry survives edits", deleted.entry === "index.html");

// normalizeHostname
check("normalizes url form", normalizeHostname("https://Example.COM/path") === "example.com");
check("accepts subdomain", normalizeHostname("app.my-site.io") === "app.my-site.io");
check("rejects bare word", normalizeHostname("nodots") === null);
check("rejects vercel.app", normalizeHostname("foo.vercel.app") === null);
check("rejects garbage", normalizeHostname("bad_host!.com") === null);

console.log(failed === 0 ? "\nAll smoke checks passed" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
