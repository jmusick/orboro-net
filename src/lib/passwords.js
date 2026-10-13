// Password hashing and password rules, shared by the Worker (src/lib/auth.ts)
// and the operator scripts (scripts/lib/d1.mjs), so a hash written by
// `admin:create` is always one the deployed Worker can verify. Plain JavaScript
// because the scripts run under plain Node. Web Crypto only: it exists in both
// workerd and Node.
//
// Stored format: pbkdf2$<iterations>$<base64 16-byte salt>$<base64 32-byte
// PBKDF2-HMAC-SHA256 output>. The iteration field is the work-factor version.

/**
 * Work factor for new hashes. Cloudflare's deployed runtime refuses PBKDF2
 * above 100,000 iterations (measured on a deployed Worker October 13, 2026;
 * one derive cost 25-33 ms CPU), even though local `wrangler dev` has no cap.
 * To raise it, re-measure on a deployed Worker first, then raise
 * MAX_PASSWORD_ITERATIONS and this together. Existing hashes keep verifying
 * and are rewritten at the new cost on their next successful sign-in.
 */
export const PASSWORD_ITERATIONS = 100_000;
/** Stored hashes outside these bounds are rejected without any hashing work. */
export const MIN_PASSWORD_ITERATIONS = 100_000;
export const MAX_PASSWORD_ITERATIONS = 100_000;

/** Password rules, counted in Unicode code points (NIST SP 800-63B-4). */
export const MIN_PASSWORD_CODE_POINTS = 15;
export const MAX_PASSWORD_CODE_POINTS = 128;

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const STORED_HASH = /^pbkdf2\$([1-9][0-9]{0,6})\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)$/;

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Parses a stored hash strictly: known scheme, iterations within bounds, and
 * canonical base64 of exactly the salt and hash lengths this code writes.
 * @param {unknown} stored
 * @returns {{ iterations: number, salt: Uint8Array, hash: Uint8Array } | null}
 */
export function parsePasswordHash(stored) {
  if (typeof stored !== "string") return null;
  const match = STORED_HASH.exec(stored);
  if (!match) return null;
  const iterations = Number(match[1]);
  if (iterations < MIN_PASSWORD_ITERATIONS || iterations > MAX_PASSWORD_ITERATIONS) return null;
  const salt = fromBase64(match[2]);
  const hash = fromBase64(match[3]);
  // Non-canonical padding bits decode to the same bytes; refuse them.
  if (toBase64(salt) !== match[2] || toBase64(hash) !== match[3]) return null;
  if (salt.byteLength !== SALT_BYTES || hash.byteLength !== HASH_BYTES) return null;
  return { iterations, salt, hash };
}

/**
 * @param {string} password
 * @param {number} [iterations]
 * @returns {Promise<string>}
 */
export async function hashPassword(password, iterations = PASSWORD_ITERATIONS) {
  if (typeof password !== "string" || !password.isWellFormed()) throw new TypeError("Password must be a well-formed string.");
  if (!Number.isSafeInteger(iterations) || iterations < MIN_PASSWORD_ITERATIONS || iterations > MAX_PASSWORD_ITERATIONS) {
    throw new RangeError(`Iterations must be between ${MIN_PASSWORD_ITERATIONS} and ${MAX_PASSWORD_ITERATIONS}.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Constant-time comparison against a stored hash. A malformed or out-of-bounds
 * stored value, or a runtime that refuses its work factor, verifies as false.
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const parsed = parsePasswordHash(stored);
  if (!parsed || typeof password !== "string") return false;
  let actual;
  try {
    actual = await pbkdf2(password, parsed.salt, parsed.iterations);
  } catch {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < HASH_BYTES; i += 1) diff |= actual[i] ^ parsed.hash[i];
  return diff === 0;
}

/**
 * True when a hash that just verified was made with less work than new hashes
 * use, so the caller should store a fresh one.
 * @param {string} stored
 * @param {number} [target]
 */
export function passwordNeedsRehash(stored, target = PASSWORD_ITERATIONS) {
  const parsed = parsePasswordHash(stored);
  return parsed !== null && parsed.iterations < target;
}

const DUMMY_SALT = new Uint8Array(SALT_BYTES);

/**
 * Spends the same PBKDF2 work for an unknown account as for a known one so
 * response time does not reveal which emails exist.
 * @param {string} password
 * @returns {Promise<false>}
 */
export async function verifyDummyPassword(password) {
  await pbkdf2(String(password), DUMMY_SALT, PASSWORD_ITERATIONS);
  return false;
}

/**
 * Rules for a new password, checked before it is hashed. Returns a message for
 * the operator, or null when the password is acceptable. Breach screening is
 * separate (scripts/lib/pwned-passwords.mjs) because it needs the network.
 * Nothing is trimmed, normalized or truncated: what is checked is what is hashed.
 * @param {unknown} password
 * @param {{ email?: string }} [context]
 * @returns {string | null}
 */
export function passwordProblem(password, { email = "" } = {}) {
  if (typeof password !== "string" || password === "") return "Password is required.";
  if (!password.isWellFormed()) return "Password contains an unpaired surrogate (invalid Unicode).";
  const codePoints = [...password];
  if (codePoints.length < MIN_PASSWORD_CODE_POINTS) return `Password must be at least ${MIN_PASSWORD_CODE_POINTS} characters.`;
  if (codePoints.length > MAX_PASSWORD_CODE_POINTS) return `Password must be at most ${MAX_PASSWORD_CODE_POINTS} characters.`;
  if (new Set(codePoints).size === 1) return "Password must not be one repeated character.";
  const lower = password.toLowerCase();
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  if (lower.includes("orboro") || (local.length >= 4 && lower.includes(local))) {
    return "Password must not contain the site name or the account's email name.";
  }
  return null;
}
