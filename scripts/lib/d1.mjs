// Shared helpers for operator scripts that run SQL against D1 through Wrangler.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** SQL string literal. */
export const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * Writes `sql` to a private temp file and runs it with `wrangler d1 execute`.
 * Wrangler applies a file atomically. `target` is "--local" or "--remote".
 */
export function executeD1(target, sql, label) {
  if (target !== "--local" && target !== "--remote") throw new Error(`Unknown D1 target ${target}`);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orboro-d1-")), `${label}.sql`);
  fs.writeFileSync(file, sql, { mode: 0o600 });
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", "DB", target, `--file=${file}`], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    return result.status ?? 1;
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

/** Value following `--name`, or `--name=value`. */
export function argValue(argv, name) {
  const flag = `--${name}`;
  const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}
