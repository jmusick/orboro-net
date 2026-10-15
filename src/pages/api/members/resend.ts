import type { APIRoute } from "astro";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, emailBinding, memberDb, siteLink } from "../../../lib/member-actions";
import { buildMemberEmail, sendMemberEmail } from "../../../lib/member-email";
import { issueMemberToken } from "../../../lib/members";
import { logSecurityEvent } from "../../../lib/security-events";

// Sends a fresh verification link to the signed-in member's own address.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;
  if (member.emailVerified) return context.redirect("/account");

  const db = memberDb();
  const limited = await chargeBudgets(db, [["verifyEmail", member.id]], context.request, member.id);
  if (limited) return context.redirect(`/account?error=${limited}`);

  const token = await issueMemberToken(db, member.id, "verify", member.email);
  const sent = await sendMemberEmail(emailBinding(), member.email, buildMemberEmail("verify", {
    username: member.username,
    link: siteLink(context.url, "/account/verify", { token }),
  }));
  if (!sent) {
    logSecurityEvent("member.email.failed", { reason: "verify", member: member.id }, context.request);
    return context.redirect("/account?error=email-failed");
  }
  return context.redirect("/account?sent=verify");
};
