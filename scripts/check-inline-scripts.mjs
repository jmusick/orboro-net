import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// Astro inlines small processed <script> blocks into pages as an unnonced
// <script type="module">, which the enforced CSP blocks (issue #36). The build
// manifest lists them under "inlinedScripts"; it must stay empty. Run after
// `npm run build`.
const root = "dist/server";
const marker = '"inlinedScripts":[';
let manifests = 0;
let failures = 0;

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith(".mjs")) {
      const source = await readFile(path, "utf8");
      for (let index = source.indexOf(marker); index !== -1; index = source.indexOf(marker, index + 1)) {
        manifests++;
        const rest = source.slice(index + marker.length);
        if (rest.startsWith("]")) continue;
        const scripts = [...rest.slice(0, rest.search(/\]\]/) + 1).matchAll(/\["([^"]+)"/g)].map(match => match[1]);
        for (const script of scripts.length ? scripts : ["(unparsed entry)"]) {
          console.error(`${relative(process.cwd(), path)}: inlined script without a nonce: ${script}`);
          failures++;
        }
      }
    }
  }
}

try {
  await check(root);
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(`${root} not found; run \`npm run build\` first.`);
    process.exit(1);
  }
  throw error;
}
if (manifests === 0) {
  console.error(`No "inlinedScripts" manifest found under ${root}; Astro's build output changed, update this check.`);
  process.exit(1);
}
if (failures) {
  console.error("Keep processed scripts external (see vite.build.assetsInlineLimit in astro.config.mjs).");
  process.exit(1);
}
console.log("No processed scripts are inlined.");
