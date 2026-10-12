-- Issue #21: intro prose for "Useful Grim Dawn Links". Idempotent; safe to re-run.
-- Adds visible intro text above the widget so the page gets a useful meta description.
-- The rest of the markdown is the production content as read on 2026-10-11.
-- Apply: npx wrangler d1 execute DB --remote --file=./scripts/content/intro-useful-grim-dawn-links.sql
PRAGMA foreign_keys = ON;

INSERT INTO content (
  id,
  slug,
  title,
  markdown,
  page_type,
  status,
  author_id,
  published_at,
  created_at,
  updated_at,
  featured_image_url
)
VALUES (
  '7fbfa184-97fe-4605-8974-b22348081d21',
  'useful-grim-dawn-links',
  'Useful Grim Dawn Links',
  'A short list of Grim Dawn bookmarks: the official site and forum, mods on Nexus Mods, build tools and the r/GrimDawn subreddit.

{{bookmarks tag="grimdawn" exclude_categories="arpg,gaming"}}',
  'page',
  'published',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  NULL
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  markdown = excluded.markdown,
  page_type = excluded.page_type,
  status = excluded.status,
  published_at = COALESCE(content.published_at, excluded.published_at),
  updated_at = excluded.updated_at;
