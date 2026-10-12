import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { editorOptions, renderEditorPreview } from "../src/lib/editor-preview.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";

const normal = [
  "# Heading\n\nSome *emphasis*, **strong**, ~~struck~~ and a [link](https://example.com/a?b=1&c=2).",
  "- one\n- two\n\n1. first\n2. second\n\n> quoted\n\n---",
  "| a | b |\n|:--|--:|\n| 1 | 2 |",
  "- [x] done\n- [ ] open",
  "Line one\nline two (one paragraph without a line break, as published)",
  "![Alt](/media/images/example.webp \"Title\")",
];
const code = [
  "Inline `<script>alert(1)</script>` code.",
  "```\n<script>alert(1)</script>\n```",
  "```html\n<script>alert(1)</script>\n<button onclick=\"run()\">Go</button>\n```",
  "```js\nconst message = \"<hello> & goodbye\";\n```",
  "    <div onclick=\"x()\">indented</div>",
];
const about = '<img class="float-left" src="/media/images/about-header.webp" alt="Avatar">';
const shortcode = '{{token attr="value"}}';
const malicious = [
  "<script>alert(1)</script>",
  "<SCRIPT SRC=https://evil.example/x.js></SCRIPT>",
  '<img src="/a.webp" alt="a" onerror="alert(1)" style="x:y">',
  '<img src="https://e.example/x.png" onload=alert(1) alt=a>',
  '<details open ontoggle=alert(1)><summary>s</summary>b</details>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href=" JaVaScRiPt:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  "[bad](javascript:alert(1)) [vb](vbscript:msgbox(1))",
  '<a href="data:text/html,<script>alert(1)</script>">d</a>',
  "![x](data:image/svg+xml;base64,AAAA)",
  '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x">',
  '<svg><script>alert(1)</script></svg><math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<style>body{display:none}</style><p style="color:red">p</p>',
  // Malformed HTML
  "<scr<script>ipt>alert(1)</script>",
  "<img src=x onerror=alert(1)//",
  '<div onclick="alert(1)"<p>unclosed',
  '<img src="/a.webp" alt="a" title="t>"><script>alert(1)',
  "<!-- <script>alert(1)</script> -->",
  "<p>unclosed <b>bold <i>both",
];
const corpus = [...normal, ...code, about, shortcode, ...malicious];

test("the editor preview is byte-for-byte the publishing output", () => {
  for (const input of corpus) {
    assert.equal(renderEditorPreview(input), renderMarkdown(input), input);
  }
});

test("EasyMDE is configured to preview through the publishing renderer only", () => {
  const element = {} as HTMLTextAreaElement;
  const options = editorOptions(element);
  assert.equal(options.element, element);
  assert.equal(typeof options.previewRender, "function");
  // No renderingConfig: EasyMDE's own Marked/hljs/sanitizerFunction path is unused.
  assert.equal(options.renderingConfig, undefined);
  const preview = {} as HTMLElement;
  for (const input of corpus) {
    assert.equal(options.previewRender!(input, preview), renderMarkdown(input), input);
  }
});

test("normal markdown and code samples are preserved", () => {
  const prose = renderEditorPreview(normal.join("\n\n"));
  assert.match(prose, /<h1>Heading<\/h1>/);
  assert.match(prose, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2">link<\/a>/);
  assert.match(prose, /<th align="left">a<\/th>/);
  assert.match(prose, /<input checked disabled type="checkbox">/);
  assert.match(prose, /<img src="\/media\/images\/example\.webp" alt="Alt" title="Title">/);
  assert.doesNotMatch(prose, /<br>|target=|style=/);

  for (const sample of code) {
    const html = renderEditorPreview(sample);
    assert.match(html, /<code[^>]*>/, sample);
    assert.doesNotMatch(html, /<script|<button|<div|onclick="/i, sample);
  }
  assert.match(renderEditorPreview(code[1]), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(renderEditorPreview(code[2]), /class="hljs language-html"/);
  assert.match(renderEditorPreview(code[3]), /&lt;hello&gt; &amp; goodbye/);
});

test("supported author markup survives and shortcodes stay as text", () => {
  assert.match(
    renderEditorPreview(about),
    /<img class="float-left" src="\/media\/images\/about-header\.webp" alt="Avatar">/,
  );
  assert.match(renderEditorPreview(shortcode), /\{\{token attr=&quot;value&quot;\}\}/);
});

test("scripts, handlers, unsafe URLs and malformed HTML are neutralized", () => {
  for (const input of malicious) {
    const html = renderEditorPreview(input);
    assert.doesNotMatch(html, /<script|<\/script|<iframe|<object|<embed|<svg|<math|<style/i, input);
    assert.doesNotMatch(html, /<[^>]*\son\w+\s*=/i, input);
    assert.doesNotMatch(html, /<[^>]*\sstyle\s*=/i, input);
    assert.doesNotMatch(html, /(?:href|src)="\s*(?:javascript|vbscript|data):/i, input);
  }
  assert.match(renderEditorPreview(malicious[2]), /<img src="\/a\.webp" alt="a">/);
  assert.match(renderEditorPreview('<a href="javascript:alert(1)">x</a>'), /<a href>x<\/a>/);
});

test("the content editors load the bundled editor, not a static copy", async () => {
  const script = await readFile(new URL("../src/scripts/admin-editor.ts", import.meta.url), "utf8");
  assert.match(script, /new EasyMDE\(editorOptions\(markdownEl\)\)/);
  for (const page of ["new.astro", "[id].astro"]) {
    const source = await readFile(new URL(`../src/pages/admin/content/${page}`, import.meta.url), "utf8");
    assert.match(source, /import "\.\.\/\.\.\/\.\.\/scripts\/admin-editor\.ts";/, page);
    assert.doesNotMatch(source, /\/admin-editor\.js/, page);
  }
});
