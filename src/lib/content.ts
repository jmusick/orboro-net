import {
  replaceNavItems,
  saveContentWithCategories,
  type ContentWriteInput,
  type NavItemInput,
  type WriteDB,
} from "./content-writes";
import { ensureDB, getDB } from "./db";

export type ContentStatus = "draft" | "published";

export interface ContentRecord {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  pageType: string;
  status: ContentStatus;
  authorId: string;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  featuredImageUrl: string | null;
  homepageFeatured: boolean;
  homepageGroup: string;
  homepageOrder: number;
  homepageDescription: string;
}

export interface MediaRecord {
  id: string;
  url: string;
  altText: string;
  caption: string | null;
  createdBy: string;
  createdAt: number;
}

function mapContentRow(row: any): ContentRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    markdown: row.markdown,
    pageType: row.page_type,
    status: row.status,
    authorId: row.author_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    featuredImageUrl: row.featured_image_url,
    homepageFeatured: row.homepage_featured === 1,
    homepageGroup: row.homepage_group ?? "other",
    homepageOrder: row.homepage_order ?? 0,
    homepageDescription: row.homepage_description ?? "",
  };
}

export async function getPublishedContentByType(
  locals: App.Locals,
  pageType: string,
  limit = 20
): Promise<ContentRecord[]> {
  const db = getDB(locals);
  if (!db) return [];

  const result = await db
    .prepare(
      `SELECT * FROM content
       WHERE page_type = ? AND status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`
    )
    .bind(pageType, limit)
    .all();

  return (result.results ?? []).map(mapContentRow);
}

export function excerptFromMarkdown(markdown: string, maxLen = 155): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s+[^\n]*/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/^\s*[-*+>|]\s*/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

export async function listHomepageFeatures(locals: App.Locals): Promise<ContentRecord[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db.prepare(
    `SELECT * FROM content
     WHERE page_type = 'page' AND status = 'published' AND homepage_featured = 1
     ORDER BY homepage_order ASC, title COLLATE NOCASE ASC, id ASC`,
  ).all();
  return (result.results ?? []).map(mapContentRow);
}

export type PostSummary = Pick<ContentRecord, 'slug' | 'title' | 'publishedAt' | 'createdAt'>;

// Sidebars and adjacent-post links never need article bodies or image metadata.
export async function listPostSummaries(locals: App.Locals, limit = 5): Promise<PostSummary[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db.prepare(
    `SELECT slug, title, published_at, created_at FROM content
     WHERE page_type = 'post' AND status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?`,
  ).bind(limit).all<{ slug: string; title: string; published_at: number | null; created_at: number }>();
  return (result.results ?? []).map(row => ({ slug: row.slug, title: row.title, publishedAt: row.published_at, createdAt: row.created_at }));
}

export async function getPublishedBySlugAndType(
  locals: App.Locals,
  slug: string,
  pageType: string
): Promise<ContentRecord | null> {
  const db = getDB(locals);
  if (!db) return null;

  const row = await db
    .prepare("SELECT * FROM content WHERE slug = ? AND page_type = ? AND status = 'published' LIMIT 1")
    .bind(slug, pageType)
    .first();

  return row ? mapContentRow(row) : null;
}

export async function listAdminContent(locals: App.Locals): Promise<ContentRecord[]> {
  const db = ensureDB(locals);
  const result = await db
    .prepare("SELECT * FROM content ORDER BY updated_at DESC LIMIT 200")
    .all();
  return (result.results ?? []).map(mapContentRow);
}

export async function getContentById(locals: App.Locals, id: string): Promise<ContentRecord | null> {
  const db = ensureDB(locals);
  const row = await db.prepare("SELECT * FROM content WHERE id = ? LIMIT 1").bind(id).first();
  return row ? mapContentRow(row) : null;
}

export async function saveContent(
  locals: App.Locals,
  input: ContentWriteInput
): Promise<string> {
  return saveContentWithCategories(ensureDB(locals) as unknown as WriteDB, input, Date.now());
}

export async function deleteContentById(locals: App.Locals, id: string): Promise<void> {
  const db = ensureDB(locals);
  await db.prepare("DELETE FROM content WHERE id = ?").bind(id).run();
}

