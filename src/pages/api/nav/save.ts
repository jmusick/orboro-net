import type { APIRoute } from "astro";
import { saveNavItems } from "../../../lib/content";
import { parseNavItems, WriteValidationError } from "../../../lib/content-writes";
import { ensureRole } from "../../../lib/http";

export const POST: APIRoute = async (context) => {
  const access = ensureRole(context, ["admin"]);
  if (access instanceof Response) return access;
  const form = await context.request.formData();
  const raw = String(form.get("navItems") ?? "[]").trim();

  try {
    await saveNavItems(context.locals, parseNavItems(raw));
  } catch (error) {
    if (error instanceof WriteValidationError) return context.redirect("/admin/nav?error=invalid");
    throw error;
  }
  return context.redirect("/admin/nav?saved=1");
};
