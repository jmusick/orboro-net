import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import {
  MAX_PASSWORD_CODE_POINTS, MIN_PASSWORD_CODE_POINTS, PASSWORD_ITERATIONS,
  hashPassword, parsePasswordHash, passwordNeedsRehash, passwordProblem, verifyDummyPassword, verifyPassword,
} from '../src/lib/passwords.js';
import { MAX_PASSWORD_LENGTH } from '../src/lib/login-throttle.ts';
import { SKIP_BREACH_CHECK, newPasswordProblem } from '../scripts/lib/new-password.mjs';
import { pwnedCount } from '../scripts/lib/pwned-passwords.mjs';

const GOOD = 'correct horse battery staple';

// A hash in the format the old inline Worker and script code wrote.
function legacyHash(password: string, salt = Buffer.alloc(16, 7)) {
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return `pbkdf2$100000$${salt.toString('base64')}$${hash.toString('base64')}`;
}

test('new hashes use the stored format and verify', async () => {
  const stored = await hashPassword(GOOD);
  assert.match(stored, /^pbkdf2\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
  assert.equal(await verifyPassword(GOOD, stored), true);
  assert.equal(await verifyPassword(`${GOOD}!`, stored), false);
  assert.notEqual(await hashPassword(GOOD), stored, 'each hash gets a fresh salt');
});

test('hashes written before this module still verify', async () => {
  const stored = legacyHash(GOOD);
  assert.equal(await verifyPassword(GOOD, stored), true);
  assert.equal(await verifyPassword('wrong password entirely', stored), false);
  assert.equal(passwordNeedsRehash(stored), false);
});

test('stored hashes are parsed strictly', async () => {
  const stored = legacyHash(GOOD);
  const [, , salt, hash] = stored.split('$');
  assert.ok(parsePasswordHash(stored));
  const rejected = [
    undefined, null, '', 'old-hash',
    stored.replace('pbkdf2$', 'argon2$'),
    stored.replace('$100000$', '$99999$'),
    stored.replace('$100000$', '$100001$'),
    stored.replace('$100000$', '$0100000$'),
    stored.replace('$100000$', '$1e5$'),
    `${stored}$extra`,
    stored.replace(salt, salt.slice(0, -2)),
    stored.replace(hash, `${hash.slice(0, -1)}`),
    stored.replace(hash, `A${hash}`),
    stored.replace(salt, `${salt.slice(0, 21)}x==`), // same bytes, non-canonical padding bits
    stored.replace(salt, `${salt.slice(0, 21)}*==`),
    ` ${stored}`,
    `${stored}\n`,
  ];
  for (const value of rejected) {
    assert.equal(parsePasswordHash(value), null, String(value));
    assert.equal(await verifyPassword(GOOD, value as string), false, String(value));
  }
});

test('a verified hash below the target work factor is flagged for rehash', () => {
  const stored = legacyHash(GOOD);
  assert.equal(passwordNeedsRehash(stored, PASSWORD_ITERATIONS), false);
  assert.equal(passwordNeedsRehash(stored, 600_000), true);
  assert.equal(passwordNeedsRehash('malformed', 600_000), false);
});

test('hashing refuses invalid input instead of transforming it', async () => {
  await assert.rejects(hashPassword('lone \uD800 surrogate here'), TypeError);
  await assert.rejects(hashPassword(GOOD, 99_999), RangeError);
  await assert.rejects(hashPassword(GOOD, 600_000), RangeError);
});

test('Unicode passwords are hashed exactly, without normalization', async () => {
  const nfc = 'café au lait, s’il vous plaît \u{1F375}';
  const nfd = nfc.normalize('NFD');
  const stored = await hashPassword(nfc);
  assert.equal(await verifyPassword(nfc, stored), true);
  assert.equal(await verifyPassword(nfd, stored), false);
});

test('the longest allowed password fits the login form limit and verifies', async () => {
  const longest = '\u{1F511}'.repeat(MAX_PASSWORD_CODE_POINTS - 1) + 'x';
  assert.ok(longest.length <= MAX_PASSWORD_LENGTH, 'login must accept every password the rules allow');
  assert.equal(passwordProblem(longest), null);
  const stored = await hashPassword(longest);
  assert.equal(await verifyPassword(longest, stored), true);
  assert.equal(await verifyPassword(longest.slice(0, -1), stored), false, 'no truncation');
});

test('the dummy verifier always fails', async () => {
  assert.equal(await verifyDummyPassword(GOOD), false);
});

test('password rules count code points and reject weak shapes', () => {
  assert.equal(MIN_PASSWORD_CODE_POINTS, 15);
  assert.ok(MAX_PASSWORD_CODE_POINTS >= 64);
  assert.equal(passwordProblem('a'.repeat(5) + 'b'.repeat(9)), 'Password must be at least 15 characters.');
  assert.equal(passwordProblem('abcdefghijklmno'), null);
  assert.equal(passwordProblem('\u{1F600}\u{1F601}'.repeat(7)), 'Password must be at least 15 characters.', '14 emoji are 28 UTF-16 units');
  assert.equal(passwordProblem('\u{1F600}\u{1F601}'.repeat(7) + '\u{1F602}'), null);
  assert.equal(passwordProblem('ab'.repeat(64) + 'c'), `Password must be at most ${MAX_PASSWORD_CODE_POINTS} characters.`);
  assert.equal(passwordProblem('ab'.repeat(64)), null);
  assert.match(passwordProblem('abcdefghijklmn\uDC00') ?? '', /unpaired surrogate/);
  assert.equal(passwordProblem('x'.repeat(20)), 'Password must not be one repeated character.');
  assert.equal(passwordProblem('  leading spaces count'), null);
  assert.equal(passwordProblem('   abcdefghijk'), 'Password must be at least 15 characters.', 'no trimming');
  assert.match(passwordProblem('my Orboro password!!') ?? '', /site name/);
  assert.match(passwordProblem('jdmusick-is-the-best', { email: 'JDMusick@example.com' }) ?? '', /email name/);
  assert.equal(passwordProblem('jd and a long phrase', { email: 'jd@example.com' }), null, 'short local parts are not checked');
  assert.equal(passwordProblem(undefined), 'Password is required.');
});

test('provisioning screens against breaches and fails closed', async () => {
  const email = 'admin@example.com';
  let calls = 0;
  const lookup = (count: number | Error) => async () => {
    calls += 1;
    if (count instanceof Error) throw count;
    return count;
  };

  assert.match(await newPasswordProblem({ email, password: 'short', argv: [], lookup: lookup(0) }) ?? '', /at least 15/);
  assert.equal(calls, 0, 'rules run before the network');

  assert.equal(await newPasswordProblem({ email, password: GOOD, argv: [], lookup: lookup(0) }), null);
  assert.match(await newPasswordProblem({ email, password: GOOD, argv: [], lookup: lookup(1234) }) ?? '', /1,234 known breaches/);
  const offline = await newPasswordProblem({ email, password: GOOD, argv: [], lookup: lookup(new Error('timeout')) });
  assert.match(offline ?? '', /Couldn't screen.*timeout.*--skip-breach-check/);

  calls = 0;
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await newPasswordProblem({ email, password: GOOD, argv: [SKIP_BREACH_CHECK], lookup: lookup(9) }), null);
  } finally {
    console.warn = warn;
  }
  assert.equal(calls, 0);
  assert.match(await newPasswordProblem({ email, password: 'short', argv: [SKIP_BREACH_CHECK], lookup: lookup(0) }) ?? '', /at least 15/,
    'skipping the breach check never skips the rules');
});

