import { excerptFromMarkdown } from "./excerpt.ts";

// Cards show ~140 characters of plain text. Markdown syntax, headings and code
// fences are stripped first, so read a generous bounded prefix instead of the
// whole article body. Search matches the same prefix, not the full text.
export const EXCERPT_SOURCE_CHARS = 1200;
export const EXCERPT_CHARS = 140;
// 12 divides evenly into the 1-, 2- and 3-column grid layouts.
export const BLOG_PAGE_SIZE = 12;
export const MAX_QUERY_CHARS = 100;

export const BLOG_SORTS = ["newest", "oldest", "title-asc", "title-desc"] as const;
export type BlogSort = (typeof BLOG_SORTS)[number];

const ORDER_BY: Record<BlogSort, string> = {
  newest: "COALESCE(c.published_at, c.created_at) DESC, c.id DESC",
  oldest: "COALESCE(c.published_at, c.created_at) ASC, c.id ASC",
  "title-asc": "c.title COLLATE NOCASE ASC, c.id ASC",
  "title-desc": "c.title COLLATE NOCASE DESC, c.id DESC",
};

export interface BlogCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: number;
  featuredImageUrl: string | null;
  categories: string[];
}

export interface BlogFilters {
  q: string;
  sort: BlogSort;
}

export interface BlogPage {
  posts: BlogCard[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: BlogFilters;
}

// The subset of D1Database the listing needs, so tests can supply a stand-in.
export interface ListingDB {
  prepare(sql: string): {
    bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }> };
  };
}

// Accepts only canonical positive integers ("2", not "02", "2.0", "-1" or "1e3").
export function parsePageNumber(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

export function parseFilters(params: URLSearchParams): BlogFilters {
  const sort = params.get("sort") as BlogSort | null;
  return {
    q: (params.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS),
    sort: sort && (BLOG_SORTS as readonly string[]).includes(sort) ? sort : "newest",
  };
}

// Page 1 always lives at /blog so there is one canonical URL for it.
export function blogHref(page: number, filters: Partial<BlogFilters> = {}): string {
  const path = page <= 1 ? "/blog" : `/blog/page/${page}`;
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function queryBlogPage(
  db: ListingDB,
  options: { page: number; filters: BlogFilters; pageSize?: number },
): Promise<BlogPage> {
  const pageSize = options.pageSize ?? BLOG_PAGE_SIZE;
  const { filters } = options;
  // "published" is the only visibility state in the schema; there is no scheduling column.
  let where = "c.page_type = 'post' AND c.status = 'published'";
  const params: unknown[] = [];
  if (filters.q) {
    const pattern = likePattern(filters.q);
    where += ` AND (c.title LIKE ? ESCAPE '\\'
      OR substr(c.markdown, 1, ${EXCERPT_SOURCE_CHARS}) LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM content_categories cc INNER JOIN categories cat ON cat.id = cc.category_id
                 WHERE cc.content_id = c.id AND cat.name LIKE ? ESCAPE '\\'))`;
    params.push(pattern, pattern, pattern);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS total FROM content c WHERE ${where}`)
    .bind(...params)
    .all<{ total: number }>();
  const total = Number(countResult.results?.[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = { page: options.page, pageSize, total, totalPages, filters };
  if (options.page > totalPages) return { ...base, posts: [] };

  const rows = await db
    .prepare(
      `SELECT c.id, c.slug, c.title, substr(c.markdown, 1, ${EXCERPT_SOURCE_CHARS}) AS excerpt_source,
              COALESCE(c.published_at, c.created_at) AS date, c.featured_image_url
       FROM content c WHERE ${where}
       ORDER BY ${ORDER_BY[filters.sort]}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, (options.page - 1) * pageSize)
    .all<{ id: string; slug: string; title: string; excerpt_source: string; date: number; featured_image_url: string | null }>();
  const results = rows.results ?? [];

  const categories: Record<string, string[]> = {};
  if (results.length > 0) {
    const ids = results.map((r) => r.id);
    const catRows = await db
      .prepare(
        `SELECT cc.content_id, cat.name FROM content_categories cc
         INNER JOIN categories cat ON cat.id = cc.category_id
         WHERE cc.content_id IN (${ids.map(() => "?").join(",")})
         ORDER BY cat.name ASC`,
      )
      .bind(...ids)
      .all<{ content_id: string; name: string }>();
    for (const row of catRows.results ?? []) (categories[row.content_id] ??= []).push(row.name);
  }

  return {
    ...base,
    posts: results.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: excerptFromMarkdown(r.excerpt_source ?? "", EXCERPT_CHARS),
      date: r.date,
      featuredImageUrl: r.featured_image_url,
      categories: categories[r.id] ?? [],
    })),
  };
}
