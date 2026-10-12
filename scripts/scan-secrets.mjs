#!/usr/bin/env node
// Generic secret scan: runs a pinned, checksum-verified gitleaks binary against this repository.
// Works the same on Windows, Linux and macOS and needs nothing beyond Node.
//
//   node scripts/scan-secrets.mjs               scan git history and the working tree (default)
//   node scripts/scan-secrets.mjs --history     scan committed history only
//   node scripts/scan-secrets.mjs --tree        scan files on disk only (includes uncommitted work)
//   node scripts/scan-secrets.mjs --self-test   prove the scanner and config still catch a synthetic leak
//   node scripts/scan-secrets.mjs --dir <path>  scan an arbitrary directory with this repo's config
//
// Any scanner finding, scanner error, download failure or checksum mismatch exits non-zero, so a CI
// step running this script fails closed. To bump gitleaks: change VERSION and the checksums below from
// the release's gitleaks_<version>_checksums.txt, review the release notes, then run --self-test.

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '8.30.1';
// SHA-256 of each release archive, copied from the release's checksums file (and matching the digest
// GitHub reports for each asset). A download that does not match is discarded and the scan fails.
const ARCHIVES = {
  'linux-x64': ['gitleaks_8.30.1_linux_x64.tar.gz', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'],
  'linux-arm64': ['gitleaks_8.30.1_linux_arm64.tar.gz', 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080'],
  'darwin-x64': ['gitleaks_8.30.1_darwin_x64.tar.gz', 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'],
  'darwin-arm64': ['gitleaks_8.30.1_darwin_arm64.tar.gz', 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'],
  'win32-x64': ['gitleaks_8.30.1_windows_x64.zip', 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'],
  'win32-arm64': ['gitleaks_8.30.1_windows_arm64.zip', 'b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f'],
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, '.gitleaks.toml');
const cacheDir = join(root, '.tmp', 'gitleaks', `v${VERSION}`);
const isWindows = process.platform === 'win32';
const binaryPath = join(cacheDir, isWindows ? 'gitleaks.exe' : 'gitleaks');

function fail(message, code = 2) {
  console.error(`scan-secrets: ${message}`);
  process.exit(code);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function ensureBinary() {
  const key = `${process.platform}-${process.arch}`;
  const entry = ARCHIVES[key];
  if (!entry) fail(`no pinned gitleaks build for ${key}`);
  const [asset, expected] = entry;

  if (existsSync(binaryPath)) return binaryPath;

  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${asset}`;
  console.log(`Downloading gitleaks v${VERSION} (${asset})`);
  let archive;
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
    if (!response.ok) fail(`download failed: HTTP ${response.status} for ${url}`);
    archive = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    fail(`download failed: ${error.message}`);
  }

  const actual = sha256(archive);
  if (actual !== expected) {
    fail(`checksum mismatch for ${asset}\n  expected ${expected}\n  actual   ${actual}\nThe download was discarded.`);
  }
  console.log(`Checksum verified (sha256 ${actual})`);

  mkdirSync(cacheDir, { recursive: true });
  const archivePath = join(cacheDir, asset);
  writeFileSync(archivePath, archive);
  // Windows ships bsdtar (which reads zip) as System32\tar.exe; Git Bash's GNU tar cannot, so name it.
  const tar = isWindows ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  const extract = spawnSync(tar, ['-xf', archivePath, '-C', cacheDir], { stdio: 'inherit' });
  rmSync(archivePath, { force: true });
  if (extract.status !== 0 || !existsSync(binaryPath)) fail('could not extract the gitleaks archive');
  if (!isWindows) chmodSync(binaryPath, 0o755);
  return binaryPath;
}

function runGitleaks(binary, args) {
  const result = spawnSync(binary, args, { stdio: 'inherit', cwd: root });
  if (result.error) fail(`could not run gitleaks: ${result.error.message}`);
  return result.status ?? 1;
}

const common = ['--config', configPath, '--redact', '--no-banner', '--exit-code', '1', '--max-decode-depth', '2'];

function scanHistory(binary) {
  console.log('Scanning git history');
  return runGitleaks(binary, ['git', ...common, '--verbose', root]);
}

function scanDirectory(binary, directory, label) {
  console.log(`Scanning ${label}`);
  return runGitleaks(binary, ['dir', ...common, '--verbose', directory]);
}

// Positive control: builds a token-shaped value at run time (never stored in the repository, so neither
// this scan nor GitHub push protection sees it), then requires the scanner to flag it and to pass a
// clean directory. It would also fail if a config change made the scanner blind to a whole rule.
function selfTest(binary) {
  const workDir = mkdtempSync(join(tmpdir(), 'orboro-scan-selftest-'));
  const leakDir = join(workDir, 'leak');
  const cleanDir = join(workDir, 'clean');
  mkdirSync(leakDir);
  mkdirSync(cleanDir);
  try {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(36);
    let body = '';
    for (const byte of bytes) body += alphabet[byte % alphabet.length];
    writeFileSync(join(leakDir, 'synthetic-leak.txt'), `token=${'gh' + 'p_'}${body}\n`);
    writeFileSync(join(cleanDir, 'clean.txt'), 'nothing sensitive here\n');

    const report = join(workDir, 'report.json');
    const leakArgs = ['dir', '--config', configPath, '--redact', '--no-banner', '--exit-code', '1', '--report-format', 'json', '--report-path', report, leakDir];
    const leakStatus = spawnSync(binary, leakArgs, { stdio: 'ignore' }).status;
    if (leakStatus !== 1) fail(`self-test failed: a synthetic leak exited ${leakStatus}, expected 1`, 3);
    const findings = JSON.parse(readFileSync(report, 'utf8'));
    if (!Array.isArray(findings) || findings.length === 0) fail('self-test failed: no finding was reported for the synthetic leak', 3);
    console.log(`Self-test: synthetic leak detected (${findings.map((f) => f.RuleID).join(', ')})`);

    const cleanStatus = spawnSync(binary, ['dir', '--config', configPath, '--no-banner', '--exit-code', '1', cleanDir], { stdio: 'ignore' }).status;
    if (cleanStatus !== 0) fail(`self-test failed: a clean directory exited ${cleanStatus}, expected 0`, 3);
    console.log('Self-test: clean directory passes');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  return 0;
}

const args = process.argv.slice(2);
const known = new Set(['--history', '--tree', '--self-test', '--dir']);
const unknown = args.filter((arg, i) => arg.startsWith('--') && !known.has(arg));
if (unknown.length > 0) fail(`unknown option ${unknown[0]}`);

const binary = await ensureBinary();
console.log(`Using ${binary}`);
const version = spawnSync(binary, ['version'], { encoding: 'utf8' });
if (version.status !== 0 || !version.stdout.trim().includes(VERSION)) fail(`unexpected gitleaks version: ${version.stdout?.trim() || 'none'}`);

let status = 0;
if (args.includes('--self-test')) {
  status = selfTest(binary);
} else if (args.includes('--dir')) {
  const target = args[args.indexOf('--dir') + 1];
  if (!target || target.startsWith('--')) fail('--dir needs a path');
  status = scanDirectory(binary, resolve(target), target);
} else {
  const wantsHistory = args.includes('--history') || !args.includes('--tree');
  const wantsTree = args.includes('--tree') || !args.includes('--history');
  // Run both even when the first fails so one run lists every finding.
  if (wantsHistory) status = scanHistory(binary) || status;
  if (wantsTree) status = scanDirectory(binary, root, 'working tree') || status;
}

if (status === 0) console.log('Secret scan passed.');
else console.error('Secret scan FAILED: review the findings above. Rotate any real credential; do not just allowlist it.');
process.exit(status);
