import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { requireAdmin } from '../src/lib/http.ts';
import {
  SECURITY_EVENTS, adminActionEvent, buildSecurityRecord, logSecurityEvent,
  type SecurityEventFields, type SecurityLogRecord,
} from '../src/lib/security-events.ts';

// Values that must never appear in a security log line, whatever field or
// header they arrive in.
const CANARIES = {
  email: 'jd-canary@example.com',
  password: 'correct horse battery canary',
  token: 'tok_c4n4ryc4n4ryc4n4ryc4n4ryc4n4ryc4n4ry',
  ip: '203.0.113.77',
  query: 'q-canary-query',
};

function canaryRequest(path = '/api/auth/login'): Request {
  const request = new Request(`https://orboro.net${path}?next=${CANARIES.query}&password=${encodeURIComponent(CANARIES.password)}`, {
    method: 'POST',
    headers: {
      cookie: `__Host-orboro_session=${CANARIES.token}`,
      'cf-connecting-ip': CANARIES.ip,
      'cf-ray': '8f1e2d3c4b5a6978-ORD',
      'user-agent': `Mozilla/5.0 ${CANARIES.email}`,
    },
  });
  Object.defineProperty(request, 'cf', { value: { country: 'US', asn: 13335, city: 'Chicago', clientTcpRtt: 5 } });
  return request;
}

function assertNoCanary(record: SecurityLogRecord) {
  const text = JSON.stringify(record);
  for (const [name, value] of Object.entries(CANARIES)) {
    assert.ok(!text.includes(value), `${name} leaked into ${text}`);
  }
}

test('only allowlisted fields with valid values are emitted', () => {
  const fields = {
    user: 'u-123',
    reason: 'credentials',
    account: 'known',
    email: CANARIES.email,
    password: CANARIES.password,
    token: CANARIES.token,
    body: `email=${CANARIES.email}`,
  } as unknown as SecurityEventFields;
  const record = buildSecurityRecord('auth.login.failed', fields, canaryRequest());
  assert.deepEqual(record, {
    security_event: 'auth.login.failed',
    method: 'POST',
    path: '/api/auth/login',
    ray: '8f1e2d3c4b5a6978-ORD',
    country: 'US',
    asn: 13335,
    user: 'u-123',
    reason: 'credentials',
    account: 'known',
    dropped: 4,
  });
  assertNoCanary(record);
});

test('allowlisted fields still reject values that could carry secrets', () => {
  const record = buildSecurityRecord('admin.action', {
    user: CANARIES.email,
    target: CANARIES.password,
    reason: CANARIES.token,
    action: `content.${CANARIES.email}`,
    outcome: 'maybe' as never,
    status: 99_999,
  });
  assert.deepEqual(record, { security_event: 'admin.action', dropped: 6 });
});

test('request context keeps the path only and none of the headers or client IP', () => {
  const record = buildSecurityRecord('authz.denied', {}, canaryRequest('/admin/content'));
  assert.equal(record.path, '/admin/content');
  assert.equal('ip' in record || 'city' in record || 'cookie' in record, false);
  assertNoCanary(record);

  const odd = buildSecurityRecord('authz.denied', {}, canaryRequest(`/admin/${encodeURIComponent(CANARIES.email)}`));
  assert.equal(odd.path, 'other');
  assertNoCanary(odd);
});

test('an unknown event name is not emitted verbatim', () => {
  assert.equal(buildSecurityRecord(CANARIES.email as never, {}).security_event, 'invalid');
});

test('failures and denials log at warn level, successes at info', () => {
  const seen: Array<[string, SecurityLogRecord]> = [];
  const sink = (level: 'info' | 'warn', record: SecurityLogRecord) => { seen.push([level, record]); };
  logSecurityEvent('auth.login.failed', { reason: 'credentials' }, undefined, sink);
  logSecurityEvent('authz.denied', { reason: 'forbidden' }, undefined, sink);
  logSecurityEvent('auth.login.succeeded', { user: 'u1' }, undefined, sink);
  logSecurityEvent('admin.action', { action: 'content.save', outcome: 'ok' }, undefined, sink);
  assert.deepEqual(seen.map(([level, r]) => `${level} ${r.security_event}`), [
    'warn auth.login.failed', 'warn authz.denied', 'info auth.login.succeeded', 'info admin.action',
  ]);
});

