// Cloudflare Turnstile, server side. The registration and password-reset forms
// carry a `cf-turnstile-response` token that is checked with Siteverify before
// any account or email work. The site key is public (wrangler.toml [vars]);
// the secret is a Worker secret (`TURNSTILE_SECRET_KEY`). Local development
// uses Cloudflare's always-pass test keys from `.dev.vars`.

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_FIELD = "cf-turnstile-response";
/** Turnstile tokens are at most 2048 characters. */
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

export type TurnstileAction = "register" | "reset";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "failed" | "unavailable" | "unconfigured" };

/**
 * Verifies a widget token. A missing secret or an unreachable Siteverify fails
 * closed: the caller refuses the request rather than skipping the check.
 */
export async function verifyTurnstile(
  token: string | null,
  {
    secret,
    action,
    remoteIp,
    fetchImpl = fetch,
    timeoutMs = 5000,
  }: { secret: string | undefined; action: TurnstileAction; remoteIp?: string | null; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<TurnstileResult> {
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!token || token.length > MAX_TURNSTILE_TOKEN_LENGTH) return { ok: false, reason: "missing" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  let outcome: { success?: unknown; action?: unknown };
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    outcome = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (outcome.success !== true) return { ok: false, reason: "failed" };
  // A token minted for another form is refused. Test keys report an empty action.
  if (typeof outcome.action === "string" && outcome.action !== "" && outcome.action !== action) {
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
