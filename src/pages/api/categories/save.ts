import type { APIRoute } from "astro";
import { saveCategory } from "../../../lib/content";
import { WriteValidationError } from "../../../lib/content-writes";
import { requireAdmin, sanitizeSlug } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const access = requireAdmin(context);
  if (access instanceof Response) return access;
  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.record });
  if (!body.ok) return bodyRejection(body);
  const form = body.form;
  const rawId = formText(form, "id");
  const name = formText(form, "name");
  const slug = formText(form, "slug");
  const id = rawId?.trim() || undefined;
  const editor = `/admin/categories/${id ? encodeURIComponent(id) : "new"}?error=invalid`;
  if (rawId === null || name === null || slug === null) return context.redirect(editor);

  let savedId: string;
  try {
    savedId = await saveCategory(context.locals, { id, name: name.trim(), slug: sanitizeSlug(slug) });
  } catch (error) {
    if (error instanceof WriteValidationError) return context.redirect(editor);
    throw error;
  }
  return context.redirect(`/admin/categories/${encodeURIComponent(savedId)}?saved=1`);
};
