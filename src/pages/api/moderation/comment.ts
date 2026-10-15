import type { APIRoute } from "astro";
import { MODERATION_ACTIONS, moderateComment, type ModerationAction } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { ensureDB } from "../../../lib/db";
import { requireAdmin } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

// Admin moderation of one comment: remove, restore, or dismiss its reports.
export const POST: APIRoute = async (context) => {
  const user = requireAdmin(context);
  if (user instanceof Response) return user;

  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.small });
  if (!body.ok) return bodyRejection(body);
  const id = parseRecordId(formText(body.form, "id"));
  const action = formText(body.form, "action") ?? "";
  // Return to the list the action came from: a member's page or a comments view.
  const memberId = parseRecordId(formText(body.form, "memberId"));
  const view = formText(body.form, "view") === "recent" ? "recent" : "reports";
  const back = memberId ? `/admin/members/${encodeURIComponent(memberId)}?` : `/admin/comments?view=${view}&`;
  if (!id || !(MODERATION_ACTIONS as readonly string[]).includes(action)) return context.redirect(`${back}error=invalid`);
  context.locals.auditTarget = id;

  const found = await moderateComment(ensureDB(context.locals), id, action as ModerationAction);
  if (!found) return context.redirect(`${back}error=missing`);
  return context.redirect(`${back}done=${action}`);
};
