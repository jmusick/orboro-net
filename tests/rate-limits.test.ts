import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RATE_LIMITS, clearRateLimit, hitRateLimit, hitRateLimits, pruneRateLimits } from '../src/lib/rate-limits.ts';
import { verifyTurnstile } from '../src/lib/turnstile.ts';
import { makeMigratedDb } from './helpers/d1.ts';

const T0 = 1_800_000_000_000;

test('a budget allows its limit per window, then refuses with Retry-After', async () => {
  const { db, one } = makeMigratedDb();
  const { limit, windowMs } = RATE_LIMITS.registerIp;
  for (let i = 0; i < limit; i++) assert.deepEqual(await hitRateLimit(db, 'registerIp', '203.0.113.5', T0), { allowed: true });
  const refused = await hitRateLimit(db, 'registerIp', '203.0.113.5', T0 + 1000);
  assert.equal(refused.allowed, false);
  assert.equal(!refused.allowed && refused.retryAfterSeconds, windowMs / 1000 - 1);
  assert.deepEqual(await hitRateLimit(db, 'registerIp', '198.51.100.7', T0), { allowed: true }, 'other clients have their own budget');
  assert.deepEqual(await hitRateLimit(db, 'registerIp', '203.0.113.5', T0 + windowMs), { allowed: true }, 'a new window resets');
  assert.equal(one("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE '%203.0.113.5%'")?.n, 0, 'keys are digests');
});

test('budgets with the same value are kept apart by name', async () => {
  const { db } = makeMigratedDb();
  for (let i = 0; i < RATE_LIMITS.verifyEmail.limit; i++) await hitRateLimit(db, 'verifyEmail', 'm1', T0);
  assert.equal((await hitRateLimit(db, 'verifyEmail', 'm1', T0)).allowed, false);
  assert.equal((await hitRateLimit(db, 'commentMember', 'm1', T0)).allowed, true);
});

test('hitRateLimits stops at the first spent budget; clear and prune work', async () => {
  const { db, one } = makeMigratedDb();
  for (let i = 0; i < RATE_LIMITS.memberLoginIp.limit; i++) await hitRateLimit(db, 'memberLoginIp', 'ip', T0);
  const before = one('SELECT COUNT(*) AS n FROM rate_limits')?.n;
  assert.equal((await hitRateLimits(db, [['memberLoginIp', 'ip'], ['memberLoginAccount', 'alice']], T0)).allowed, false);
  assert.equal(one('SELECT COUNT(*) AS n FROM rate_limits')?.n, before, 'the account budget is not charged once the IP is spent');
  await clearRateLimit(db, 'memberLoginIp', 'ip');
  assert.equal((await hitRateLimit(db, 'memberLoginIp', 'ip', T0)).allowed, true);
  await pruneRateLimits(db, T0 + RATE_LIMITS.memberLoginIp.windowMs);
  assert.equal(one('SELECT COUNT(*) AS n FROM rate_limits')?.n, 0);
});

const siteverify = (body: unknown, status = 200) => {
  const calls: URLSearchParams[] = [];
  const fetchImpl = (async (_url: string, init: { body: URLSearchParams }) => {
    calls.push(init.body);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

test('Turnstile fails closed and checks the action', async () => {
  const pass = siteverify({ success: true, action: 'register' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'register', remoteIp: '1.2.3.4', fetchImpl: pass.fetchImpl }), { ok: true });
  assert.equal(pass.calls[0].get('secret'), 's');
  assert.equal(pass.calls[0].get('response'), 'tok');
  assert.equal(pass.calls[0].get('remoteip'), '1.2.3.4');

  const testKey = siteverify({ success: true, action: '' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'reset', fetchImpl: testKey.fetchImpl }), { ok: true }, 'test keys report no action');
  const wrongAction = siteverify({ success: true, action: 'register' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'reset', fetchImpl: wrongAction.fetchImpl }), { ok: false, reason: 'failed' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'register', fetchImpl: siteverify({ success: false }).fetchImpl }), { ok: false, reason: 'failed' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'register', fetchImpl: siteverify({}, 500).fetchImpl }), { ok: false, reason: 'unavailable' });
  const down = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
  assert.deepEqual(await verifyTurnstile('tok', { secret: 's', action: 'register', fetchImpl: down }), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await verifyTurnstile('tok', { secret: undefined, action: 'register', fetchImpl: pass.fetchImpl }), { ok: false, reason: 'unconfigured' });
  assert.deepEqual(await verifyTurnstile('', { secret: 's', action: 'register', fetchImpl: pass.fetchImpl }), { ok: false, reason: 'missing' });
  assert.deepEqual(await verifyTurnstile('x'.repeat(2049), { secret: 's', action: 'register', fetchImpl: pass.fetchImpl }), { ok: false, reason: 'missing' });
});
