import type { APIRoute } from "astro";
import { deleteCategoryById } from "../../../lib/content";
import { parseRecordId } from "../../../lib/content-writes";
import { ensureRole } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const access = ensureRole(context, ["admin"]);
  if (access instanceof Response) return access;
  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.small });
  if (!body.ok) return bodyRejection(body);
  const id = parseRecordId(formText(body.form, "id"));
  if (!id) return context.redirect("/admin/categories?error=invalid");
  await deleteCategoryById(context.locals, id);
  return context.redirect("/admin/categories");
};