test('a failing sink never throws into the request', () => {
  assert.doesNotThrow(() => logSecurityEvent('auth.login.failed', {}, undefined, () => { throw new Error('sink down'); }));
});

test('every event name is a short dotted code', () => {
  for (const name of SECURITY_EVENTS) assert.match(name, /^[a-z]+(\.[a-z-]+)+$/);
});

const admin: UserRecord = { id: 'u-admin', email: CANARIES.email, role: 'admin' };
const editor: UserRecord = { id: 'u-editor', email: CANARIES.email, role: 'editor' };
const redirect = (location: string, status = 302) => new Response(null, { status, headers: { Location: location } });

test('admin.action records the outcome of every admin POST', () => {
  assert.deepEqual(adminActionEvent('POST', '/api/content/save', admin, redirect('/admin/content/c1?saved=1'), 'c1'), {
    action: 'content.save', user: 'u-admin', target: 'c1', outcome: 'ok', reason: undefined, status: 302,
  });
  assert.deepEqual(adminActionEvent('POST', '/api/content/save', admin, redirect('/admin/content/new?error=homepage')), {
    action: 'content.save', user: 'u-admin', target: undefined, outcome: 'rejected', reason: 'homepage', status: 302,
  });
  assert.equal(adminActionEvent('POST', '/api/nav/save', admin, new Response('x', { status: 413 }))?.outcome, 'rejected');
  assert.equal(adminActionEvent('POST', '/api/media/upload', admin, new Response('x', { status: 500 }))?.outcome, 'error');
  assert.deepEqual(adminActionEvent('POST', '/api/media/delete', admin, null, 'm1'), {
    action: 'media.delete', user: 'u-admin', target: 'm1', outcome: 'error', status: 500,
  });
});

test('admin.action skips login, reads, anonymous requests and refused non-admins', () => {
  assert.equal(adminActionEvent('POST', '/api/auth/login', admin, redirect('/admin')), null);
  assert.equal(adminActionEvent('GET', '/api/posts/by-category/wow', admin, new Response('{}')), null);
  assert.equal(adminActionEvent('GET', '/admin/content', admin, new Response('')), null);
  assert.equal(adminActionEvent('POST', '/api/content/delete', null, redirect('/admin')), null);
  assert.equal(adminActionEvent('POST', '/api/content/delete', editor, redirect('/admin?error=forbidden')), null);
  // Any signed-in role may end its own sessions, so those are still recorded.
  assert.equal(adminActionEvent('POST', '/api/auth/revoke-all', editor, redirect('/admin?signedout=all'))?.action, 'auth.revoke-all');
  assert.equal(adminActionEvent('POST', '/api/auth/logout', editor, redirect('/admin'))?.action, 'auth.logout');
});

test('the access guards log each denial without the user email', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const guard = (user: UserRecord | null) => requireAdmin({
    locals: { user } as App.Locals,
    redirect,
    request: canaryRequest('/api/content/delete'),
  });
  assert.ok(guard(null) instanceof Response);
  assert.ok(guard(editor) instanceof Response);
  assert.equal(guard(admin), admin);
  const records = warn.mock.calls.map((call) => call.arguments[0] as SecurityLogRecord);
  assert.deepEqual(records.map((r) => [r.security_event, r.reason, r.user]), [
    ['authz.denied', 'signed-out', undefined],
    ['authz.denied', 'forbidden', 'u-editor'],
  ]);
  records.forEach(assertNoCanary);
});

test('login and middleware emit their events', () => {
  const login = readFileSync('src/pages/api/auth/login.ts', 'utf8');
  for (const name of ['auth.login.succeeded', 'auth.login.failed', 'auth.login.throttled', 'auth.login.unavailable']) {
    assert.ok(login.includes(`"${name}"`), `login.ts must log ${name}`);
  }
  assert.doesNotMatch(login, /logSecurityEvent\([^)]*\b(email|password)\b/, 'login must not pass the email or password');
  const middleware = readFileSync('src/middleware.ts', 'utf8');
  assert.match(middleware, /adminActionEvent\(/);
  assert.match(middleware, /"auth\.session\.rejected"/);
});
