// "Keep reading" row at the end of a post. Dependency-free so tests can run the
// query against the real migrations without the Workers runtime.
import { EXCERPT_CHARS, EXCERPT_SOURCE_CHARS, type ListingDB } from "./blog-listing.ts";
import { excerptFromMarkdown } from "./excerpt.ts";
import { topicTone } from "./topics.ts";

export const RELATED_POSTS_LIMIT = 3;

export interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: number;
  featuredImageUrl: string | null;
  /** Categories this post shares with the current one; 0 for top-up posts. */
  sharedCategories: number;
  /** Kicker: see `pickKicker`. */
  category: { name: string; slug: string } | null;
}

interface KickerCandidate {
  name: string;
  slug: string;
  shared: boolean;
}

const byName = (a: KickerCandidate, b: KickerCandidate) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * A shared game category (so a WoW post tagged Gaming too gets the WoW kicker
 * and color), else any shared category by name, else any game category (for
 * top-up posts), else the post's first by name.
 */
export function pickKicker(candidates: KickerCandidate[]): { name: string; slug: string } | null {
  const sorted = [...candidates].sort(byName);
  const shared = sorted.filter((c) => c.shared);
  const isGame = (c: KickerCandidate) => topicTone(c.slug) !== "default";
  const pick = shared.find(isGame) ?? shared[0] ?? sorted.find(isGame) ?? sorted[0];
  return pick ? { name: pick.name, slug: pick.slug } : null;
}

function parseCandidates(json: string | null): KickerCandidate[] {
  try {
    const rows = JSON.parse(json ?? "[]");
    return Array.isArray(rows)
      ? rows.filter((r) => typeof r?.name === "string" && typeof r?.slug === "string").map((r) => ({ name: r.name, slug: r.slug, shared: r.shared === 1 }))
      : [];
  } catch {
    return [];
  }
}

/**
 * Published posts ranked by how many categories they share with `contentId`,
 * then newest first. Posts sharing none rank last, so the row is topped up with
 * the newest other posts in the same query. Reads only the excerpt prefix, and
 * returns each post's categories as JSON so the kicker is chosen by `topicTone`.
 */
export async function queryRelatedPosts(db: ListingDB, contentId: string, limit = RELATED_POSTS_LIMIT): Promise<RelatedPost[]> {
  const rows = await db
    .prepare(
      `WITH mine AS (SELECT category_id FROM content_categories WHERE content_id = ?)
       SELECT c.id, c.slug, c.title, substr(c.markdown, 1, ${EXCERPT_SOURCE_CHARS}) AS excerpt_source,
              ranked.date, c.featured_image_url, ranked.shared,
              (SELECT json_group_array(json_object('name', cat.name, 'slug', cat.slug,
                        'shared', cc.category_id IN (SELECT category_id FROM mine)))
               FROM content_categories cc INNER JOIN categories cat ON cat.id = cc.category_id
               WHERE cc.content_id = c.id) AS categories_json
       FROM (
         SELECT c.id, COALESCE(c.published_at, c.created_at) AS date, COUNT(shared.category_id) AS shared
         FROM content c
         LEFT JOIN content_categories shared ON shared.content_id = c.id
           AND shared.category_id IN (SELECT category_id FROM mine)
         WHERE c.page_type = 'post' AND c.status = 'published' AND c.id <> ?
         GROUP BY c.id
         ORDER BY shared DESC, date DESC, c.id DESC
         LIMIT ?
       ) ranked
       INNER JOIN content c ON c.id = ranked.id
       ORDER BY ranked.shared DESC, ranked.date DESC, c.id DESC`,
    )
    .bind(contentId, contentId, Math.max(0, Math.floor(limit)))
    .all<{
      id: string; slug: string; title: string; excerpt_source: string | null; date: number; featured_image_url: string | null;
      shared: number; categories_json: string | null;
    }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: excerptFromMarkdown(r.excerpt_source ?? "", EXCERPT_CHARS),
    date: r.date,
    featuredImageUrl: r.featured_image_url,
    sharedCategories: Number(r.shared),
    category: pickKicker(parseCandidates(r.categories_json)),
  }));
}
