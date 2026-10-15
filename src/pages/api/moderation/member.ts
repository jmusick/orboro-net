import type { APIRoute } from "astro";
import { parseRecordId } from "../../../lib/content-writes";
import { ensureDB } from "../../../lib/db";
import { requireAdmin } from "../../../lib/http";
import { MEMBER_ADMIN_ACTIONS, adminMemberAction, type MemberAdminAction } from "../../../lib/members";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

// Admin account management for one member: suspend (signed out at once, can't
// sign in again), reinstate, mark the email verified, sign out everywhere, or
// delete the account (comments stay as [deleted] with their text erased).
export const POST: APIRoute = async (context) => {
  const user = requireAdmin(context);
  if (user instanceof Response) return user;

  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.small });
  if (!body.ok) return bodyRejection(body);
  const id = parseRecordId(formText(body.form, "id"));
  const action = formText(body.form, "action") ?? "";
  if (!id || !(MEMBER_ADMIN_ACTIONS as readonly string[]).includes(action)) return context.redirect("/admin/members?error=invalid");
  context.locals.auditTarget = id;

  const found = await adminMemberAction(ensureDB(context.locals), id, action as MemberAdminAction);
  if (!found) return context.redirect("/admin/members?error=missing");
  if (action === "delete") return context.redirect("/admin/members?done=delete");
  return context.redirect(`/admin/members/${encodeURIComponent(id)}?done=${action}`);
};
