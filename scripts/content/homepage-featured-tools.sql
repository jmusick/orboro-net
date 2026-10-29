-- Run after migration 0012. Features existing tool pages; does not create content.
-- Re-running restores the initial selection, descriptions and ordering.
UPDATE content SET homepage_featured = 1, homepage_group = 'wow', homepage_order = 10,
  homepage_description = 'Compare Blizzard''s Assisted Combat priorities across specializations with SimulationCraft.'
WHERE slug = 'assisted-combat-analysis' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'wow', homepage_order = 20,
  homepage_description = 'Test how queue size, latency, and keypress timing affect gaps in your rotation.'
WHERE slug = 'spell-queue-window-simulator' AND page_type = 'page';

UPDATE content SET homepage_featured = 0
WHERE slug = 'midnight-season-2-mythic-plus-interrupt-utility-cheat-sheet' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'poe2', homepage_order = 10,
  homepage_description = 'Find Atlas strategies for endgame mapping and farming.'
WHERE slug = 'atlas-farming-strategies' AND page_type = 'page';

UPDATE content SET homepage_featured = 1, homepage_group = 'poe2', homepage_order = 20,
  homepage_description = 'Check which Expedition rumours are safe to detonate with Aldur''s Bloodmark.'
WHERE slug = 'expedition-rumours-cheat-sheet' AND page_type = 'page';
