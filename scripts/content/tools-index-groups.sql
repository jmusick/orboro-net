-- Puts game-specific tool and link-hub pages in their game's group on /tools
-- (homepage_group). Within a group, tools come before the link hub (order 100).
-- Changes no homepage_featured flags, so the homepage toolkit is unaffected,
-- and leaves updated_at alone because only listing metadata changes.
-- Re-running restores these groups and positions.

UPDATE content SET homepage_group = 'wow', homepage_order = 30
WHERE slug = 'midnight-season-2-mythic-plus-interrupt-utility-cheat-sheet' AND page_type = 'page';

UPDATE content SET homepage_group = 'wow', homepage_order = 100
WHERE slug = 'useful-wow-links' AND page_type = 'page';

UPDATE content SET homepage_group = 'poe2', homepage_order = 100
WHERE slug = 'useful-poe2-links' AND page_type = 'page';
