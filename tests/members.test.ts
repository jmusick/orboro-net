import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MEMBER_SESSION_DURATION_MS, TOKEN_LIFETIMES_MS,
  adminMemberAction, applyEmailChange, bioProblem, consumeMemberToken, createMember, createMemberSession, deleteMember,
  displayNameProblem, findMemberForLogin, findMemberSession, getMemberById, getPublicProfile, issueMemberToken, listMembers,
  markEmailVerified, memberPasswordProblem, normalizeEmail, peekMemberToken, revokeMemberSessions, setMemberPassword,
  setMemberStatus, updateMemberProfile, usernameProblem,
} from '../src/lib/members.ts';
import { createSessionRecord, findSession } from '../src/lib/sessions.ts';
import { makeMigratedDb, seedContent } from './helpers/d1.ts';

const T0 = 1_800_000_000_000;
let ids = 0;
const newId = () => `m${++ids}`;

async function memberDb() {
  const harness = makeMigratedDb();
  seedContent(harness.sqlite);
  const a = await createMember(harness.db, { username: 'Alice', email: 'alice@example.com', passwordHash: 'hash-a' }, T0, () => 'ma');
  const b = await createMember(harness.db, { username: 'bob', email: 'bob@example.com', passwordHash: 'hash-b' }, T0, () => 'mb');
  assert.ok(a.ok && b.ok);
  return harness;
}

test('usernames: 3-24 safe characters, reserved names refused', () => {
  for (const ok of ['abc', 'Some_User-1', 'x'.repeat(24)]) assert.equal(usernameProblem(ok), null, ok);
  for (const bad of ['ab', 'x'.repeat(25), 'has space', 'émile', 'a.b', '', 42]) assert.equal(usernameProblem(bad), 'username', String(bad));
  for (const reserved of ['admin', 'Admin', 'Staff', 'orboro_fan', 'Or-boro', 'deleted', 'moderator']) {
    assert.equal(usernameProblem(reserved), 'username-reserved', reserved);
  }
});

test('emails are trimmed and lowercased; implausible ones refused', () => {
  assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
  for (const bad of ['', 'no-at', 'a@b', 'a b@c.d', 'a@b.c\u0000', `${'x'.repeat(250)}@e.co`, null]) assert.equal(normalizeEmail(bad), null, String(bad));
});

test('display names and bios are bounded plain text', () => {
  assert.equal(displayNameProblem(''), null);
  assert.equal(displayNameProblem('Reader of Guides'), null);
  assert.equal(displayNameProblem('x'.repeat(51)), 'display-name');
  assert.equal(displayNameProblem('two\nlines'), 'display-name');
  assert.equal(displayNameProblem('a\u202eb'), 'display-name', 'bidi overrides are refused');
  assert.equal(displayNameProblem(' padded'), 'display-name');
  assert.equal(bioProblem('Line one\nLine two'), null);
  assert.equal(bioProblem('x'.repeat(501)), 'bio');
  assert.equal(bioProblem('bell\u0007'), 'bio');
});

test('member passwords use the shared rules plus the username', () => {
  assert.equal(memberPasswordProblem('correct horse battery staple', { email: 'r@example.com', username: 'reader' }), null);
  assert.match(memberPasswordProblem('short', {}) ?? '', /at least 15/);
  assert.match(memberPasswordProblem('my name is reader, ok!', { username: 'Reader' }) ?? '', /username/);
  assert.match(memberPasswordProblem('orboro is my favourite', {}) ?? '', /site name/);
});

test('usernames are unique ignoring case; a taken email is reported separately', async () => {
  const { db } = await memberDb();
  assert.deepEqual(await createMember(db, { username: 'ALICE', email: 'new@example.com', passwordHash: 'h' }, T0, newId), { ok: false, reason: 'username-taken' });
  assert.deepEqual(await createMember(db, { username: 'carol', email: 'bob@example.com', passwordHash: 'h' }, T0, newId), { ok: false, reason: 'email-taken' });
  const login = await findMemberForLogin(db, 'alice');
  assert.equal(login?.id, 'ma');
  assert.equal((await findMemberForLogin(db, 'ALICE@example.com'))?.id, 'ma');
  assert.equal(login?.emailVerified, false, 'new accounts start unverified');
});

