import type { APIRoute } from "astro";
import { createSession, setSessionCookie, verifyDummyPassword, verifyPassword } from "../../../lib/auth";
import { ensureDB } from "../../../lib/db";
import {
  MAX_EMAIL_LENGTH,
  MAX_LOGIN_BODY_BYTES,
  MAX_PASSWORD_LENGTH,
  clearAccountAttempts,
  pruneLoginAttempts,
  reserveLoginAttempt,
} from "../../../lib/login-throttle";

function refusal(status: number, message: string, retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return new Response(message, { status, headers });
}

export const POST: APIRoute = async ({ request, locals, cookies, url, redirect }) => {
  // Bound the body before parsing it or doing any hashing work.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared > MAX_LOGIN_BODY_BYTES) {
    return refusal(413, "Request too large.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin?error=invalid");
  }
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
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
    return refusal(503, "Sign-in is temporarily unavailable. Try again shortly.", 30);
  }
  if (!throttle.allowed) {
    return refusal(429, "Too many sign-in attempts. Try again later.", throttle.retryAfterSeconds);
  }

  const user = await db
    .prepare("SELECT id, password_hash, role FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<{ id: string; password_hash: string; role: UserRole }>();

  const ok = user ? await verifyPassword(password, user.password_hash) : await verifyDummyPassword(password);
  if (!user || !ok) {
    return redirect("/admin?error=invalid");
  }

  try {
    await clearAccountAttempts(db, email);
    if (crypto.getRandomValues(new Uint32Array(1))[0] % 20 === 0) await pruneLoginAttempts(db);
  } catch {
    // Housekeeping only; a stale counter expires with its window.
  }

  const session = await createSession(locals, user.id);
  setSessionCookie(cookies, url, session.token, session.expiresAt);

  return redirect("/admin");
};
