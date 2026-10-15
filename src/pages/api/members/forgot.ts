import type { APIRoute } from "astro";
import { chargeBudgets, clientIp, emailBinding, memberDb, readMemberFields, siteLink, turnstileSecret } from "../../../lib/member-actions";
import { buildMemberEmail, sendMemberEmail } from "../../../lib/member-email";
import { getMemberByEmail, issueMemberToken, normalizeEmail } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";
import { logSecurityEvent } from "../../../lib/security-events";
import { TURNSTILE_FIELD, verifyTurnstile } from "../../../lib/turnstile";

// Emails a reset link. The answer is the same whether or not the address has
// an account, so the form can't be used to look accounts up.
export const POST: APIRoute = async ({ request, url, redirect }) => {
  const back = (code: string) => redirect(`/account/forgot?error=${code}`);
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["email", TURNSTILE_FIELD]);
  if (!fields) return back("invalid");
  const email = normalizeEmail(fields.email);
  if (!email) return back("email");

  const db = memberDb();
  const limited = await chargeBudgets(db, [["resetIp", clientIp(request)], ["resetAccount", email]], request);
  if (limited) return back(limited);

  const turnstile = await verifyTurnstile(fields[TURNSTILE_FIELD], {
    secret: turnstileSecret(),
    action: "reset",
    remoteIp: request.headers.get("cf-connecting-ip"),
  });
  if (!turnstile.ok) {
    logSecurityEvent("member.turnstile.failed", { reason: turnstile.reason }, request);
    return back(turnstile.reason === "unavailable" || turnstile.reason === "unconfigured" ? "unavailable" : "challenge");
  }

  const member = await getMemberByEmail(db, email);
  if (member && member.status === "active") {
    const token = await issueMemberToken(db, member.id, "reset", email);
    const sent = await sendMemberEmail(emailBinding(), email, buildMemberEmail("reset", {
      username: member.username,
      link: siteLink(url, "/account/reset", { token }),
    }));
    if (!sent) logSecurityEvent("member.email.failed", { reason: "reset", member: member.id }, request);
  }
  return redirect("/account/forgot?sent=1");
};
