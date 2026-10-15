import type { APIRoute } from "astro";
import { hashPassword, passwordNeedsRehash, verifyDummyPassword, verifyPassword } from "../../../lib/auth";
import { chargeBudgets, clientIp, memberDb, readMemberFields, safeNext, signInMember } from "../../../lib/member-actions";
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_INPUT_LENGTH, findMemberForLogin, rehashMemberPassword } from "../../../lib/members";
import { clearRateLimit } from "../../../lib/rate-limits";
import { BODY_LIMITS } from "../../../lib/request-limits";
import { logSecurityEvent } from "../../../lib/security-events";

// Member sign-in by username or email. Same shape as the admin login: budgets
// charged before password work, unknown accounts pay the same PBKDF2 cost,
// and one generic failure message.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["login", "password", "next"]);
  const next = safeNext(fields?.next);
  const back = (code: string) => redirect(`/account/login?error=${code}${next !== "/account" ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (!fields) return back("invalid");
  const login = fields.login.trim().toLowerCase();
  const password = fields.password;
  if (!login || !password || login.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_INPUT_LENGTH) {
    logSecurityEvent("member.login.failed", { reason: "malformed" }, request);
    return back("invalid");
  }

  const db = memberDb();
  const limited = await chargeBudgets(db, [["memberLoginIp", clientIp(request)], ["memberLoginAccount", login]], request);
  if (limited) return back(limited);

  const member = await findMemberForLogin(db, login);
  const ok = member ? await verifyPassword(password, member.passwordHash) : await verifyDummyPassword(password);
  if (!member || !ok) {
    // Neither the login name nor the password is logged.
    logSecurityEvent("member.login.failed", { reason: "credentials", account: member ? "known" : "unknown", member: member?.id }, request);
    return back("invalid");
  }
  if (member.status !== "active") {
    logSecurityEvent("member.login.failed", { reason: "suspended", member: member.id }, request);
    return back("suspended");
  }

  if (passwordNeedsRehash(member.passwordHash)) {
    try {
      await rehashMemberPassword(db, member.id, member.passwordHash, await hashPassword(password));
    } catch {
      // Retried on the next sign-in.
    }
  }
  try {
    await clearRateLimit(db, "memberLoginAccount", login);
  } catch {
    // Housekeeping only; the window expires on its own.
  }

  await signInMember(db, cookies, url, member.id);
  logSecurityEvent("member.login.succeeded", { member: member.id }, request);
  return redirect(next);
};
