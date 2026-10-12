-- Issue #21: intro prose for "Expedition Rumours Cheat Sheet". Idempotent; safe to re-run.
-- Adds visible intro text above the widget so the page gets a useful meta description.
-- The rest of the markdown is the production content as read on 2026-10-11.
-- Apply: npx wrangler d1 execute DB --remote --file=./scripts/content/intro-expedition-rumours-cheat-sheet.sql
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
  '4c17cef4-a539-4f08-a85b-66b5929d82f2',
  'expedition-rumours-cheat-sheet',
  'Expedition Rumours Cheat Sheet',
  'A quick reference for Path of Exile 2 Expedition logbooks. Select the rumours on your logbook to see whether it is safe to use with Aldur''s Saga, since boss encounters and most unique maps are not. Data is from Dracorath''s Expedition Explained.

{{rumour_cheat_sheet}}',
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
