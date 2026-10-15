// Public member accounts: field rules, the `members` table, member sessions and
// single-use emailed tokens. Members are separate from the admin `users` table
// on purpose (issue #16): their sessions live in `member_sessions` under their
// own cookie, so a member can never pass requireAdmin. Kept free of
// Worker-only imports so tests can drive it with a node:sqlite stand-in.

import { passwordProblem } from "./passwords.js";
import { SESSION_DURATION_MS, generateSessionToken, hashSessionToken, isWellFormedSessionToken } from "./sessions.ts";

export const MEMBER_SESSION_DURATION_MS = SESSION_DURATION_MS;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 24;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 500;
/** UTF-16 units accepted from a form before rules run; at least 2× MAX_PASSWORD_CODE_POINTS. */
export const MAX_PASSWORD_INPUT_LENGTH = 512;

export const TOKEN_LIFETIMES_MS = {
  verify: 48 * 60 * 60 * 1000,
  email: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
} as const;

export type MemberTokenPurpose = keyof typeof TOKEN_LIFETIMES_MS;

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;
const CONTROL_OR_NEWLINE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

/** Names a member could use to pass as the site or its staff. */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "orboro", "orboronet", "jd", "moderator", "mod", "mods", "staff", "support",
  "system", "root", "deleted", "removed", "anonymous", "null", "undefined", "account", "me", "help",
]);

export interface MemberDB {
  prepare(sql: string): MemberStatement;
  batch(statements: MemberStatement[]): Promise<unknown>;
}

export interface MemberStatement {
  bind(...values: unknown[]): MemberStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results?: T[] }>;
}

export interface MemberAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  bio: string;
  status: "active" | "suspended";
  createdAt: number;
}

interface MemberRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  email_verified_at: number | null;
  bio: string;
  status: "active" | "suspended";
  created_at: number;
}

const MEMBER_COLUMNS = "id, username, display_name, email, email_verified_at, bio, status, created_at";

function mapMember(row: MemberRow): MemberAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    emailVerified: row.email_verified_at !== null,
    bio: row.bio,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** The name shown beside a member's comments. */
export function memberLabel(member: { username: string; displayName: string }): string {
  return member.displayName || member.username;
}

// ── Field rules ─────────────────────────────────────────────────────────────
// Each returns a short code naming the form message, or null when acceptable.

export function usernameKey(username: string): string {
  return username.toLowerCase();
}

export function usernameProblem(value: unknown): "username" | "username-reserved" | null {
  if (typeof value !== "string") return "username";
  if (value.length < MIN_USERNAME_LENGTH || value.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(value)) return "username";
  const key = usernameKey(value);
  if (RESERVED_USERNAMES.has(key) || key.replace(/[_-]/g, "").includes("orboro")) return "username-reserved";
  return null;
}

/** Lowercased and trimmed; null when it is not a plausible address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email) || CONTROL.test(email)) return null;
  return email;
}

/** Display names are optional, single-line and at most 50 code points. */
export function displayNameProblem(value: unknown): "display-name" | null {
  if (typeof value !== "string" || !value.isWellFormed()) return "display-name";
  if ([...value].length > MAX_DISPLAY_NAME_LENGTH || CONTROL_OR_NEWLINE.test(value) || value !== value.trim()) return "display-name";
  return null;
}

/** Bios are optional plain text, newlines allowed, at most 500 code points. */
export function bioProblem(value: unknown): "bio" | null {
  if (typeof value !== "string" || !value.isWellFormed()) return "bio";
  if ([...value].length > MAX_BIO_LENGTH || CONTROL.test(value)) return "bio";
  return null;
}

/**
 * The shared password rules (passwords.js) plus the member's username. Returns
 * the rule's message, or null. Breach screening is separate (pwned-passwords.js).
 */
export function memberPasswordProblem(password: unknown, { email = "", username = "" } = {}): string | null {
  const problem = passwordProblem(password, { email });
  if (problem) return problem;
  if (username.length >= 4 && (password as string).toLowerCase().includes(username.toLowerCase())) {
    return "Password must not contain your username.";
  }
  return null;
}

// ── Accounts ────────────────────────────────────────────────────────────────

export type CreateMemberResult =
  | { ok: true; id: string }
  | { ok: false; reason: "username-taken" | "email-taken" };

/**
 * Creates an unverified account. A taken email is reported to the caller only
 * so it can mail the owner instead; the registration page must answer the
 * same way either way so addresses can't be probed.
 */