test('member sessions and admin sessions can never stand in for each other', async () => {
  const { db } = await memberDb();
  const memberSession = await createMemberSession(db, 'ma', T0);
  const adminSession = await createSessionRecord(db, 'admin1', T0);
  assert.equal((await findMemberSession(db, memberSession.token, T0 + 1))?.member.id, 'ma');
  assert.equal(await findSession(db, memberSession.token, T0 + 1), null, 'a member token is not an admin session');
  assert.equal(await findMemberSession(db, adminSession.token, T0 + 1), null, 'an admin token is not a member session');
  assert.equal(await findMemberSession(db, memberSession.token, T0 + MEMBER_SESSION_DURATION_MS), null, 'sessions expire');
});

test('suspending signs a member out and blocks session lookups until reinstated', async () => {
  const { db } = await memberDb();
  const session = await createMemberSession(db, 'ma', T0);
  await setMemberStatus(db, 'ma', 'suspended', T0);
  assert.equal(await findMemberSession(db, session.token, T0 + 1), null);
  const again = await createMemberSession(db, 'ma', T0);
  assert.equal(await findMemberSession(db, again.token, T0 + 1), null, 'a suspended account has no live session');
  await setMemberStatus(db, 'ma', 'active', T0);
  assert.equal((await findMemberSession(db, again.token, T0 + 1))?.member.id, 'ma');
});

test('emailed tokens are single-use, purpose-bound, expiring and replaced by newer ones', async () => {
  const { db, one } = await memberDb();
  const first = await issueMemberToken(db, 'ma', 'verify', 'alice@example.com', T0);
  const second = await issueMemberToken(db, 'ma', 'verify', 'alice@example.com', T0);
  assert.equal(await consumeMemberToken(db, first, 'verify', T0), null, 'an older token stops working');
  assert.equal(one('SELECT COUNT(*) AS n FROM member_tokens WHERE id = ?', second)?.n, 0, 'only the digest is stored');
  assert.equal(await consumeMemberToken(db, second, 'reset', T0), null, 'wrong purpose');
  assert.deepEqual(await peekMemberToken(db, second, 'verify', T0), { memberId: 'ma', email: 'alice@example.com' });
  assert.deepEqual(await consumeMemberToken(db, second, 'verify', T0), { memberId: 'ma', email: 'alice@example.com' });
  assert.equal(await consumeMemberToken(db, second, 'verify', T0), null, 'single use');

  const late = await issueMemberToken(db, 'ma', 'reset', 'alice@example.com', T0);
  assert.equal(await peekMemberToken(db, late, 'reset', T0 + TOKEN_LIFETIMES_MS.reset), null);
  assert.equal(await consumeMemberToken(db, late, 'reset', T0 + TOKEN_LIFETIMES_MS.reset), null, 'expired');
  assert.equal(await consumeMemberToken(db, 'not-a-token', 'reset', T0), null);
});

test('verification only marks the address it was sent to', async () => {
  const { db } = await memberDb();
  assert.equal(await markEmailVerified(db, 'ma', 'old@example.com', T0), false);
  assert.equal((await getMemberById(db, 'ma'))?.emailVerified, false);
  assert.equal(await markEmailVerified(db, 'ma', 'alice@example.com', T0), true);
  assert.equal((await getMemberById(db, 'ma'))?.emailVerified, true);
});

test('an email change applies only while the address is free', async () => {
  const { db } = await memberDb();
  assert.equal(await applyEmailChange(db, 'ma', 'bob@example.com', T0), false);
  assert.equal((await getMemberById(db, 'ma'))?.email, 'alice@example.com');
  assert.equal(await applyEmailChange(db, 'ma', 'alice@new.example', T0), true);
  const member = await getMemberById(db, 'ma');
  assert.equal(member?.email, 'alice@new.example');
  assert.equal(member?.emailVerified, true);
});

test('a password change signs out every session and spends reset links', async () => {
  const { db } = await memberDb();
  const session = await createMemberSession(db, 'ma', T0);
  const reset = await issueMemberToken(db, 'ma', 'reset', 'alice@example.com', T0);
  await setMemberPassword(db, 'ma', 'new-hash', T0);
  assert.equal(await findMemberSession(db, session.token, T0 + 1), null);
  assert.equal(await peekMemberToken(db, reset, 'reset', T0), null);
  assert.equal((await findMemberForLogin(db, 'alice'))?.passwordHash, 'new-hash');
});

