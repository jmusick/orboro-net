import { ensureDB } from "./db";
import {
  createSessionRecord,
  findSession,
  pruneSessions,
  revokeSession,
  revokeUserSessions,
} from "./sessions";

export {
  hashPassword,
  passwordNeedsRehash,
  verifyDummyPassword,
  verifyPassword,
} from "./passwords.js";

export async function createSession(locals: App.Locals, userId: string): Promise<{ token: string; expiresAt: number }> {
  return createSessionRecord(ensureDB(locals), userId);
}

export async function invalidateSession(locals: App.Locals, token: string): Promise<void> {
  await revokeSession(ensureDB(locals), token);
}

export async function invalidateUserSessions(locals: App.Locals, userId: string): Promise<void> {
  await revokeUserSessions(ensureDB(locals), userId);
}

export async function getSessionAndUserByToken(locals: App.Locals, token: string): Promise<{
  session: SessionRecord | null;
  user: UserRecord | null;
}> {
  const db = ensureDB(locals);
  const now = Date.now();

  // Expiry is enforced by the lookup, so cleanup need not write on every request.
  if (crypto.getRandomValues(new Uint32Array(1))[0] % 100 === 0) {
    await pruneSessions(db, now);
  }

  const row = await findSession(db, token, now);
  if (!row) {
    return { session: null, user: null };
  }

  return {
    session: { id: row.sessionId, userId: row.userId, expiresAt: row.expiresAt },
    user: { id: row.userId, email: row.email, role: row.role },
  };
}

export {
  clearSessionCookies,
  clearStaleSessionCookies,
  hasSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "./session-cookie";
