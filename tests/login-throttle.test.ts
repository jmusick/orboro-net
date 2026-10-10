import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  LOGIN_ACCOUNT_LIMIT, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS,
  clearAccountAttempts, pruneLoginAttempts, reserveLoginAttempt,
} from '../src/lib/login-throttle.ts';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE login_attempts (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL)');
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async <T>() => (sqlite.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
        run: async () => sqlite.prepare(sql).run(...(values as never[])),
      }),
    }),
  };
  return { db, sqlite };
}

const T0 = 1_800_000_000_000;

test('account budget blocks the attempt after the limit, from any IP', async () => {
  const { db } = makeDb();
  for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i += 1) {
    assert.deepEqual(await reserveLoginAttempt(db, `10.0.0.${i}`, 'a@example.com', T0), { allowed: true });
  }
  const blocked = await reserveLoginAttempt(db, '10.9.9.9', 'a@example.com', T0 + 1000);
  assert.equal(blocked.allowed, false);
  assert.ok(!blocked.allowed && blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= LOGIN_WINDOW_MS / 1000);
  assert.deepEqual(await reserveLoginAttempt(db, '10.9.9.9', 'other@example.com', T0), { allowed: true });
});

test('IP budget blocks one client across many accounts without charging accounts', async () => {
  const { db } = makeDb();
  for (let i = 0; i < LOGIN_IP_LIMIT; i += 1) {
    assert.equal((await reserveLoginAttempt(db, '1.2.3.4', `u${i}@example.com`, T0)).allowed, true);
  }
  assert.equal((await reserveLoginAttempt(db, '1.2.3.4', 'victim@example.com', T0)).allowed, false);
  for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i += 1) {
    assert.equal((await reserveLoginAttempt(db, '5.6.7.8', 'victim@example.com', T0)).allowed, true);
  }
});

test('windows expire, success clears the account, pruning removes stale rows', async () => {
  const { db, sqlite } = makeDb();
  for (let i = 0; i <= LOGIN_ACCOUNT_LIMIT; i += 1) await reserveLoginAttempt(db, `ip${i}`, 'a@example.com', T0);
  assert.equal((await reserveLoginAttempt(db, 'fresh', 'a@example.com', T0 + 1)).allowed, false);
  assert.equal((await reserveLoginAttempt(db, 'fresh', 'a@example.com', T0 + LOGIN_WINDOW_MS + 1)).allowed, true);

  await clearAccountAttempts(db, 'a@example.com');
  for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i += 1) {
    assert.equal((await reserveLoginAttempt(db, `again${i}`, 'a@example.com', T0 + LOGIN_WINDOW_MS + 2)).allowed, true);
  }

  await pruneLoginAttempts(db, T0 + 10 * LOGIN_WINDOW_MS);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM login_attempts').get() as { n: number }).n, 0);
});

test('stored keys are digests, not raw emails or addresses', async () => {
  const { db, sqlite } = makeDb();
  await reserveLoginAttempt(db, '203.0.113.7', 'admin@example.com', T0);
  const keys = (sqlite.prepare('SELECT key FROM login_attempts').all() as { key: string }[]).map((r) => r.key);
  assert.equal(keys.length, 2);
  for (const key of keys) assert.match(key, /^[0-9a-f]{64}$/);
});

test('limiter store failures propagate so the caller can refuse', async () => {
  const failing = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 down'); }, run: async () => {} }) }) };
  await assert.rejects(reserveLoginAttempt(failing, '1.1.1.1', 'a@example.com', T0), /D1 down/);
});
