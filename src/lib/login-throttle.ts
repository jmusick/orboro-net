// Application-level login budgets. They live in D1, inside the Worker, so they
// apply on every hostname that reaches the login handler (custom domain,
// workers.dev, previews) rather than depending on a zone rule.

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_IP_LIMIT = 20;
export const LOGIN_ACCOUNT_LIMIT = 10;
export const MAX_LOGIN_BODY_BYTES = 4096;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PASSWORD_LENGTH = 512;

// The slice of D1Database this module uses, so tests can supply a stand-in.
export interface ThrottleDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export type ThrottleResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

async function digest(scope: string, value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${scope}:${value}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Counts the attempt and returns the new total. Counting before the password
// is checked keeps parallel guesses inside the budget.
async function hit(db: ThrottleDB, key: string, now: number): Promise<{ attempts: number; windowStart: number }> {
  const row = await db
    .prepare(
      `INSERT INTO login_attempts (key, window_start, attempts) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE WHEN window_start <= ?3 THEN 1 ELSE attempts + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
       RETURNING attempts, window_start`,
    )
    .bind(key, now, now - LOGIN_WINDOW_MS)
    .first<{ attempts: number; window_start: number }>();
  if (!row) throw new Error("login throttle returned no row");
  return { attempts: row.attempts, windowStart: row.window_start };
}

function retryAfter(windowStart: number, now: number): number {
  return Math.max(1, Math.ceil((windowStart + LOGIN_WINDOW_MS - now) / 1000));
}

/**
 * Reserve one login attempt for this client and account. The IP budget is
 * charged first so a blocked client cannot burn the account's budget. Throws
 * if the limiter store fails; callers must treat that as a refusal.
 */
export async function reserveLoginAttempt(
  db: ThrottleDB,
  ip: string,
  email: string,
  now: number = Date.now(),
): Promise<ThrottleResult> {
  const ipHit = await hit(db, await digest("ip", ip), now);
  if (ipHit.attempts > LOGIN_IP_LIMIT) {
    return { allowed: false, retryAfterSeconds: retryAfter(ipHit.windowStart, now) };
  }
  const accountHit = await hit(db, await digest("account", email), now);
  if (accountHit.attempts > LOGIN_ACCOUNT_LIMIT) {
    return { allowed: false, retryAfterSeconds: retryAfter(accountHit.windowStart, now) };
  }
  return { allowed: true };
}

/** A successful sign-in clears that account's failures. */
export async function clearAccountAttempts(db: ThrottleDB, email: string): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE key = ?").bind(await digest("account", email)).run();
}

/** Drop expired windows; cheap enough to run opportunistically. */
export async function pruneLoginAttempts(db: ThrottleDB, now: number = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE window_start <= ?").bind(now - LOGIN_WINDOW_MS).run();
}
