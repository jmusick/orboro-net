import type { APIRoute } from "astro";
import { verifyPassword } from "../../../lib/auth";
import { requireMember } from "../../../lib/http";
import { clearMemberCookie } from "../../../lib/member-cookie";
import { memberDb, readMemberFields } from "../../../lib/member-actions";
import { MAX_PASSWORD_INPUT_LENGTH, deleteMember, getPasswordHash } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Deletes the member's own account after confirming the password. Comments
// stay in their threads as [deleted] with their text erased.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.member, ["password"]);
  if (!fields || fields.password.length > MAX_PASSWORD_INPUT_LENGTH) return context.redirect("/account?error=invalid#delete");
  const db = memberDb();
  const stored = await getPasswordHash(db, member.id);
  if (!stored || !(await verifyPassword(fields.password, stored))) return context.redirect("/account?error=current-password#delete");

  context.locals.auditTarget = member.id;
  await deleteMember(db, member.id);
  clearMemberCookie(context.cookies, context.url);
  return context.redirect("/account/login?deleted=1");
};
