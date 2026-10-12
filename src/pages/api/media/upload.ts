import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { saveMedia } from "../../../lib/content";
import { MAX_ALT_TEXT_LENGTH, MAX_CAPTION_LENGTH } from "../../../lib/content-writes";
import { identifyImage, MAX_MEDIA_BYTES, MAX_UPLOAD_BODY_BYTES, mediaUrlForRequest } from "../../../lib/media-upload";
import { MULTIPART, formText, readBoundedForm } from "../../../lib/request-limits";

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return context.redirect("/admin");
  if (user.role !== "admin" && user.role !== "editor") {
    return context.redirect("/admin?error=forbidden");
  }

  // The streamed body is bounded before parsing, with or without Content-Length.
  const body = await readBoundedForm(context.request, {
    maxBytes: MAX_UPLOAD_BODY_BYTES,
    types: [MULTIPART],
    maxFields: 8,
  });
  if (!body.ok) {
    return context.redirect(`/admin/media?form=upload&error=${body.status === 413 ? "too-large" : "invalid"}`);
  }
  const form = body.form;
  const files = form.getAll("file");
  const file = files.length === 1 ? files[0] : null;
  const altText = formText(form, "altText")?.trim() ?? "";
  const caption = formText(form, "caption")?.trim();

  if (!(file instanceof File) || !altText || altText.length > MAX_ALT_TEXT_LENGTH
      || caption === undefined || caption.length > MAX_CAPTION_LENGTH) {
    return context.redirect("/admin/media?form=upload&error=invalid");
  }
  if (file.size === 0) {
    return context.redirect("/admin/media?form=upload&error=invalid");
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return context.redirect("/admin/media?form=upload&error=too-large");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = identifyImage(bytes);
  if (!image) {
    return context.redirect("/admin/media?form=upload&error=unsupported");
  }

  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${image.extension}`;
  const url = mediaUrlForRequest(context.url, key);

  try {
    await env.MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType: image.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    try {
      await saveMedia(context.locals, { url, altText, caption, createdBy: user.id });
    } catch (error) {
      await env.MEDIA.delete(key);
      throw error;
    }
  } catch (error) {
    console.error("Media upload failed", { error });
    return context.redirect("/admin/media?form=upload&error=upload-failed");
  }

  return context.redirect("/admin/media?uploaded=1");
};
