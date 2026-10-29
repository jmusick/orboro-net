-- Refresh the existing tool's intro and homepage description without changing
-- its featured state, ordering, comments or other editor settings.
UPDATE content
SET markdown = 'Compare Blizzard’s Assisted Combat priorities with SimulationCraft in patch 12.1.5. Review all 40 specializations and explore paired DPS simulations at 1, 2, 3 and 5 targets where a current SimC profile is available.

{{assisted_combat_analysis}}',
    homepage_description = 'Compare Blizzard''s 12.1.5 Assisted Combat priorities and simulated DPS with SimulationCraft.',
    updated_at = CAST(strftime('%s', '2026-10-29 15:00:00') AS INTEGER) * 1000
WHERE slug = 'assisted-combat-analysis' AND page_type = 'page';
