/**
 * Splits a `wrangler d1 export` file into one import file per table.
 *
 *   node scripts/split-d1-export.mjs <export.sql> <out-dir>
 *
 * The October 13, 2026 recovery drill (issue #13) found that importing the
 * whole export into a new remote D1 with `wrangler d1 execute --remote --file`
 * failed with `{"D1_RESET_DO":true}` (Wrangler 4.148.0), while each table's
 * section imported cleanly. Import the files in name order. Each one starts
 * with `PRAGMA defer_foreign_keys=TRUE` like the export does. The export's
 * `sqlite_sequence` lines are dropped; SQLite rebuilds the AUTOINCREMENT
 * counter from the highest existing ID on the next insert.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("Usage: node scripts/split-d1-export.mjs <export.sql> <out-dir>");
  process.exit(1);
}

const sections = [];
for (const line of readFileSync(input, "utf8").split(/\r?\n/)) {
  if (/^DELETE FROM sqlite_sequence;$|^INSERT INTO "sqlite_sequence"/.test(line)) continue;
  const table = line.match(/^CREATE TABLE (?:IF NOT EXISTS )?"?([A-Za-z0-9_]+)/)?.[1];
  if (table) sections.push({ table, lines: [] });
  // Lines before the first CREATE TABLE (the PRAGMA) are re-added per file.
  sections.at(-1)?.lines.push(line);
}
if (sections.length === 0) {
  console.error(`No CREATE TABLE statements found in ${input}.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
sections.forEach(({ table, lines }, i) => {
  const file = join(outDir, `${String(i + 1).padStart(2, "0")}-${table}.sql`);
  writeFileSync(file, `PRAGMA defer_foreign_keys=TRUE;\n${lines.join("\n").trimEnd()}\n`);
  console.log(file);
});
