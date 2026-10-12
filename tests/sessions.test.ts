import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { AstroCookies } from '../node_modules/astro/dist/core/cookies/index.js';
import {
  LOCAL_SESSION_COOKIE, SECURE_SESSION_COOKIE, SESSION_DURATION_MS,
  createSessionRecord, findSession, generateSessionToken, hashSessionToken, isWellFormedSessionToken,
  pruneSessions, revokeSession, revokeUserSessions,
} from '../src/lib/sessions.ts';
import {
  clearSessionCookies, hasSessionCookie, readSessionCookie, setSessionCookie,
} from '../src/lib/session-cookie.ts';
import { buildResetPasswordSql, buildRevokeSql } from '../scripts/lib/session-sql.mjs';

// A D1 stand-in over node:sqlite with the schema from migrations/0001_initial.sql.
function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO users VALUES ('u1', 'jd@example.com', 'old-hash', 'admin', 0), ('u2', 'o''brien@example.com', 'other-hash', 'editor', 0);
  `);
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async <T>() => (sqlite.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
        run: async () => sqlite.prepare(sql).run(...(values as never[])),
      }),
    }),
  };
  const count = (where = '1') => (sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${where}`).get() as { n: number }).n;
  return { db, sqlite, count };
}

const T0 = 1_800_000_000_000;

test('tokens are 256-bit base64url values and only their SHA-256 digest is stored', async () => {
  const token = generateSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
  assert.notEqual(generateSessionToken(), token);

  const { db, sqlite } = makeDb();
  const session = await createSessionRecord(db, 'u1', T0);
  assert.equal(session.expiresAt, T0 + SESSION_DURATION_MS);
  const rows = sqlite.prepare('SELECT id FROM sessions').all() as { id: string }[];
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id, session.token);
  assert.equal(rows[0].id, await hashSessionToken(session.token));
  assert.match(rows[0].id, /^[0-9a-f]{64}$/);

  const found = await findSession(db, session.token, T0 + 1);
  assert.deepEqual(found, { sessionId: rows[0].id, userId: 'u1', expiresAt: session.expiresAt, email: 'jd@example.com', role: 'admin' });
});

test('legacy raw-UUID sessions and stored digests are rejected', async () => {
  const { db, sqlite } = makeDb();
  const legacy = '0b7c2c6e-3f43-4a52-9a4e-6b8f0e5d1c2a';
  sqlite.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(legacy, 'u1', T0 + SESSION_DURATION_MS, T0);
  assert.equal(isWellFormedSessionToken(legacy), false);
  assert.equal(await findSession(db, legacy, T0 + 1), null);

  // A leaked copy of the sessions table yields digests, which are not cookies.
  const { token } = await createSessionRecord(db, 'u1', T0);
  const digest = await hashSessionToken(token);
  assert.equal(await findSession(db, digest, T0 + 1), null);
  assert.equal(await findSession(db, '', T0 + 1), null);
  assert.equal(await findSession(db, `${token}x`, T0 + 1), null);
});

test('sessions expire at the absolute lifetime regardless of activity', async () => {
  const { db } = makeDb();
  const { token, expiresAt } = await createSessionRecord(db, 'u1', T0);
  assert.ok(await findSession(db, token, T0 + 1000));
  assert.ok(await findSession(db, token, expiresAt - 1));
  assert.equal(await findSession(db, token, expiresAt), null);
  assert.equal(await findSession(db, token, expiresAt + 1), null);
});

test('logout revokes only the presented session', async () => {
  const { db } = makeDb();
  const a = await createSessionRecord(db, 'u1', T0);
  const b = await createSessionRecord(db, 'u1', T0);
  await revokeSession(db, a.token);
  assert.equal(await findSession(db, a.token, T0 + 1), null);
  assert.ok(await findSession(db, b.token, T0 + 1));
  await revokeSession(db, 'not-a-token');
  assert.ok(await findSession(db, b.token, T0 + 1));
});

test('revoke-all ends every session for one user and leaves other users alone', async () => {
  const { db } = makeDb();
  const mine = [await createSessionRecord(db, 'u1', T0), await createSessionRecord(db, 'u1', T0)];
  const theirs = await createSessionRecord(db, 'u2', T0);
  await revokeUserSessions(db, 'u1');
  for (const s of mine) assert.equal(await findSession(db, s.token, T0 + 1), null);
  assert.ok(await findSession(db, theirs.token, T0 + 1));
});

test('pruning drops expired and legacy rows and keeps live sessions', async () => {
  const { db, sqlite, count } = makeDb();
  const live = await createSessionRecord(db, 'u1', T0);
  await createSessionRecord(db, 'u1', T0 - SESSION_DURATION_MS - 1);
  sqlite.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('0b7c2c6e-3f43-4a52-9a4e-6b8f0e5d1c2a', 'u1', T0 + SESSION_DURATION_MS, T0);
  assert.equal(count(), 3);
  await pruneSessions(db, T0);
  assert.equal(count(), 1);
  assert.ok(await findSession(db, live.token, T0 + 1));
});