export async function createMember(
  db: MemberDB,
  input: { username: string; email: string; passwordHash: string },
  now: number = Date.now(),
  newId: () => string = () => crypto.randomUUID(),
): Promise<CreateMemberResult> {
  const taken = await db
    .prepare("SELECT username_key = ? AS username_match, email = ? AS email_match FROM members WHERE username_key = ? OR email = ?")
    .bind(usernameKey(input.username), input.email, usernameKey(input.username), input.email)
    .all<{ username_match: number; email_match: number }>();
  const rows = taken.results ?? [];
  if (rows.some((row) => row.username_match)) return { ok: false, reason: "username-taken" };
  if (rows.some((row) => row.email_match)) return { ok: false, reason: "email-taken" };

  const id = newId();
  try {
    await db
      .prepare(
        `INSERT INTO members (id, username, username_key, email, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.username, usernameKey(input.username), input.email, input.passwordHash, now, now)
      .run();
  } catch (error) {
    // A concurrent registration won the unique index.
    if (/UNIQUE/i.test(String(error))) {
      return { ok: false, reason: /username/i.test(String(error)) ? "username-taken" : "email-taken" };
    }
    throw error;
  }
  return { ok: true, id };
}

/** Looks an account up by username or email for sign-in. */
export async function findMemberForLogin(
  db: MemberDB,
  login: string,
): Promise<(MemberAccount & { passwordHash: string }) | null> {
  const value = login.trim().toLowerCase();
  const row = await db
    .prepare(`SELECT ${MEMBER_COLUMNS}, password_hash FROM members WHERE ${value.includes("@") ? "email" : "username_key"} = ? LIMIT 1`)
    .bind(value)
    .first<MemberRow & { password_hash: string }>();
  return row ? { ...mapMember(row), passwordHash: row.password_hash } : null;
}

export async function getMemberById(db: MemberDB, id: string): Promise<MemberAccount | null> {
  const row = await db.prepare(`SELECT ${MEMBER_COLUMNS} FROM members WHERE id = ? LIMIT 1`).bind(id).first<MemberRow>();
  return row ? mapMember(row) : null;
}

export async function getMemberByEmail(db: MemberDB, email: string): Promise<MemberAccount | null> {
  const row = await db.prepare(`SELECT ${MEMBER_COLUMNS} FROM members WHERE email = ? LIMIT 1`).bind(email).first<MemberRow>();
  return row ? mapMember(row) : null;
}

export async function getPasswordHash(db: MemberDB, id: string): Promise<string | null> {
  const row = await db.prepare("SELECT password_hash FROM members WHERE id = ?").bind(id).first<{ password_hash: string }>();
  return row?.password_hash ?? null;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  createdAt: number;
  /** Net votes others gave the member's visible comments (self-votes excluded). */
  karma: number;
  commentCount: number;
}

export async function getPublicProfile(db: MemberDB, username: string): Promise<PublicProfile | null> {
  const row = await db
    .prepare(
      `SELECT m.id, m.username, m.display_name, m.bio, m.created_at,
        (SELECT COALESCE(SUM(v.value), 0) FROM comments c JOIN comment_votes v ON v.comment_id = c.id
          WHERE c.member_id = m.id AND c.status = 'visible' AND v.member_id <> m.id) AS karma,
        (SELECT COUNT(*) FROM comments c JOIN content ct ON ct.id = c.content_id
          WHERE c.member_id = m.id AND c.status = 'visible' AND ct.status = 'published' AND ct.comments_mode <> 'hidden') AS comment_count
       FROM members m WHERE m.username_key = ? AND m.status = 'active' LIMIT 1`,
    )
    .bind(usernameKey(username))
    .first<{ id: string; username: string; display_name: string; bio: string; created_at: number; karma: number; comment_count: number }>();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    createdAt: row.created_at,
    karma: row.karma,
    commentCount: row.comment_count,
  };
}

export async function updateMemberProfile(
  db: MemberDB,
  memberId: string,
  profile: { displayName: string; bio: string },
  now: number = Date.now(),
): Promise<void> {
  await db
    .prepare("UPDATE members SET display_name = ?, bio = ?, updated_at = ? WHERE id = ?")
    .bind(profile.displayName, profile.bio, now, memberId)
    .run();
}

/** Replaces the password and signs the member out everywhere, in one transaction. */
export async function setMemberPassword(db: MemberDB, memberId: string, passwordHash: string, now: number = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("UPDATE members SET password_hash = ?, updated_at = ? WHERE id = ?").bind(passwordHash, now, memberId),
    db.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(memberId),
    db.prepare("DELETE FROM member_tokens WHERE member_id = ? AND purpose = 'reset'").bind(memberId),
  ]);
}

/** Rehash on sign-in: only replaces the hash that was verified. */
export async function rehashMemberPassword(db: MemberDB, memberId: string, oldHash: string, newHash: string): Promise<void> {
  await db.prepare("UPDATE members SET password_hash = ? WHERE id = ? AND password_hash = ?").bind(newHash, memberId, oldHash).run();
}

/**
 * Deletes an account. Its comments stay in their threads as [deleted] with the
 * text erased and no author; its votes, reports, sessions and tokens go with it.
 */
export async function deleteMember(db: MemberDB, memberId: string): Promise<void> {
  await db.batch([
    db.prepare("UPDATE comments SET status = 'deleted', body = '', edited_at = NULL WHERE member_id = ?").bind(memberId),
    db.prepare("DELETE FROM members WHERE id = ?").bind(memberId),
  ]);
}

/** Admin moderation: a suspended member can't sign in, and is signed out now. */
export async function setMemberStatus(
  db: MemberDB,
  memberId: string,
  status: "active" | "suspended",
  now: number = Date.now(),
): Promise<boolean> {
  const statements = [db.prepare("UPDATE members SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, memberId)];
  if (status === "suspended") statements.push(db.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(memberId));
  await db.batch(statements);
  return (await getMemberById(db, memberId)) !== null;
}

export interface MemberListItem extends MemberAccount {
  comments: number;
  sessions: number;
}

export const MEMBER_STATUS_FILTERS = ["all", "active", "suspended", "unverified"] as const;
export type MemberStatusFilter = (typeof MEMBER_STATUS_FILTERS)[number];

const LIST_COLUMNS = `${MEMBER_COLUMNS},
  (SELECT COUNT(*) FROM comments c WHERE c.member_id = members.id AND c.status <> 'deleted') AS comments,
  (SELECT COUNT(*) FROM member_sessions s WHERE s.member_id = members.id AND s.expires_at > ?) AS sessions`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Accounts for the admin members page, newest first. `query` matches the
 * username, display name or email; `filter` narrows by account state.
 */
export async function listMembers(
  db: MemberDB,
  { query = "", filter = "all", limit = 200, now = Date.now() }: { query?: string; filter?: MemberStatusFilter; limit?: number; now?: number } = {},
): Promise<MemberListItem[]> {
  const where: string[] = [];
  const values: unknown[] = [now];
  const q = query.trim().toLowerCase().slice(0, 100);
  if (q) {
    where.push("(username_key LIKE ? ESCAPE '\\' OR lower(display_name) LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
    const pattern = `%${escapeLike(q)}%`;
    values.push(pattern, pattern, pattern);
  }
  if (filter === "active") where.push("status = 'active'");
  if (filter === "suspended") where.push("status = 'suspended'");
  if (filter === "unverified") where.push("email_verified_at IS NULL");
  values.push(limit);
  const result = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM members ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`)
    .bind(...values)
    .all<MemberRow & { comments: number; sessions: number }>();
  return (result.results ?? []).map((row) => ({ ...mapMember(row), comments: row.comments, sessions: row.sessions }));
}

export async function getMemberAdminView(db: MemberDB, id: string, now: number = Date.now()): Promise<MemberListItem | null> {
  const row = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM members WHERE id = ? LIMIT 1`)
    .bind(now, id)
    .first<MemberRow & { comments: number; sessions: number }>();
  return row ? { ...mapMember(row), comments: row.comments, sessions: row.sessions } : null;
}

export const MEMBER_ADMIN_ACTIONS = ["suspend", "reinstate", "verify", "sign-out", "delete"] as const;
export type MemberAdminAction = (typeof MEMBER_ADMIN_ACTIONS)[number];

/** Applies one admin account action. Returns false when the member doesn't exist. */
export async function adminMemberAction(db: MemberDB, memberId: string, action: MemberAdminAction, now: number = Date.now()): Promise<boolean> {
  const member = await getMemberById(db, memberId);
  if (!member) return false;
  switch (action) {
    case "suspend":
    case "reinstate":
      await setMemberStatus(db, memberId, action === "suspend" ? "suspended" : "active", now);
      break;
    case "verify":
      await markEmailVerified(db, memberId, member.email, now);
      break;
    case "sign-out":
      await revokeMemberSessions(db, memberId);
      break;
    case "delete":
      await deleteMember(db, memberId);
      break;
  }
  return true;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export interface MemberSessionLookup {
  sessionId: string;
  expiresAt: number;
  member: MemberAccount;
}

export async function createMemberSession(
  db: MemberDB,
  memberId: string,
  now: number = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  const token = generateSessionToken();
  const expiresAt = now + MEMBER_SESSION_DURATION_MS;
  await db
    .prepare("INSERT INTO member_sessions (id, member_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionToken(token), memberId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

/** Resolves a member cookie to a live session of an active account, or null. */
export async function findMemberSession(db: MemberDB, token: string, now: number = Date.now()): Promise<MemberSessionLookup | null> {
  if (!isWellFormedSessionToken(token)) return null;
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at AS session_expires_at, ${MEMBER_COLUMNS.split(", ").map((c) => `m.${c}`).join(", ")}
       FROM member_sessions s INNER JOIN members m ON m.id = s.member_id
       WHERE s.id = ? AND s.expires_at > ? AND m.status = 'active' LIMIT 1`,
    )
    .bind(await hashSessionToken(token), now)
    .first<MemberRow & { session_id: string; session_expires_at: number }>();
  if (!row) return null;
  return { sessionId: row.session_id, expiresAt: row.session_expires_at, member: mapMember(row) };
}

