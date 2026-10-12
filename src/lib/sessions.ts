// Session tokens, their at-rest digests and the session cookie. Kept free of
// Worker-only imports so tests can exercise it with a stand-in database.
//
// The browser holds a 256-bit random token; D1 stores only its SHA-256 digest
// (hex) in `sessions.id`. A read-only copy of the sessions table therefore
// yields no usable cookie. Sessions have a fixed 14-day lifetime from sign-in
// and no idle timeout.

export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

// `__Host-` binds the cookie to this exact host over HTTPS (Secure, Path=/, no
// Domain). Browsers refuse that prefix on plain HTTP, so local development on
// http://127.0.0.1 keeps the unprefixed name.
export const SECURE_SESSION_COOKIE = "__Host-orboro_session";
export const LOCAL_SESSION_COOKIE = "orboro_session";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DIGEST_LENGTH = 64;

// The slice of D1Database this module uses, so tests can supply a stand-in.
export interface SessionDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface SessionLookup {
  sessionId: string;
  userId: string;
  expiresAt: number;
  email: string;
  role: UserRole;
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Only tokens minted by `generateSessionToken` are looked up; legacy UUIDs are not. */
export function isWellFormedSessionToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export async function hashSessionToken(token: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionRecord(
  db: SessionDB,
  userId: string,
  now: number = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  const token = generateSessionToken();
  const expiresAt = now + SESSION_DURATION_MS;
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionToken(token), userId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

/** Resolves a presented cookie value to a live session, or null. */
export async function findSession(
  db: SessionDB,
  token: string,
  now: number = Date.now(),
): Promise<SessionLookup | null> {
  if (!isWellFormedSessionToken(token)) return null;
  const row = await db
    .prepare(
      `SELECT
        sessions.id as session_id,
        sessions.user_id as user_id,
        sessions.expires_at as expires_at,
        users.email as email,
        users.role as role
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.expires_at > ?
      LIMIT 1`,
    )
    .bind(await hashSessionToken(token), now)
    .first<{ session_id: string; user_id: string; expires_at: number; email: string; role: UserRole }>();
  if (!row) return null;
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    email: row.email,
    role: row.role,
  };
}

export async function revokeSession(db: SessionDB, token: string): Promise<void> {
  if (!isWellFormedSessionToken(token)) return;
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashSessionToken(token)).run();
}

/** Signs a user out everywhere, including the session that asked. */
export async function revokeUserSessions(db: SessionDB, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

/**
 * Drops expired sessions and pre-digest rows (raw UUIDs, which no cookie can
 * reach any more). Expiry is also enforced by `findSession`, so this is
 * housekeeping only.
 */
export async function pruneSessions(db: SessionDB, now: number = Date.now()): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE expires_at <= ? OR length(id) <> ?")
    .bind(now, DIGEST_LENGTH)
    .run();
}

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

export interface SessionCookieOptions {
  path: "/";
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  expires?: Date;
}

export function sessionCookieOptions(secure: boolean, expiresAt?: number): SessionCookieOptions {
  const options: SessionCookieOptions = { path: "/", httpOnly: true, sameSite: "lax", secure };
  if (expiresAt !== undefined) options.expires = new Date(expiresAt);
  return options;
}

/** Session cookie names that should be cleared on this origin. */
export function staleSessionCookieNames(secure: boolean): string[] {
  // Over HTTPS the unprefixed name is the pre-`__Host-` cookie; its token is a
  // raw UUID that no longer resolves.
  return secure ? [LOCAL_SESSION_COOKIE] : [];
}
