import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

// Replace only the widget imports made by shortcodes.ts. The parser and registry
// run unchanged, without loading widget data, Cloudflare bindings or ?raw assets.
const shortcodeUrl = new URL("../src/lib/shortcodes.ts", import.meta.url).href;
const exports = [
  "generateExpeditionRumourSheet", "generateAtlasFarmingStrategies", "generateBookmarksList",
  "generatePoe2Featured", "generatePoe2Intro", "generateWowIntro", "generateWowFeatured",
  "generateHiddenLodgeFeature", "generateAssistedCombatAnalysis", "generateMidnightCreatorAccuracyTierList",
  "generateMidnightSheetLink", "generateMidnightTierList", "generateMidnightS2Interrupts", "generateSpellQueueLab",
];
const widgetSource = `async function generate(attrs, nonce) {
  if (attrs.delay) await new Promise(resolve => setTimeout(resolve, Number(attrs.delay)));
  return JSON.stringify({ attrs, nonce });
}\n${exports.map(name => `export const ${name} = generate;`).join("\n")}`;
const widgetUrl = `data:text/javascript,${encodeURIComponent(widgetSource)}`;
const loaderSource = `export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL === ${JSON.stringify(shortcodeUrl)} && specifier.startsWith("./")) {
    return { url: ${JSON.stringify(widgetUrl)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}`;
// Async loader hooks work on the project's minimum supported Node 22.12.
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, import.meta.url);
const { processShortcodes } = await import("../src/lib/shortcodes.ts");

const generated = (attrs: Record<string, string> = {}, nonce?: string) => JSON.stringify({ attrs, nonce });

test("standalone paragraph tokens replace their wrapper and surrounding whitespace", async () => {
  assert.equal(await processShortcodes("<p> \n{{bookmarks}}\t </p>"), generated());
});

test("bare tokens expand while preserving surrounding HTML", async () => {
  assert.equal(await processShortcodes("<div>Before {{bookmarks}} after</div>"), `<div>Before ${generated()} after</div>`);
});

test("attribute quotes decode named and decimal or hexadecimal numeric entities", async () => {
  for (const quote of ["&quot;", "&#34;", "&#00034;", "&#x22;", "&#X0022;"]) {
    assert.equal(await processShortcodes(`<p>{{bookmarks tag=${quote}guide${quote}}}</p>`), generated({ tag: "guide" }), quote);
  }
});

test("ampersands decode within attribute values and multiple attributes reach the generator", async () => {
  assert.equal(
    await processShortcodes('{{bookmarks tag="tips &amp; tricks" exclude_categories=&quot;news,updates&quot; data-label="A &amp; B"}}'),
    generated({ tag: "tips & tricks", exclude_categories: "news,updates", "data-label": "A & B" }),
  );
});

test("unknown tokens and their paragraph wrappers remain unchanged", async () => {
  const html = '<p> {{unknown_widget tag=&quot;guide&quot;}} </p><div>{{unknown_widget}}</div>';
  assert.equal(await processShortcodes(html), html);
});

test("each request delivers its nonce to the generator without retaining the previous nonce", async () => {
  for (const nonce of ["request-one", "request-two", undefined]) {
    assert.equal(await processShortcodes("{{bookmarks}}", nonce), generated({}, nonce));
  }
});

test("multiple tokens retain document order when generators finish in reverse order", async () => {
  assert.equal(
    await processShortcodes('<p>{{bookmarks label="first" delay="20"}}</p><hr>{{wow_intro label="second"}}', "request"),
    `${generated({ label: "first", delay: "20" }, "request")}<hr>${generated({ label: "second" }, "request")}`,
  );
});
