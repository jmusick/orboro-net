import type { APIRoute } from "astro";
import { hashPassword } from "../../../lib/auth";
import { breachProblem, chargeBudgets, clientIp, emailBinding, memberDb, readMemberFields, siteLink, turnstileSecret } from "../../../lib/member-actions";
import { buildMemberEmail, sendMemberEmail } from "../../../lib/member-email";
import { createMember, getMemberByEmail, issueMemberToken, memberPasswordProblem, normalizeEmail, usernameProblem } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";
import { logSecurityEvent } from "../../../lib/security-events";
import { TURNSTILE_FIELD, verifyTurnstile } from "../../../lib/turnstile";

// Registration answers "check your email" whether the address is new or
// already has an account (its owner gets a notice instead), so the form can't
// be used to find out who has an account. Usernames are public, so a taken
// username is reported directly.
export const POST: APIRoute = async ({ request, url, redirect }) => {
  const back = (code: string) => redirect(`/account/register?error=${code}`);
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["username", "email", "password", TURNSTILE_FIELD]);
  if (!fields) return back("invalid");

  const db = memberDb();
  const limited = await chargeBudgets(db, [["registerIp", clientIp(request)]], request);
  if (limited) return back(limited);

  const turnstile = await verifyTurnstile(fields[TURNSTILE_FIELD], {
    secret: turnstileSecret(),
    action: "register",
    remoteIp: request.headers.get("cf-connecting-ip"),
  });
  if (!turnstile.ok) {
    logSecurityEvent("member.turnstile.failed", { reason: turnstile.reason }, request);
    return back(turnstile.reason === "unavailable" || turnstile.reason === "unconfigured" ? "unavailable" : "challenge");
  }

  const username = fields.username.trim();
  const usernameIssue = usernameProblem(username);
  if (usernameIssue) return back(usernameIssue);
  const email = normalizeEmail(fields.email);
  if (!email) return back("email");
  if (memberPasswordProblem(fields.password, { email, username })) return back("password");
  if (await breachProblem(fields.password, request)) return back("breached");

  // Hashed on every path so timing doesn't reveal whether the email exists.
  const passwordHash = await hashPassword(fields.password);
  const created = await createMember(db, { username, email, passwordHash });
  if (!created.ok && created.reason === "username-taken") return back("username-taken");

  if (created.ok) {
    const token = await issueMemberToken(db, created.id, "verify", email);
    const sent = await sendMemberEmail(emailBinding(), email, buildMemberEmail("verify", {
      username,
      link: siteLink(url, "/account/verify", { token }),
    }));
    logSecurityEvent("member.registered", { member: created.id }, request);
    if (!sent) logSecurityEvent("member.email.failed", { reason: "verify", member: created.id }, request);
  } else {
    const existing = await getMemberByEmail(db, email);
    if (existing && existing.status === "active") {
      const token = await issueMemberToken(db, existing.id, "reset", email);
      const sent = await sendMemberEmail(emailBinding(), email, buildMemberEmail("already-registered", {
        username: existing.username,
        link: siteLink(url, "/account/reset", { token }),
      }));
      if (!sent) logSecurityEvent("member.email.failed", { reason: "already-registered", member: existing.id }, request);
    }
  }
  return redirect("/account/register?sent=1");
};
