import { ensureDB } from "./db";

const PASSWORD_ITERATIONS = 100_000;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations,
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iterText, salt64, hash64] = stored.split("$");
  if (kind !== "pbkdf2" || !iterText || !salt64 || !hash64) return false;
  const iterations = Number(iterText);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const salt = fromBase64(salt64);
  const expected = fromBase64(hash64);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.byteLength !== expected.byteLength) return false;

  let diff = 0;
  for (let i = 0; i < actual.byteLength; i += 1) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

// Spend the same PBKDF2 work for an unknown account as for a known one so
// response time does not reveal which emails exist.
const DUMMY_SALT = new Uint8Array(16);
export async function verifyDummyPassword(password: string): Promise<false> {
  await pbkdf2(password, DUMMY_SALT, PASSWORD_ITERATIONS);
  return false;
}

export async function createSession(locals: App.Locals, userId: string): Promise<{ id: string; expiresAt: number }> {
  const db = ensureDB(locals);
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, expiresAt, Date.now())
    .run();

  return { id, expiresAt };
}

export async function invalidateSession(locals: App.Locals, sessionId: string): Promise<void> {
  const db = ensureDB(locals);
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export async function getSessionAndUserByToken(locals: App.Locals, sessionId: string): Promise<{
  session: SessionRecord | null;
  user: UserRecord | null;
}> {
  const db = ensureDB(locals);
  const now = Date.now();

  // Expiry is enforced by the SELECT, so cleanup need not write on every request.
  if (crypto.getRandomValues(new Uint32Array(1))[0] % 100 === 0) {
    await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  }

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
      LIMIT 1`
    )
    .bind(sessionId, now)
    .first<{
      session_id: string;
      user_id: string;
      expires_at: number;
      email: string;
      role: UserRole;
    }>();

  if (!row) {
    return { session: null, user: null };
  }

  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
    },
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role,
    },
  };
}