export async function revokeMemberSession(db: MemberDB, token: string): Promise<void> {
  if (!isWellFormedSessionToken(token)) return;
  await db.prepare("DELETE FROM member_sessions WHERE id = ?").bind(await hashSessionToken(token)).run();
}

export async function revokeMemberSessions(db: MemberDB, memberId: string): Promise<void> {
  await db.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(memberId).run();
}

/** Housekeeping for expired sessions and tokens; lookups already enforce expiry. */
export async function pruneMemberRecords(db: MemberDB, now: number = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM member_tokens WHERE expires_at <= ?").bind(now),
  ]);
}

// ── Emailed tokens ──────────────────────────────────────────────────────────

/**
 * Issues a single-use token for a verification, email-change or reset link.
 * Earlier unused tokens of the same purpose stop working. Only the digest is
 * stored, so a copy of the table can't be turned into working links.
 */
export async function issueMemberToken(
  db: MemberDB,
  memberId: string,
  purpose: MemberTokenPurpose,
  email: string,
  now: number = Date.now(),
): Promise<string> {
  const token = generateSessionToken();
  await db.batch([
    db.prepare("DELETE FROM member_tokens WHERE member_id = ? AND purpose = ?").bind(memberId, purpose),
    db
      .prepare("INSERT INTO member_tokens (id, member_id, purpose, email, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(await hashSessionToken(token), memberId, purpose, email, now + TOKEN_LIFETIMES_MS[purpose], now),
  ]);
  return token;
}

/** Spends a token: returns whose it was and the address it proves, or null. */
export async function consumeMemberToken(
  db: MemberDB,
  token: string,
  purpose: MemberTokenPurpose,
  now: number = Date.now(),
): Promise<{ memberId: string; email: string } | null> {
  if (!isWellFormedSessionToken(token)) return null;
  const row = await db
    .prepare("DELETE FROM member_tokens WHERE id = ? AND purpose = ? RETURNING member_id, email, expires_at")
    .bind(await hashSessionToken(token), purpose)
    .first<{ member_id: string; email: string; expires_at: number }>();
  if (!row || row.expires_at <= now) return null;
  return { memberId: row.member_id, email: row.email };
}

/** Whose token this is, if it exists and is unexpired, without spending it (to check a reset before applying it). */
export async function peekMemberToken(
  db: MemberDB,
  token: string,
  purpose: MemberTokenPurpose,
  now: number = Date.now(),
): Promise<{ memberId: string; email: string } | null> {
  if (!isWellFormedSessionToken(token)) return null;
  const row = await db
    .prepare("SELECT member_id, email FROM member_tokens WHERE id = ? AND purpose = ? AND expires_at > ?")
    .bind(await hashSessionToken(token), purpose, now)
    .first<{ member_id: string; email: string }>();
  return row ? { memberId: row.member_id, email: row.email } : null;
}

/** Marks the address verified, but only if it is still the account's address. */
export async function markEmailVerified(db: MemberDB, memberId: string, email: string, now: number = Date.now()): Promise<boolean> {
  await db
    .prepare("UPDATE members SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ? AND email = ?")
    .bind(now, now, memberId, email)
    .run();
  const member = await getMemberById(db, memberId);
  return Boolean(member && member.email === email && member.emailVerified);
}

/**
 * Applies a confirmed email change. The new address is verified by the link
 * itself; fails if another account took the address meanwhile.
 */
export async function applyEmailChange(db: MemberDB, memberId: string, email: string, now: number = Date.now()): Promise<boolean> {
  const other = await getMemberByEmail(db, email);
  if (other && other.id !== memberId) return false;
  try {
    await db
      .prepare("UPDATE members SET email = ?, email_verified_at = ?, updated_at = ? WHERE id = ?")
      .bind(email, now, now, memberId)
      .run();
  } catch (error) {
    if (/UNIQUE/i.test(String(error))) return false;
    throw error;
  }
  return true;
}
