import type { APIRoute } from "astro";
import { saveNavItems } from "../../../lib/content";
import { parseNavItems, WriteValidationError } from "../../../lib/content-writes";
import { ensureRole } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const access = ensureRole(context, ["admin"]);
  if (access instanceof Response) return access;
  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.nav });
  if (!body.ok) return bodyRejection(body);
  const value = formText(body.form, "navItems");
  if (value === null) return context.redirect("/admin/nav?error=invalid");
  const raw = body.form.has("navItems") ? value.trim() : "[]";

  try {
    await saveNavItems(context.locals, parseNavItems(raw));
  } catch (error) {
    if (error instanceof WriteValidationError) return context.redirect("/admin/nav?error=invalid");
    throw error;
  }
  return context.redirect("/admin/nav?saved=1");
};
