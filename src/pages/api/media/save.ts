import type { APIRoute } from "astro";
import { saveMedia } from "../../../lib/content";
import { WriteValidationError } from "../../../lib/content-writes";
import { ensureRole } from "../../../lib/http";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const user = ensureRole(context, ["admin", "editor"]);
  if (user instanceof Response) return user;

  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.record });
  if (!body.ok) return bodyRejection(body);
  const url = formText(body.form, "url");
  const altText = formText(body.form, "altText");
  const caption = formText(body.form, "caption");
  if (url === null || altText === null || caption === null) {
    return context.redirect("/admin/media?form=url&error=invalid");
  }

  try {
    // saveMedia validates the URL scheme and field lengths before writing.
    await saveMedia(context.locals, {
      url: url.trim(),
      altText: altText.trim(),
      caption: caption.trim(),
      createdBy: user.id,
    });
  } catch (error) {
    if (error instanceof WriteValidationError) return context.redirect("/admin/media?form=url&error=invalid");
    throw error;
  }

  return context.redirect("/admin/media");
};
