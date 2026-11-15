-- Adds the top-level "Tools" nav item linking to the /tools code page.
-- Needs migration 0016_nav_code_pages.sql. Idempotent: /admin/nav saves give
-- every item a new id, so this keys on the path rather than a fixed id, and
-- does nothing once a /tools item exists (wherever it was moved).
-- It goes first among the D1 items, right after the built-in Home and Blog links.

INSERT INTO nav_items (id, label, content_id, path, parent_item_id, sort_order, created_at)
SELECT
  'f3b0c6a2-6c1e-4f3b-9a51-7d2e8c4b1a90',
  'Tools',
  NULL,
  '/tools',
  NULL,
  (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM nav_items WHERE parent_item_id IS NULL),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE path = '/tools');
