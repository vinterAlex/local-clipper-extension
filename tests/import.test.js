// Unit tests for the import parsers.
//
//   node tests/import.test.js
//
// No dependencies, no chrome APIs — import.js is deliberately pure so it can be
// exercised here before anything touches a real browser profile.

const assert = require("assert");
const path = require("path");
const ClipperImport = require(path.join(__dirname, "..", "import.js"));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok   " + name);
  } catch (err) {
    console.log("  FAIL " + name);
    console.log("       " + err.message);
    process.exitCode = 1;
  }
}

console.log("import.js");

// ── Netscape / Pocket ────────────────────────────────────────────────────
const pocketHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Pocket Export</TITLE>
<H1>Unread</H1>
<DL><p>
    <DT><A HREF="https://example.com/a-long-read" TIME_ADDED="1756000000" TAGS="reading,tech">A long read &amp; its title</A>
    <DT><A HREF="https://blog.example.org/post" TIME_ADDED="1756100000">Another post</A>
    <DT><A HREF="javascript:void(0)">Not a real link</A>
    <DT><A HREF="https://example.com/dup">Duplicate target</A>
    <DT><A HREF="https://example.com/dup/">Duplicate target, trailing slash</A>
</DL><p>`;

test("detects a Pocket/Netscape export", () => {
  assert.strictEqual(ClipperImport.detect(pocketHtml, "ril_export.html"), "netscape");
});

test("parses titles, entities and skips non-http links", () => {
  const items = ClipperImport.parseNetscape(pocketHtml);
  assert.strictEqual(items[0].url, "https://example.com/a-long-read");
  assert.strictEqual(items[0].title, "A long read & its title");
  assert.deepStrictEqual(items[0].tags, ["reading", "tech"]);
  assert.strictEqual(items.length, 4, "javascript: link must be dropped");
});

test("converts TIME_ADDED seconds to an ISO date", () => {
  const items = ClipperImport.parseNetscape(pocketHtml);
  assert.strictEqual(items[0].savedAt, new Date(1756000000 * 1000).toISOString());
});

test("dedupes on normalised url", () => {
  const out = ClipperImport.parse(pocketHtml, "ril_export.html");
  assert.strictEqual(out.items.length, 3, "two /dup variants collapse to one");
});

// ── CSV ──────────────────────────────────────────────────────────────────
test("parses an Instapaper-style CSV", () => {
  const csv = [
    "URL,Title,Selection,Folder,Timestamp",
    "https://example.com/one,\"One, with comma\",,Unread,2026-01-05 10:00:00",
    "https://example.com/two,Two,,Archive,2026-02-05 10:00:00"
  ].join("\n");
  const items = ClipperImport.parseCsv(csv);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, "One, with comma", "quoted commas survive");
  assert.strictEqual(items[0].savedAt, new Date("2026-01-05 10:00:00").toISOString());
});

test("falls back to first column when there is no header", () => {
  const csv = "https://a.example/x\nhttps://b.example/y";
  const items = ClipperImport.parseCsv(csv);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, "https://a.example/x");
});

test("handles a Readwise-style header", () => {
  const csv = [
    "Highlight,Book Title,Document Tags,Highlighted at,URL",
    "some highlight,My Book,tech,2026-03-01T08:00:00Z,https://example.com/rw"
  ].join("\n");
  const items = ClipperImport.parseCsv(csv);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].url, "https://example.com/rw");
  assert.strictEqual(items[0].title, "My Book");
});

// ── JSON ─────────────────────────────────────────────────────────────────
test("parses its own export manifest", () => {
  const manifest = JSON.stringify({
    app: "Local Clipper",
    pages: [
      { url: "https://example.com/j1", title: "J one", savedAt: "2026-01-01T00:00:00.000Z" },
      { url: "not-a-url", title: "skip me" }
    ]
  });
  const items = ClipperImport.parseJson(manifest);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].title, "J one");
});

test("parses a bare array", () => {
  const items = ClipperImport.parseJson('[{"link":"https://x.example/1"}]');
  assert.strictEqual(items[0].url, "https://x.example/1");
});

test("returns empty on malformed JSON", () => {
  assert.deepStrictEqual(ClipperImport.parseJson("{not json"), []);
});

// ── detection ────────────────────────────────────────────────────────────
test("detects by filename when content is ambiguous", () => {
  assert.strictEqual(ClipperImport.detect("a,b,c", "export.csv"), "csv");
  assert.strictEqual(ClipperImport.detect("[]", "x.json"), "json");
});

test("domainOf strips www", () => {
  assert.strictEqual(ClipperImport.domainOf("https://www.example.com/a"), "example.com");
});

console.log("\n" + passed + " passed");
