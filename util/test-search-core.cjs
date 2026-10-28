// 运行：node --test util/test-search-core.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const core = require(path.join(__dirname, "..", "static/js/search-core.js"));

const docs = [
  { url: "https://x/posts/", title: "Posts", body: "" },
  { url: "https://x/posts/a/", title: "德语邮件怎么写", body: "德语邮件，尤其是德国大学里的正式邮件。" },
  { url: "https://x/posts/a/", title: "德语邮件怎么写", body: "德语邮件，尤其是德国大学里的正式邮件。" },
  { url: "https://x/posts/b/", title: "Vim Delete Operations", body: "Learn how to delete words in Vim and Neovim." },
  { url: "https://x/posts/c/", title: "Neovim setup", body: "Configure <script>alert(1)</script> safely with Vim keys." },
];

test("matches Chinese substrings without word boundaries", () => {
  assert.deepEqual(core.searchDocs(docs, "大学").map((r) => r.url), ["https://x/posts/a/"]);
});

test("deduplicates entries with the same url", () => {
  assert.equal(core.searchDocs(docs, "德语").length, 1);
});

test("requires every term and ignores case", () => {
  assert.deepEqual(core.searchDocs(docs, "VIM delete").map((r) => r.url), ["https://x/posts/b/"]);
});

test("ranks title hits above body-only hits", () => {
  assert.deepEqual(core.searchDocs(docs, "neovim").map((r) => r.url), [
    "https://x/posts/c/",
    "https://x/posts/b/",
  ]);
});

test("respects the limit", () => {
  assert.equal(core.searchDocs(docs, "vim", 1).length, 1);
});

test("blank query returns nothing", () => {
  assert.deepEqual(core.searchDocs(docs, "   "), []);
});

test("teaser escapes HTML and bolds terms", () => {
  const teaser = core.makeTeaser(docs[4].body, ["vim"]);
  assert.ok(!teaser.includes("<script>"));
  assert.ok(teaser.includes("&lt;script&gt;"));
  assert.ok(teaser.includes("<b>Vim</b>"));
});

test("teaser centres on the first hit and marks truncation", () => {
  const body = "a".repeat(200) + "目标" + "b".repeat(200);
  const teaser = core.makeTeaser(body, ["目标"]);
  assert.ok(teaser.startsWith("…"));
  assert.ok(teaser.endsWith("…"));
  assert.ok(teaser.includes("<b>目标</b>"));
  assert.ok(teaser.length < 200);
});

test("formatResult escapes title and url", () => {
  const html = core.formatResult({ url: 'https://x/"a"', title: "<i>T</i>", body: "" }, []);
  assert.ok(html.includes("&lt;i&gt;T&lt;/i&gt;"));
  assert.ok(html.includes('href="https://x/&quot;a&quot;"'));
});

// Zola 的 fuse_json 正文保留 HTML 实体（&amp; &lt; &gt; 等），匹配和显示前要先解码
const entityDocs = [
  { url: "https://x/posts/d/", title: "Desktop & Dock", body: "Hide Desktop &amp; Dock icons; use &lt;br&gt; and &#x27;quotes&#39;." },
  { url: "https://x/posts/e/", title: "Other", body: "plain text about lamps" },
];

test("decodes entities in the body before escaping the teaser", () => {
  const [result] = core.searchDocs(entityDocs, "desktop");
  const teaser = core.makeTeaser(result.body, ["desktop"]);
  assert.ok(teaser.includes("<b>Desktop</b> &amp; Dock"));
  assert.ok(!teaser.includes("&amp;amp;"));
  assert.ok(teaser.includes("&lt;br&gt;"));
  assert.ok(teaser.includes("&#39;quotes&#39;"));
});

test("matches decoded characters, not entity names", () => {
  assert.deepEqual(core.searchDocs(entityDocs, "<br>").map((r) => r.url), ["https://x/posts/d/"]);
  assert.deepEqual(core.searchDocs(entityDocs, "&").map((r) => r.url), ["https://x/posts/d/"]);
  assert.deepEqual(core.searchDocs(entityDocs, "amp").map((r) => r.url), ["https://x/posts/e/"]);
});

test("leaves unknown or out-of-range entities untouched", () => {
  assert.equal(core.decodeEntities("&bogus; &#99999999; &#x41;"), "&bogus; &#99999999; A");
});