test('profile updates touch only the given member', async () => {
  const { db } = await memberDb();
  await updateMemberProfile(db, 'ma', { displayName: 'Alice A.', bio: 'Hi' }, T0);
  assert.equal((await getMemberById(db, 'ma'))?.displayName, 'Alice A.');
  assert.equal((await getMemberById(db, 'mb'))?.displayName, '');
});

test('deleting an account erases its comments but keeps the threads', async () => {
  const { db, sqlite, one } = await memberDb();
  sqlite.exec(`
    INSERT INTO comments (id, content_id, member_id, parent_id, depth, body, created_at) VALUES ('c1', 'post1', 'ma', NULL, 0, 'secret text', 1);
    INSERT INTO comments (id, content_id, member_id, parent_id, depth, body, created_at) VALUES ('c2', 'post1', 'mb', 'c1', 1, 'reply', 2);
    INSERT INTO comment_votes VALUES ('c2', 'ma', 1, 3);
  `);
  await createMemberSession(db, 'ma', T0);
  await deleteMember(db, 'ma');
  assert.equal(await getMemberById(db, 'ma'), null);
  assert.deepEqual({ ...one("SELECT member_id, body, status FROM comments WHERE id = 'c1'") }, { member_id: null, body: '', status: 'deleted' });
  assert.equal(one("SELECT COUNT(*) AS n FROM comment_votes WHERE member_id = 'ma'")?.n, 0);
  assert.equal(one("SELECT COUNT(*) AS n FROM member_sessions WHERE member_id = 'ma'")?.n, 0);
  assert.equal(one("SELECT body FROM comments WHERE id = 'c2'")?.body, 'reply');
});

test('public profiles count karma from other members only', async () => {
  const { db, sqlite } = await memberDb();
  sqlite.exec(`
    INSERT INTO comments (id, content_id, member_id, depth, body, created_at) VALUES ('c1', 'post1', 'ma', 0, 'one', 1), ('c2', 'draft1', 'ma', 0, 'draft', 1);
    INSERT INTO comment_votes VALUES ('c1', 'ma', 1, 1), ('c1', 'mb', 1, 1);
  `);
  const profile = await getPublicProfile(db, 'ALICE');
  assert.equal(profile?.username, 'Alice');
  assert.equal(profile?.karma, 1, 'the self-vote is excluded');
  assert.equal(profile?.commentCount, 1, 'comments on unpublished content are not counted');
  await setMemberStatus(db, 'ma', 'suspended');
  assert.equal(await getPublicProfile(db, 'alice'), null, 'suspended profiles are hidden');
});

test('admin member list searches and filters; admin actions apply', async () => {
  const { db } = await memberDb();
  assert.deepEqual((await listMembers(db, { now: T0 })).map((m) => m.id).sort(), ['ma', 'mb']);
  assert.deepEqual((await listMembers(db, { query: 'BOB@', now: T0 })).map((m) => m.id), ['mb']);
  assert.deepEqual((await listMembers(db, { query: '%', now: T0 })).map((m) => m.id), [], 'LIKE wildcards are literal');
  await adminMemberAction(db, 'mb', 'verify', T0);
  assert.deepEqual((await listMembers(db, { filter: 'unverified', now: T0 })).map((m) => m.id), ['ma']);
  await createMemberSession(db, 'ma', T0);
  assert.equal((await listMembers(db, { query: 'alice', now: T0 }))[0].sessions, 1);
  await adminMemberAction(db, 'ma', 'sign-out', T0);
  assert.equal((await listMembers(db, { query: 'alice', now: T0 }))[0].sessions, 0);
  await adminMemberAction(db, 'ma', 'suspend', T0);
  assert.deepEqual((await listMembers(db, { filter: 'suspended', now: T0 })).map((m) => m.id), ['ma']);
  assert.equal(await adminMemberAction(db, 'ma', 'delete', T0), true);
  assert.equal(await getMemberById(db, 'ma'), null);
  assert.equal(await adminMemberAction(db, 'nobody', 'suspend', T0), false);
  await revokeMemberSessions(db, 'mb');
});
