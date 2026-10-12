-- Issue #21: intro prose for "Useful FOSS". Idempotent; safe to re-run.
-- Adds visible intro text above the widget so the page gets a useful meta description.
-- The rest of the markdown is the production content as read on 2026-10-11.
-- Apply: npx wrangler d1 execute DB --remote --file=./scripts/content/intro-useful-foss.sql
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
  '9d16598a-990a-4101-9e7c-0c4d777b1543',
  'useful-foss',
  'Useful FOSS',
  'A bookmarked list of free and open source software, mostly Windows and gaming utilities such as OBS, an image compressor and a Windows tweak tool.

{{bookmarks tag="foss" exclude_categories="software"}}',
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
