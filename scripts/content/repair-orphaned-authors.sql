-- Reassigns content whose author_id names no user to the first admin.
--
-- The October 13, 2026 recovery drill (issue #13) found `about` and
-- `path-of-exile-ii` pointing at a user ID that exists only in an older local
-- database. D1 accepted the rows when they were written, but a restore of
-- `wrangler d1 export` fails the foreign key check on them, so production could
-- not be rebuilt from its own export. Safe to re-run: it changes only rows
-- whose author is missing, and leaves updated_at alone because the published
-- content is unchanged.

UPDATE content
SET author_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
WHERE author_id NOT IN (SELECT id FROM users)
  AND EXISTS (SELECT 1 FROM users WHERE role = 'admin');
