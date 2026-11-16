-- getAdjacentPosts (src/lib/content.ts) finds a post's Older/Newer neighbours with
-- LIMIT 1 queries on this exact expression and id, so they seek instead of scanning
-- every published post. The expression must match the query text for SQLite to use it.
CREATE INDEX IF NOT EXISTS content_post_order_idx
  ON content(page_type, status, COALESCE(published_at, created_at), id);
