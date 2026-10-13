-- Issue #21: intro prose for "World of Warcraft". Idempotent; safe to re-run.
-- Adds visible intro text above the widget so the page gets a useful meta description.
-- The rest of the markdown is the production content as read on 2026-10-11.
-- Apply: npx wrangler d1 execute DB --remote --file=./scripts/content/intro-world-of-warcraft.sql
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
  '665d329f-6c97-49c8-ac81-5dfaf1fe065e',
  'world-of-warcraft',
  'World of Warcraft',
  '<p><img src="https://media.orboro.net/images/world-of-warcraft-header.webp" alt="World of Warcraft" width="2172" height="724"></p>

Original World of Warcraft tools and research, including a Spell Queue Window simulator and an analysis of Blizzard''s assisted combat rotations, plus a list of useful WoW sites and a profile of The Hidden Lodge raiding guild.

{{wow_intro}}

{{wow_featured}}

{{hidden_lodge_feature}}',
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
