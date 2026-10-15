import type { APIRoute } from "astro";
import { clearMemberCookie, readMemberCookie } from "../../../lib/member-cookie";
import { memberDb, readMemberFields, safeNext } from "../../../lib/member-actions";
import { revokeMemberSession } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Any member session may end itself; there is nothing else to guard.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["next"]);
  const token = readMemberCookie(cookies, url);
  if (token) await revokeMemberSession(memberDb(), token);
  clearMemberCookie(cookies, url);
  return redirect(safeNext(fields?.next, "/"));
};
