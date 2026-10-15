// Shared plumbing for the member and comment API routes: Worker bindings,
// bounded form reading, budgets that fail closed, breach screening that fails
// open, and safe redirect targets. Field rules live in members.ts/comments.ts.

import type { AstroCookies } from "astro";
import { env as workerEnv } from "cloudflare:workers";
import { createMemberSession } from "./members";
import { setMemberCookie } from "./member-cookie";
import { pwnedCount } from "./pwned-passwords.js";
import { hitRateLimits, pruneRateLimits, type RateLimitName } from "./rate-limits";
import { MULTIPART, URLENCODED, formText, readBoundedForm } from "./request-limits";
import { logSecurityEvent } from "./security-events";

interface MemberBindings {
  DB?: D1Database;
  EMAIL?: SendEmail;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

function bindings(): MemberBindings {
  return (workerEnv as unknown) as MemberBindings;
}

export function memberDb(): D1Database {
  const db = bindings().DB;
  if (!db) throw new Error("D1 binding not available.");
  return db;
}

export function emailBinding(): SendEmail | undefined {
  return bindings().EMAIL;
}

export function turnstileSecret(): string | undefined {
  return bindings().TURNSTILE_SECRET_KEY || undefined;
}

/** The public Turnstile site key for the registration and reset forms. */
export function turnstileSiteKey(): string {
  return bindings().TURNSTILE_SITE_KEY ?? "";
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Reads a member form within its budget. ClientRouter resubmits forms with
 * fetch as multipart, so both encodings are accepted. Returns the text fields
 * asked for, or null when the body is unusable (too large, wrong type, a file
 * or repeated field where text was expected).
 */
export async function readMemberFields<const K extends string>(
  request: Request,
  maxBytes: number,
  names: readonly K[],
): Promise<Record<K, string> | null> {
  const body = await readBoundedForm(request, { maxBytes, types: [URLENCODED, MULTIPART], maxFields: 16 });
  if (!body.ok) return null;
  const out = {} as Record<K, string>;
  for (const name of names) {
    const value = formText(body.form, name);
    if (value === null) return null;
    out[name] = value;
  }
  return out;
}

/**
 * Charges the budgets. Returns null when allowed, otherwise the error code to
 * redirect with: `rate-limited`, or `unavailable` when the store fails (never
 * allowed unmetered).
 */
export async function chargeBudgets(
  db: D1Database,
  budgets: [RateLimitName, string][],
  request: Request,
  member?: string,
): Promise<"rate-limited" | "unavailable" | null> {
  try {
    const result = await hitRateLimits(db, budgets);
    // Expired windows are dropped now and then; lookups already ignore them.
    if (crypto.getRandomValues(new Uint32Array(1))[0] % 50 === 0) await pruneRateLimits(db).catch(() => {});
    if (result.allowed) return null;
    logSecurityEvent("member.limited", { reason: budgets[0][0].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), member, retry_after_s: result.retryAfterSeconds }, request);
    return "rate-limited";
  } catch {
    logSecurityEvent("member.unavailable", { reason: "rate-limit-store", member }, request);
    return "unavailable";
  }
}

/**
 * Breach screening for new member passwords. Unlike the operator scripts this
 * fails open: an outage at Have I Been Pwned must not block sign-ups, so the
 * password is accepted (the shared rules still apply) and the miss is logged.
 */
export async function breachProblem(password: string, request: Request): Promise<string | null> {
  try {
    const count = await pwnedCount(password, { timeoutMs: 3000, userAgent: "orboro-net" });
    return count > 0 ? "breached" : null;
  } catch {
    logSecurityEvent("member.unavailable", { reason: "breach-check" }, request);
    return null;
  }
}

/** A same-site path to return to after sign-in, or the fallback. */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || value.length > 512 || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://next.invalid");
    if (url.origin !== "https://next.invalid") return fallback;
    if (url.pathname.startsWith("/api/")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** An absolute link on this site, for emails. */
export function siteLink(requestUrl: URL, path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, requestUrl.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

export async function signInMember(db: D1Database, cookies: AstroCookies, url: URL, memberId: string): Promise<void> {
  const session = await createMemberSession(db, memberId);
  setMemberCookie(cookies, url, session.token, session.expiresAt);
}
