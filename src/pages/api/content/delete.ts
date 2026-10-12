import type { APIRoute } from "astro";
import { deleteContentById } from "../../../lib/content";
import { parseRecordId } from "../../../lib/content-writes";
import { requireAdmin } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const access = requireAdmin(context);
  if (access instanceof Response) return access;

  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.small });
  if (!body.ok) return bodyRejection(body);
  const id = parseRecordId(formText(body.form, "id"));
  if (!id) {
    return context.redirect("/admin/content?error=invalid");
  }

  await deleteContentById(context.locals, id);
  return context.redirect("/admin/content");
};
