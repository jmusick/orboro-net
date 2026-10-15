// Fixed-window budgets for the public member surface: registration, member
// sign-in, emailed links, comments, votes and reports. Same scheme as
// login-throttle.ts (D1, inside the Worker, keys stored as SHA-256 digests,
// counted before any work), but in its own `rate_limits` table with a window
// per budget, so admin sign-in budgets are never shared with public traffic.

const MINUTE = 60 * 1000;

export const RATE_LIMITS = {
  /** New accounts per client IP. */
  registerIp: { limit: 5, windowMs: 60 * MINUTE },
  /** Member sign-in attempts. */
  memberLoginIp: { limit: 20, windowMs: 15 * MINUTE },
  memberLoginAccount: { limit: 10, windowMs: 15 * MINUTE },
  /** Password-reset requests per IP and per address. */
  resetIp: { limit: 5, windowMs: 60 * MINUTE },
  resetAccount: { limit: 3, windowMs: 60 * MINUTE },
  /** Verification and email-change messages per member. */
  verifyEmail: { limit: 3, windowMs: 60 * MINUTE },
  /** New comments per member and per IP. */
  commentMember: { limit: 10, windowMs: 10 * MINUTE },
  commentIp: { limit: 30, windowMs: 10 * MINUTE },
  /** Edits, deletes and reports per member. */
  commentChange: { limit: 30, windowMs: 10 * MINUTE },
  report: { limit: 20, windowMs: 60 * MINUTE },
  /** Votes per member. */
  vote: { limit: 120, windowMs: 10 * MINUTE },
  /** Profile, password and account changes per member. */
  accountChange: { limit: 20, windowMs: 60 * MINUTE },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

// The slice of D1Database this module uses, so tests can supply a stand-in.
export interface RateLimitDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

async function digest(scope: string, value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${scope}:${value}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Counts one attempt against `name` for `value` (an IP, member ID or email)
 * and says whether it fits the budget. Throws if the store fails; callers must
 * treat that as a refusal.
 */
export async function hitRateLimit(
  db: RateLimitDB,
  name: RateLimitName,
  value: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[name];
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, attempts, expires_at) VALUES (?1, ?2, 1, ?4)
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE WHEN window_start <= ?3 THEN 1 ELSE attempts + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END,
         expires_at = CASE WHEN window_start <= ?3 THEN ?4 ELSE expires_at END
       RETURNING attempts, window_start`,
    )
    .bind(await digest(name, value), now, now - windowMs, now + windowMs)
    .first<{ attempts: number; window_start: number }>();
  if (!row) throw new Error("rate limit returned no row");
  if (row.attempts <= limit) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000)) };
}

/** Checks several budgets in order and stops at the first that is spent. */
export async function hitRateLimits(
  db: RateLimitDB,
  budgets: [RateLimitName, string][],
  now: number = Date.now(),
): Promise<RateLimitResult> {
  for (const [name, value] of budgets) {
    const result = await hitRateLimit(db, name, value, now);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

/** Clears one budget, e.g. an account's sign-in failures after a success. */
export async function clearRateLimit(db: RateLimitDB, name: RateLimitName, value: string): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(await digest(name, value)).run();
}

/** Drops expired windows; cheap enough to run opportunistically. */
export async function pruneRateLimits(db: RateLimitDB, now: number = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(now).run();
}
