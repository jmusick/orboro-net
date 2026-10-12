-- Issue #21: intro prose for "Path of Exile II". Idempotent; safe to re-run.
-- Adds visible intro text above the widget so the page gets a useful meta description.
-- The rest of the markdown is the production content as read on 2026-10-11.
-- Apply: npx wrangler d1 execute DB --remote --file=./scripts/content/intro-path-of-exile-ii.sql
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
  '46cf5736-0cc3-410a-9de3-4c2ef9a68bdb',
  'path-of-exile-ii',
  'Path of Exile II',
  '![Path of Exile 2](https://media.orboro.net/images/path-of-exile-ii-header.webp)

Tools and references for Path of Exile 2: a tier list of Atlas currency farming strategies, an Expedition rumours cheat sheet and a list of useful PoE2 sites. Aimed at players working on the Atlas endgame.

{{poe2_intro}}

{{poe2_featured}}',
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
