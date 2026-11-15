-- A nav item links either to a content row (content_id) or to a code page that
-- is not a D1 row, such as /tools (path). Writes allow only paths listed in
-- NAV_CODE_PAGES (src/lib/content-writes.ts) and exactly one of the two.
ALTER TABLE nav_items ADD COLUMN path TEXT;