export async function listMedia(locals: App.Locals): Promise<MediaRecord[]> {
  const db = ensureDB(locals);
  const result = await db
    .prepare("SELECT * FROM media ORDER BY created_at DESC LIMIT 300")
    .all();

  return (result.results ?? []).map((row: any) => ({
    id: row.id,
    url: row.url,
    altText: row.alt_text,
    caption: row.caption,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function saveMedia(
  locals: App.Locals,
  input: { url: string; altText: string; caption?: string; createdBy: string }
): Promise<void> {
  const db = ensureDB(locals);
  await db
    .prepare(
      "INSERT INTO media (id, url, alt_text, caption, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), input.url, input.altText, input.caption ?? null, input.createdBy, Date.now())
    .run();
}

export async function deleteMediaById(locals: App.Locals, id: string): Promise<void> {
  const db = ensureDB(locals);
  await db.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
}

// ─── Categories ───────────────────────────────────────────────

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
}

export async function listCategories(locals: App.Locals): Promise<CategoryRecord[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
  return (result.results ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  }));
}

export interface CategoryWithCount extends CategoryRecord {
  postCount: number;
}

export async function listCategoriesWithPostCounts(
  locals: App.Locals,
  pageType = "post"
): Promise<CategoryWithCount[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT cat.id, cat.name, cat.slug, cat.created_at, COUNT(c.id) AS post_count
       FROM categories cat
       INNER JOIN content_categories cc ON cc.category_id = cat.id
       INNER JOIN content c ON c.id = cc.content_id
       WHERE c.status = 'published' AND c.page_type = ?
       GROUP BY cat.id
       ORDER BY cat.name ASC`
    )
    .bind(pageType)
    .all<{ id: string; name: string; slug: string; created_at: number; post_count: number }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
    postCount: row.post_count,
  }));
}

export async function getCategoryById(locals: App.Locals, id: string): Promise<CategoryRecord | null> {
  const db = ensureDB(locals);
  const row = await db.prepare("SELECT * FROM categories WHERE id = ? LIMIT 1").bind(id).first<any>();
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

export async function saveCategory(
  locals: App.Locals,
  input: { id?: string; name: string; slug: string }
): Promise<string> {
  const db = ensureDB(locals);
  if (input.id) {
    await db
      .prepare("UPDATE categories SET name = ?, slug = ? WHERE id = ?")
      .bind(input.name, input.slug, input.id)
      .run();
    return input.id;
  }
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO categories (id, name, slug, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, input.name, input.slug, Date.now())
    .run();
  return id;
}

export async function deleteCategoryById(locals: App.Locals, id: string): Promise<void> {
  const db = ensureDB(locals);
  await db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
}

export async function getContentCategoryIds(locals: App.Locals, contentId: string): Promise<string[]> {
  const db = ensureDB(locals);
  const result = await db
    .prepare("SELECT category_id FROM content_categories WHERE content_id = ?")
    .bind(contentId)
    .all<{ category_id: string }>();
  return (result.results ?? []).map((r) => r.category_id);
}

export async function getContentCategories(
  locals: App.Locals,
  contentId: string
): Promise<CategoryRecord[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT cat.id, cat.name, cat.slug, cat.created_at
       FROM categories cat
       INNER JOIN content_categories cc ON cc.category_id = cat.id
       WHERE cc.content_id = ?
       ORDER BY cat.name ASC`
    )
    .bind(contentId)
    .all<{ id: string; name: string; slug: string; created_at: number }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  }));
}

export async function listContentCategoryNames(locals: App.Locals): Promise<Record<string, string[]>> {
  const db = getDB(locals);
  if (!db) return {};
  const result = await db
    .prepare(
      `SELECT cc.content_id, c.name
       FROM content_categories cc
       INNER JOIN categories c ON c.id = cc.category_id
       ORDER BY c.name ASC`
    )
    .all<{ content_id: string; name: string }>();
  const map: Record<string, string[]> = {};
  for (const row of result.results ?? []) {
    if (!map[row.content_id]) map[row.content_id] = [];
    map[row.content_id].push(row.name);
  }
  return map;
}

export async function getCategoryBySlug(locals: App.Locals, slug: string): Promise<CategoryRecord | null> {
  const db = getDB(locals);
  if (!db) return null;
  const row = await db.prepare("SELECT * FROM categories WHERE slug = ? LIMIT 1").bind(slug).first<any>();
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

export async function getPublishedContentByCategory(
  locals: App.Locals,
  categorySlug: string,
  pageType?: string
): Promise<ContentRecord[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = pageType
    ? await db
        .prepare(
          `SELECT c.* FROM content c
           INNER JOIN content_categories cc ON cc.content_id = c.id
           INNER JOIN categories cat ON cat.id = cc.category_id
           WHERE cat.slug = ? AND c.status = 'published' AND c.page_type = ?
           ORDER BY COALESCE(c.published_at, c.created_at) DESC LIMIT 60`
        )
        .bind(categorySlug, pageType)
        .all()
    : await db
        .prepare(
          `SELECT c.* FROM content c
           INNER JOIN content_categories cc ON cc.content_id = c.id
           INNER JOIN categories cat ON cat.id = cc.category_id
           WHERE cat.slug = ? AND c.status = 'published'
           ORDER BY COALESCE(c.published_at, c.created_at) DESC LIMIT 60`
        )
        .bind(categorySlug)
        .all();
  return (result.results ?? []).map(mapContentRow);
}

// ─── Navigation ───────────────────────────────────────────────

export interface NavItemRecord {
  id: string;
  label: string;
  contentId: string | null;
  url: string;
  sortOrder: number;
  parentItemId: string | null;
}

function contentPageUrl(pageType: string, slug: string): string {
  return pageType === "post" ? `/blog/${slug}` : `/pages/${slug}`;
}

export async function listNavItems(locals: App.Locals): Promise<NavItemRecord[]> {
  const db = getDB(locals);
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT nav_items.id, nav_items.label, nav_items.content_id,
              nav_items.sort_order, nav_items.parent_item_id,
              content.slug AS content_slug, content.page_type AS content_page_type
       FROM nav_items
       LEFT JOIN content ON content.id = nav_items.content_id
       ORDER BY nav_items.sort_order ASC`
    )
    .all<any>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    contentId: row.content_id ?? null,
    url: contentPageUrl(row.content_page_type ?? "page", row.content_slug ?? ""),
    sortOrder: row.sort_order,
    parentItemId: row.parent_item_id ?? null,
  }));
}

// Replaces the whole tree atomically; throws WriteValidationError on bad input.
export async function saveNavItems(locals: App.Locals, items: NavItemInput[]): Promise<void> {
  await replaceNavItems(ensureDB(locals) as unknown as WriteDB, items, Date.now());
}
