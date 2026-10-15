import type { APIRoute } from "astro";
import { verifyPassword } from "../../../lib/auth";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, emailBinding, memberDb, readMemberFields, siteLink } from "../../../lib/member-actions";
import { buildMemberEmail, sendMemberEmail } from "../../../lib/member-email";
import { MAX_PASSWORD_INPUT_LENGTH, getMemberByEmail, getPasswordHash, issueMemberToken, normalizeEmail } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";
import { logSecurityEvent } from "../../../lib/security-events";

// Starts an email change: the new address gets a confirmation link and the
// account keeps its current address until that link is used. A taken address
// gets the same answer, so this can't be used to look accounts up.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.member, ["email", "password"]);
  if (!fields || fields.password.length > MAX_PASSWORD_INPUT_LENGTH) return context.redirect("/account?error=invalid#email");
  const email = normalizeEmail(fields.email);
  if (!email) return context.redirect("/account?error=email#email");
  if (email === member.email) return context.redirect("/account#email");

  const db = memberDb();
  const limited = await chargeBudgets(db, [["verifyEmail", member.id]], context.request, member.id);
  if (limited) return context.redirect(`/account?error=${limited}#email`);
  const stored = await getPasswordHash(db, member.id);
  if (!stored || !(await verifyPassword(fields.password, stored))) return context.redirect("/account?error=current-password#email");

  if (!(await getMemberByEmail(db, email))) {
    const token = await issueMemberToken(db, member.id, "email", email);
    const sent = await sendMemberEmail(emailBinding(), email, buildMemberEmail("email-change", {
      username: member.username,
      link: siteLink(context.url, "/account/verify", { token, purpose: "email" }),
    }));
    if (!sent) logSecurityEvent("member.email.failed", { reason: "email-change", member: member.id }, context.request);
  }
  return context.redirect("/account?sent=email");
};
