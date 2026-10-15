import type { APIRoute } from "astro";
import { requireMember } from "../../../lib/http";
import { clearMemberCookie } from "../../../lib/member-cookie";
import { memberDb } from "../../../lib/member-actions";
import { revokeMemberSessions } from "../../../lib/members";

// Signs the member out on every device, this one included.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context, { verified: false });
  if (member instanceof Response) return member;
  await revokeMemberSessions(memberDb(), member.id);
  clearMemberCookie(context.cookies, context.url);
  return context.redirect("/account/login?signedout=all");
};