test('the breach lookup sends only a five-character hash prefix', async () => {
  const digest = createHash('sha1').update(GOOD, 'utf8').digest('hex').toUpperCase();
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const respond = (body: string, status = 200) => (async (url: string, init: { headers: Record<string, string> }) => {
    requests.push({ url, headers: init.headers });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  const padding = 'ABCDEF0123456789ABCDEF0123456789ABC:0\r\n';

  assert.equal(await pwnedCount(GOOD, { fetchImpl: respond(`${padding}${digest.slice(5)}:42\r\n`) }), 42);
  assert.equal(requests[0].url, `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`);
  assert.equal(requests[0].headers['Add-Padding'], 'true');
  assert.ok(!requests[0].url.includes(digest.slice(5)));

  assert.equal(await pwnedCount(GOOD, { fetchImpl: respond(padding) }), 0);
  assert.equal(await pwnedCount(GOOD, { fetchImpl: respond(`${digest.slice(5)}:0\r\n`) }), 0, 'padding entries count as absent');
  await assert.rejects(pwnedCount(GOOD, { fetchImpl: respond('', 503) }), /HTTP 503/);
  await assert.rejects(pwnedCount(GOOD, { fetchImpl: respond('') }), /empty range/);
  await assert.rejects(pwnedCount(GOOD, { fetchImpl: respond('<html>blocked</html>') }), /unexpected response/);
});
