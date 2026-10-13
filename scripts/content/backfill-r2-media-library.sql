-- Backfill library metadata for 13 content images already hosted in production R2.
-- Source: production content URLs and existing inline alt text, October 6, 2026.
-- Featured-image labels use content titles; existing media records are preserved.
-- Query strings/fragments identify the same R2 object and do not create duplicates.
-- Re-runnable with: npx wrangler d1 execute DB --remote --file=./scripts/content/backfill-r2-media-library.sql
-- No uploads, content edits, or object deletions are performed.

WITH candidates (id, url, alt_text, caption) AS (
 VALUES
  ('bc742602-b31d-43a9-bb0d-575266f1ffcc', 'https://media.orboro.net/images/about-header.webp', 'Cartoon avatar of JD at his gaming desk', 'Header artwork for About.'),
  ('813a5d80-c23b-4f6c-8bf7-63a2427df94c', 'https://media.orboro.net/images/path-of-exile-ii-header.webp', 'Path of Exile 2', 'Header artwork for Path of Exile II.'),
  ('194da310-f935-4e57-91d7-2c922d277eb0', 'https://media.orboro.net/images/why-arpgs-use-leagues-and-seasons-header.jpg', 'Header artwork for Why ARPGs Use Leagues and Seasons', 'Header artwork for Why ARPGs Use Leagues and Seasons.'),
  ('35222bbe-e430-42ec-8659-bbcabb35fea6', 'https://media.orboro.net/images/gaming-header.webp', 'Header artwork for Gaming', 'Header artwork for Gaming.'),
  ('571d02b0-b5c8-46d4-8e62-d55bebc98ef1', 'https://media.orboro.net/images/development-header.webp', 'Development', 'Header artwork for Development.'),
  ('79f3b414-88e2-4805-b3f8-ff2e1e408b02', 'https://media.orboro.net/images/world-of-warcraft-header.webp', 'World of Warcraft', 'Header artwork for World of Warcraft.'),
  ('52d66d7e-9039-45d4-98da-6ca8049aa21f', 'https://media.orboro.net/images/what-wow-creators-think-is-strong-in-mythic-plus-for-midnight-season-2-header.jpg', 'Header artwork for What WoW Creators Think Is Strong in Mythic+ for Midnight Season 2', 'Header artwork for What WoW Creators Think Is Strong in Mythic+ for Midnight Season 2.'),
  ('104f3bb0-cc83-424b-b02b-d469d4914aa0', 'https://media.orboro.net/images/why-the-best-great-vault-reward-in-midnight-season-2-isnt-an-item-header.webp', 'Header artwork for Why the Best Great Vault Reward in Midnight Season 2 Isn''t an Item', 'Header artwork for Why the Best Great Vault Reward in Midnight Season 2 Isn''t an Item.'),
  ('7553fa81-a29a-4268-9c1d-dce0ed633644', 'https://media.orboro.net/images/midnight-season-2-mythic-plus-interrupt-utility-cheat-sheet-header.webp', 'Header artwork for Midnight Season 2 Mythic+ Interrupt & Utility Cheat Sheet', 'Header artwork for Midnight Season 2 Mythic+ Interrupt & Utility Cheat Sheet.'),
  ('56552b45-0437-4b15-8c82-7e5dc795d9ac', 'https://media.orboro.net/images/bis-lists-are-bait-header.webp', 'Header artwork for WoW "Best in Slot" Lists Are Bait: Stop Chasing Them Blindly', 'Header artwork for WoW "Best in Slot" Lists Are Bait: Stop Chasing Them Blindly.'),
  ('75e230d8-2458-48fe-a691-45469a237c33', 'https://media.orboro.net/images/which-wow-creators-predicted-midnight-season-2-mythic-plus-meta-best-header.webp', 'Header artwork for Which WoW Creators Predicted the Midnight Season 2 Mythic+ Meta Best?', 'Header artwork for Which WoW Creators Predicted the Midnight Season 2 Mythic+ Meta Best?'),
  ('38731bd3-3511-4500-81ce-e80aa58a5855', 'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.webp', 'Header artwork for Could Jev Power the Next WoWAnalyzer?', 'Header artwork for Could Jev Power the Next WoWAnalyzer?'),
  ('3fa3f0a0-010c-4175-95b3-6c245735cb94', 'https://media.orboro.net/images/nvidia-global-settings-header.webp', 'Header artwork for NVIDIA global settings for G-SYNC: defaults and exceptions', 'Header artwork for NVIDIA global settings for G-SYNC: defaults and exceptions.')
)
INSERT INTO media (id, url, alt_text, caption, created_by, created_at)
SELECT candidate.id, candidate.url, candidate.alt_text, candidate.caption,
 (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1),
 CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM candidates candidate
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin')
 AND NOT EXISTS (
  SELECT 1 FROM media existing
  WHERE existing.id = candidate.id
   OR existing.url = candidate.url
   OR substr(existing.url, 1, length(candidate.url) + 1)
      IN (candidate.url || '?', candidate.url || '#')
 );
