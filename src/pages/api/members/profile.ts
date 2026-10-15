import type { APIRoute } from "astro";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, memberDb, readMemberFields } from "../../../lib/member-actions";
import { bioProblem, displayNameProblem, updateMemberProfile } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Updates the signed-in member's own display name and bio. The member ID comes
// from the session, never from the form.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.member, ["displayName", "bio"]);
  if (!fields) return context.redirect("/account?error=invalid#profile");
  const displayName = fields.displayName.trim();
  const bio = fields.bio.replace(/\r\n?/g, "\n").trim();
  const problem = displayNameProblem(displayName) ?? bioProblem(bio);
  if (problem) return context.redirect(`/account?error=${problem}#profile`);

  const db = memberDb();
  const limited = await chargeBudgets(db, [["accountChange", member.id]], context.request, member.id);
  if (limited) return context.redirect(`/account?error=${limited}#profile`);
  await updateMemberProfile(db, member.id, { displayName, bio });
  return context.redirect("/account?saved=profile");
};
