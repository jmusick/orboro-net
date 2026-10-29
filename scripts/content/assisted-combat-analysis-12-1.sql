
UPDATE content
SET
  markdown = 'Assisted Combat is Blizzard’s built-in World of Warcraft rotation helper. This analysis uses the live 12.1 priority data for all 40 specializations, then compares those lists with pinned SimulationCraft profiles to show where the helper aligns—and where optimized play still adds decisions.

{{assisted_combat_analysis}}',
  updated_at = CAST(strftime('%s', '2026-08-24 12:00:00') AS INTEGER) * 1000
WHERE slug = 'assisted-combat-analysis';

