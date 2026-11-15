-- Run after migration 0012. Features existing tool pages; does not create content.
-- Re-running restores the current selection, descriptions and ordering.
--
-- Seasonal: the Midnight Season 2 M+ cheat sheet leads the WoW tiles while
-- Season 2 is the live Mythic+ season (issue #62). When the season ends, set it
-- back to homepage_featured = 0 here and re-run this file locally and remotely.
UPDATE content SET homepage_featured = 1, homepage_group = 'wow', homepage_order = 5,
  homepage_description = 'Every interrupt and utility you''ll need, per dungeon, for Midnight Season 2 Mythic+.'
WHERE slug = 'midnight-season-2-mythic-plus-interrupt-utility-cheat-sheet' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'wow', homepage_order = 10,
  homepage_description = 'Compare Blizzard''s 12.1.5 Assisted Combat priorities and simulated DPS with SimulationCraft.'
WHERE slug = 'assisted-combat-analysis' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'wow', homepage_order = 20,
  homepage_description = 'Test how queue size, latency, and keypress timing affect gaps in your rotation.'
WHERE slug = 'spell-queue-window-simulator' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'poe2', homepage_order = 10,
  homepage_description = 'Find Atlas strategies for endgame mapping and farming.'
WHERE slug = 'atlas-farming-strategies' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'poe2', homepage_order = 20,
  homepage_description = 'Check which Expedition rumours are safe to detonate with Aldur''s Bloodmark.'
WHERE slug = 'expedition-rumours-cheat-sheet' AND page_type = 'page';
