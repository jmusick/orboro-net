import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// Source checks deliberately cover design invariants, not arbitrary CSS formatting.
const rules = [
  ["List transition properties explicitly", /transition\s*:\s*all\b/],
  ["Use the current accent token for tints", /rgba?\(\s*(?:0\s*,\s*229\s*,\s*255|112\s+208\s+255)\b/],
  ["Use one of the shared radius tokens", /border-radius\s*:\s*(?:4|6|8|10|12|16)px\b/],
  ["Remove hover lift", /[^{}]*:hover[^{}]*\{[^{}]*transform\s*:\s*translateY\(/],
  ["Keep hover feedback to color and borders", /[^{}]*:hover[^{}]*\{[^{}]*box-shadow\s*:/],
  ["Remove empty transitions", /transition\s*:\s*;/],
  ["Use the imported monospace fallback", /font-family\s*:\s*["']JetBrains Mono/],
];
let failures = 0;
async function checkFile(path) {
    const source = await readFile(path, "utf8");
    for (const [message, pattern] of rules) {
      for (const match of source.matchAll(new RegExp(pattern, "g"))) {
        const line = source.slice(0, match.index).split("\n").length;
        console.error(`${relative(process.cwd(), path)}:${line}: ${message}`);
        failures++;
      }
    }
    if (!path.endsWith("tokens.css") && /--(?:bg|surface|accent|r-md)\s*:\s*(?:#|\d)/.test(source)) {
      console.error(`${relative(process.cwd(), path)}: Define design tokens in src/styles/tokens.css`);
      failures++;
    }
}
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await check(path); continue; }
    if (!/\.(?:astro|css|ts|js)$/.test(path)) continue;
    await checkFile(path);
  }
}
await check("src");
if (failures) process.exitCode = 1;
else console.log("Design style checks passed.");
