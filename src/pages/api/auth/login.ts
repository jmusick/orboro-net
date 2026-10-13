import type { APIRoute } from "astro";
import {
  createSession,
  hashPassword,
  passwordNeedsRehash,
  setSessionCookie,
  verifyDummyPassword,
  verifyPassword,
} from "../../../lib/auth";
import { ensureDB } from "../../../lib/db";
import {
  MAX_EMAIL_LENGTH,
  MAX_LOGIN_BODY_BYTES,
  MAX_PASSWORD_LENGTH,
  clearAccountAttempts,
  pruneLoginAttempts,
  reserveLoginAttempt,
} from "../../../lib/login-throttle";
import { MULTIPART, URLENCODED, formText, readBoundedForm } from "../../../lib/request-limits";
import { logSecurityEvent } from "../../../lib/security-events";

function refusal(status: number, message: string, retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return new Response(message, { status, headers });
}

export const POST: APIRoute = async ({ request, locals, cookies, url, redirect }) => {
  // Bound the streamed body before parsing it or doing any hashing work. The
  // login page uses BaseLayout, whose ClientRouter resubmits forms with fetch
  // as multipart/form-data, so both encodings must be accepted.
  const body = await readBoundedForm(request, {
    maxBytes: MAX_LOGIN_BODY_BYTES,
    types: [URLENCODED, MULTIPART],
    maxFields: 8,
  });
  if (!body.ok) {
    logSecurityEvent("auth.login.failed", { reason: body.reason }, request);
    return body.status === 413 ? refusal(413, "Request too large.") : redirect("/admin?error=invalid");
  }
  const email = (formText(body.form, "email") ?? "").trim().toLowerCase();
  const password = formText(body.form, "password") ?? "";

  if (!email || !password || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    logSecurityEvent("auth.login.failed", { reason: "malformed" }, request);
    return redirect("/admin?error=invalid");
  }

  const db = ensureDB(locals);

  // Budgets are charged before any password work. If the limiter store fails
  // the attempt is refused rather than allowed unmetered.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  let throttle;
  try {
    throttle = await reserveLoginAttempt(db, ip, email);
  } catch {
    logSecurityEvent("auth.login.unavailable", { status: 503 }, request);
    return refusal(503, "Sign-in is temporarily unavailable. Try again shortly.", 30);
  }
  if (!throttle.allowed) {
    logSecurityEvent("auth.login.throttled", { status: 429, retry_after_s: throttle.retryAfterSeconds }, request);
    return refusal(429, "Too many sign-in attempts. Try again later.", throttle.retryAfterSeconds);
  }

  const user = await db
    .prepare("SELECT id, password_hash, role FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<{ id: string; password_hash: string; role: UserRole }>();

  const ok = user ? await verifyPassword(password, user.password_hash) : await verifyDummyPassword(password);
  if (!user || !ok) {
    // The email is never logged: a mistyped password pasted into it would leak.
    logSecurityEvent("auth.login.failed", { reason: "credentials", account: user ? "known" : "unknown", user: user?.id }, request);
    return redirect("/admin?error=invalid");
  }

  // Work-factor migration: a hash made with fewer iterations than new hashes
  // use is replaced now that the password is known. The WHERE on the old value
  // keeps a concurrent reset from being overwritten. A failure leaves the old
  // hash, which still verifies.
  if (passwordNeedsRehash(user.password_hash)) {
    try {
      await db
        .prepare("UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?")
        .bind(await hashPassword(password), user.id, user.password_hash)
        .run();
    } catch {
      // Retried on the next sign-in.
    }
  }

  try {
    await clearAccountAttempts(db, email);
    if (crypto.getRandomValues(new Uint32Array(1))[0] % 20 === 0) await pruneLoginAttempts(db);
  } catch {
    // Housekeeping only; a stale counter expires with its window.
  }

  const session = await createSession(locals, user.id);
  setSessionCookie(cookies, url, session.token, session.expiresAt);
  logSecurityEvent("auth.login.succeeded", { user: user.id }, request);

  return redirect("/admin");
};