function cookiesFor(url: string, cookie?: string) {
  const request = new Request(url, cookie ? { headers: { cookie } } : undefined);
  return { cookies: new AstroCookies(request, { warn() {} } as never), url: new URL(url) };
}

test('production sets a __Host- cookie: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain', () => {
  const { cookies, url } = cookiesFor('https://orboro.net/api/auth/login');
  setSessionCookie(cookies, url, 'tok', T0 + SESSION_DURATION_MS);
  const headers = [...cookies.headers()];
  assert.equal(headers.length, 1);
  const header = headers[0];
  assert.ok(header.startsWith(`${SECURE_SESSION_COOKIE}=tok;`), header);
  assert.match(header, /; Secure/i);
  assert.match(header, /; HttpOnly/i);
  assert.match(header, /; SameSite=Lax/i);
  assert.match(header, /; Path=\//i);
  assert.match(header, /; Expires=/i);
  assert.doesNotMatch(header, /Domain=/i);
});

test('local HTTP development keeps the unprefixed, non-Secure cookie', () => {
  const { cookies, url } = cookiesFor('http://127.0.0.1:8787/api/auth/login');
  setSessionCookie(cookies, url, 'tok', T0 + SESSION_DURATION_MS);
  const [header] = [...cookies.headers()];
  assert.ok(header.startsWith(`${LOCAL_SESSION_COOKIE}=tok;`), header);
  assert.doesNotMatch(header, /Secure/i);
  assert.match(header, /; HttpOnly/i);
  assert.match(header, /; SameSite=Lax/i);
  assert.match(header, /; Path=\//i);
});

test('over HTTPS the legacy cookie is not read as a session and is cleared', () => {
  const legacy = cookiesFor('https://orboro.net/admin', `${LOCAL_SESSION_COOKIE}=0b7c2c6e-3f43-4a52-9a4e-6b8f0e5d1c2a`);
  assert.equal(readSessionCookie(legacy.cookies, legacy.url), undefined);
  assert.equal(hasSessionCookie(legacy.cookies, legacy.url), true);
  clearSessionCookies(legacy.cookies, legacy.url);
  const headers = [...legacy.cookies.headers()];
  assert.equal(headers.length, 1);
  assert.ok(headers[0].startsWith(`${LOCAL_SESSION_COOKIE}=deleted;`), headers[0]);
  assert.match(headers[0], /Expires=Thu, 01 Jan 1970/i);

  const both = cookiesFor('https://orboro.net/api/auth/login', `${LOCAL_SESSION_COOKIE}=old; ${SECURE_SESSION_COOKIE}=new`);
  assert.equal(readSessionCookie(both.cookies, both.url), 'new');
  setSessionCookie(both.cookies, both.url, 'newer', T0 + SESSION_DURATION_MS);
  const set = [...both.cookies.headers()];
  assert.equal(set.length, 2);
  assert.ok(set.some((h) => h.startsWith(`${LOCAL_SESSION_COOKIE}=deleted;`)));
  assert.ok(set.some((h) => h.startsWith(`${SECURE_SESSION_COOKIE}=newer;`)));
});

test('logout clears the __Host- cookie with the attributes the prefix requires', () => {
  const { cookies, url } = cookiesFor('https://orboro.net/api/auth/logout', `${SECURE_SESSION_COOKIE}=tok`);
  assert.equal(readSessionCookie(cookies, url), 'tok');
  clearSessionCookies(cookies, url);
  const [header] = [...cookies.headers()];
  assert.ok(header.startsWith(`${SECURE_SESSION_COOKIE}=deleted;`), header);
  assert.match(header, /; Secure/i);
  assert.match(header, /; Path=\//i);
  assert.match(header, /Expires=Thu, 01 Jan 1970/i);

  const none = cookiesFor('https://orboro.net/');
  assert.equal(hasSessionCookie(none.cookies, none.url), false);
  clearSessionCookies(none.cookies, none.url);
  assert.equal([...none.cookies.headers()].length, 0);
});

test('operator scripts revoke one account or all, and reset-password revokes too', async () => {
  const { db, sqlite, count } = makeDb();
  for (const user of ['u1', 'u1', 'u2']) await createSessionRecord(db, user, T0);

  sqlite.exec(buildRevokeSql({ email: 'jd@example.com', all: false }));
  assert.equal(count("user_id = 'u1'"), 0);
  assert.equal(count("user_id = 'u2'"), 1);

  await createSessionRecord(db, 'u2', T0);
  sqlite.exec(buildResetPasswordSql({ email: "o'brien@example.com", passwordHash: "new'hash" }));
  assert.equal(count(), 0);
  const users = sqlite.prepare('SELECT id, password_hash FROM users ORDER BY id').all() as { id: string; password_hash: string }[];
  assert.deepEqual(users.map((u) => u.password_hash), ['old-hash', "new'hash"]);

  for (const user of ['u1', 'u2']) await createSessionRecord(db, user, T0);
  sqlite.exec(buildRevokeSql({ email: '', all: true }));
  assert.equal(count(), 0);
});
