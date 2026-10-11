import type { APIRoute } from "astro";
import { saveContent, type ContentStatus } from "../../../lib/content";
import { WriteValidationError } from "../../../lib/content-writes";
import { ensureRole, sanitizeSlug } from "../../../lib/http";
import { pingIndexNow } from "../../../lib/indexnow";
import { pingWebSub } from "../../../lib/websub";

export const POST: APIRoute = async (context) => {
  const user = ensureRole(context, ["admin", "editor", "author"]);
  if (user instanceof Response) return user;

  const form = await context.request.formData();
  const id = String(form.get("id") ?? "").trim() || undefined;
  const title = String(form.get("title") ?? "").trim();
  const slug = sanitizeSlug(String(form.get("slug") ?? ""));
  const markdown = String(form.get("markdown") ?? "").trim();
  const pageType = String(form.get("pageType") ?? "post").trim().toLowerCase();
  const statusRaw = String(form.get("status") ?? "draft").trim().toLowerCase();
  const status: ContentStatus = statusRaw === "published" ? "published" : "draft";
  const featuredImageUrl = String(form.get("featuredImageUrl") ?? "").trim() || null;
  const homepageFeatured = form.get("homepageFeatured") === "1";
  const homepageGroup = String(form.get("homepageGroup") ?? "other");
  const homepageOrder = Number(form.get("homepageOrder") ?? 0);
  const homepageDescription = String(form.get("homepageDescription") ?? "").trim();

  if (!["wow", "poe2", "other"].includes(homepageGroup) || !Number.isInteger(homepageOrder) || homepageOrder < 0 || homepageOrder > 9999 || homepageDescription.length > 240) {
    return context.redirect(`/admin/content/${id ? encodeURIComponent(id) : "new"}?error=homepage`);
  }

  if (!title || !slug || !markdown) {
    return context.redirect(`/admin/content/${id ? encodeURIComponent(id) : "new"}?error=invalid`);
  }

  const categoryIds = form.getAll("categoryId").map((v) => String(v)).filter(Boolean);

  let savedId: string;
  try {
    savedId = await saveContent(context.locals, {
      id,
      title,
      slug,
      markdown,
      pageType,
      status,
      authorId: user.id,
      featuredImageUrl,
      homepageFeatured,
      homepageGroup,
      homepageOrder,
      homepageDescription,
      categoryIds,
    });
  } catch (error) {
    if (error instanceof WriteValidationError) {
      return context.redirect(`/admin/content/${id ? encodeURIComponent(id) : "new"}?error=invalid`);
    }
    throw error;
  }

  const isProduction = new URL(context.request.url).hostname === "orboro.net";
  if (status === "published" && isProduction) {
    const path = pageType === "post" ? `/blog/${slug}` : `/pages/${slug}`;
    await pingIndexNow([`https://orboro.net${path}`]);
    if (pageType === "post") {
      await pingWebSub("https://orboro.net/rss.xml");
    }
  }

  return context.redirect(`/admin/content/${savedId}?saved=1`);
};
