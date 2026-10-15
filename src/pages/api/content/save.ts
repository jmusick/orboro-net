import type { APIRoute } from "astro";
import { saveContent, type ContentStatus } from "../../../lib/content";
import { WriteValidationError } from "../../../lib/content-writes";
import { requireAdmin, sanitizeSlug } from "../../../lib/http";
import { pingIndexNow } from "../../../lib/indexnow";
import { BODY_LIMITS, bodyRejection, formText, readBoundedForm } from "../../../lib/request-limits";
import { pingWebSub } from "../../../lib/websub";

const TEXT_FIELDS = [
  "id", "title", "slug", "markdown", "pageType", "status", "featuredImageUrl",
  "homepageFeatured", "homepageGroup", "homepageOrder", "homepageDescription", "commentsMode",
] as const;

export const POST: APIRoute = async (context) => {
  const user = requireAdmin(context);
  if (user instanceof Response) return user;

  const body = await readBoundedForm(context.request, { maxBytes: BODY_LIMITS.content });
  if (!body.ok) return bodyRejection(body);
  const form = body.form;

  const text = {} as Record<(typeof TEXT_FIELDS)[number], string>;
  let malformed = false;
  for (const name of TEXT_FIELDS) {
    const value = formText(form, name);
    if (value === null) malformed = true;
    text[name] = value ?? "";
  }

  const id = text.id.trim() || undefined;
  context.locals.auditTarget = id;
  const editor = (code: string) => `/admin/content/${id ? encodeURIComponent(id) : "new"}?error=${code}`;
  if (malformed) return context.redirect(editor("invalid"));

  const title = text.title.trim();
  const slug = sanitizeSlug(text.slug);
  const markdown = text.markdown.trim();
  const pageType = (text.pageType || "post").trim().toLowerCase();
  const status = (text.status || "draft").trim().toLowerCase() as ContentStatus;
  const featuredImageUrl = text.featuredImageUrl.trim() || null;
  const homepageFeatured = text.homepageFeatured === "1";
  const homepageGroup = text.homepageGroup || "other";
  const homepageOrder = text.homepageOrder.trim() === "" ? 0 : Number(text.homepageOrder);
  const homepageDescription = text.homepageDescription.trim();
  const commentsMode = text.commentsMode || "open";
  const categoryValues = form.getAll("categoryId");
  if (categoryValues.some((v) => typeof v !== "string")) return context.redirect(editor("invalid"));
  const categoryIds = categoryValues.map((v) => String(v).trim()).filter(Boolean);

  let savedId: string;
  try {
    // saveContent validates every field, the edited row, slug uniqueness and
    // the categories before anything is written.
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
      commentsMode,
      categoryIds,
    });
  } catch (error) {
    if (error instanceof WriteValidationError) return context.redirect(editor(error.code));
    throw error;
  }
  context.locals.auditTarget = savedId;

  const isProduction = new URL(context.request.url).hostname === "orboro.net";
  if (status === "published" && isProduction) {
    const path = pageType === "post" ? `/blog/${slug}` : `/pages/${slug}`;
    await pingIndexNow([`https://orboro.net${path}`]);
    if (pageType === "post") {
      await pingWebSub("https://orboro.net/rss.xml");
    }
  }

  return context.redirect(`/admin/content/${encodeURIComponent(savedId)}?saved=1`);
};
