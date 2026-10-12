#!/usr/bin/env node
// Lockfile integrity gate. `npm ci` already fails when package.json and package-lock.json disagree;
// this adds checks npm does not make on its own:
//
//   - the lockfile is the npm v3 format this project's npm versions all read
//   - every installed package resolves to the public npm registry over HTTPS (no git, file, http or
//     alternate-registry sources), with a sha512 integrity hash, and the tarball URL actually names
//     that package and version
//   - every non-optional dependency that runs install scripts is listed in package.json
//     "allowScripts", so a new native or lifecycle script is a reviewed change, not a surprise
//
// Run it with `npm run check:lockfile`. Exit code is non-zero on any problem.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REGISTRY = 'https://registry.npmjs.org/';

function packageName(path) {
  // "node_modules/@scope/name" or "node_modules/a/node_modules/name" -> the last package segment
  const marker = 'node_modules/';
  return path.slice(path.lastIndexOf(marker) + marker.length);
}

export function findProblems(pkg, lock) {
  const problems = [];
  const note = (message) => problems.push(message);

  if (lock.lockfileVersion !== 3) note(`lockfileVersion is ${lock.lockfileVersion}; expected 3`);
  if (lock.name !== pkg.name) note(`lockfile name "${lock.name}" does not match package.json "${pkg.name}"`);
  if (lock.version !== pkg.version) note(`lockfile version "${lock.version}" does not match package.json "${pkg.version}"`);

  const entries = Object.entries(lock.packages ?? {});
  if (entries.length < 2) note('lockfile lists no installed packages');

  const allowScripts = pkg.allowScripts ?? {};
  const covered = (name, version) => Object.hasOwn(allowScripts, `${name}@${version}`) || Object.hasOwn(allowScripts, name);

  for (const [path, entry] of entries) {
    if (path === '') continue; // the project itself
    if (entry.link) {
      note(`${path}: linked package (${entry.resolved}); the lockfile must install from the registry only`);
      continue;
    }
    const name = entry.name ?? packageName(path);
    const label = `${path} (${entry.version})`;

    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY)) {
      note(`${label}: resolved URL is not ${REGISTRY} (${entry.resolved ?? 'missing'})`);
    } else {
      const expected = `${REGISTRY}${name}/-/${name.split('/').pop()}-${entry.version}.tgz`;
      if (entry.resolved !== expected) note(`${label}: tarball URL ${entry.resolved} does not match ${expected}`);
    }
    if (typeof entry.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity)) {
      note(`${label}: missing or non-sha512 integrity hash`);
    }
    if (entry.hasInstallScript && !entry.optional && !covered(name, entry.version)) {
      note(`${label}: runs install scripts but is not listed in package.json "allowScripts" (add "${name}@${entry.version}" after reviewing it)`);
    }
  }

  return problems;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const problems = findProblems(pkg, lock);
  if (problems.length > 0) {
    console.error(`Lockfile check failed (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`Lockfile check passed (${Object.keys(lock.packages).length - 1} packages, registry-only, sha512 integrity).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
