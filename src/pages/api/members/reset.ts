import type { APIRoute } from "astro";
import { hashPassword } from "../../../lib/auth";
import { breachProblem, memberDb, readMemberFields } from "../../../lib/member-actions";
import { consumeMemberToken, getMemberById, markEmailVerified, memberPasswordProblem, peekMemberToken, setMemberPassword } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Sets a new password from an emailed reset link. The password is checked
// before the token is spent, so a rejected password doesn't use up the link.
// Resetting signs the member out everywhere; the link also proves the
// address, so an unverified account becomes verified.
export const POST: APIRoute = async (context) => {
  const { request, redirect } = context;
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["token", "password"]);
  if (!fields) return redirect("/account/reset?error=invalid");
  const back = (code: string) => redirect(`/account/reset?token=${encodeURIComponent(fields.token)}&error=${code}`);

  const db = memberDb();
  const pending = await peekMemberToken(db, fields.token, "reset");
  const member = pending ? await getMemberById(db, pending.memberId) : null;
  if (!pending || !member || member.status !== "active") return redirect("/account/reset?error=expired");
  context.locals.auditTarget = member.id;

  if (memberPasswordProblem(fields.password, { email: member.email, username: member.username })) return back("password");
  if (await breachProblem(fields.password, request)) return back("breached");
  const passwordHash = await hashPassword(fields.password);

  const spent = await consumeMemberToken(db, fields.token, "reset");
  if (!spent || spent.memberId !== member.id) return redirect("/account/reset?error=expired");
  await setMemberPassword(db, member.id, passwordHash);
  await markEmailVerified(db, member.id, spent.email);
  return redirect("/account/login?reset=1");
};
