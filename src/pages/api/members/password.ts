import type { APIRoute } from "astro";
import { hashPassword, verifyPassword } from "../../../lib/auth";
import { requireMember } from "../../../lib/http";
import { breachProblem, chargeBudgets, memberDb, readMemberFields, signInMember } from "../../../lib/member-actions";
import { MAX_PASSWORD_INPUT_LENGTH, getPasswordHash, memberPasswordProblem, setMemberPassword } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Changes the member's password after checking the current one. Every session
// is signed out, then this browser gets a fresh one.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.member, ["currentPassword", "newPassword"]);
  if (!fields || fields.currentPassword.length > MAX_PASSWORD_INPUT_LENGTH) return context.redirect("/account?error=invalid#password");

  const db = memberDb();
  const limited = await chargeBudgets(db, [["accountChange", member.id]], context.request, member.id);
  if (limited) return context.redirect(`/account?error=${limited}#password`);

  const stored = await getPasswordHash(db, member.id);
  if (!stored || !(await verifyPassword(fields.currentPassword, stored))) return context.redirect("/account?error=current-password#password");
  if (memberPasswordProblem(fields.newPassword, { email: member.email, username: member.username })) return context.redirect("/account?error=password#password");
  if (await breachProblem(fields.newPassword, context.request)) return context.redirect("/account?error=breached#password");

  await setMemberPassword(db, member.id, await hashPassword(fields.newPassword));
  await signInMember(db, context.cookies, context.url, member.id);
  return context.redirect("/account?saved=password");
};
