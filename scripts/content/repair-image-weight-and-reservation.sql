-- Issue #23: reserve in-content image boxes and serve the Jev header as WebP.
-- The About <img> and the topic pages' opening header images get their
-- intrinsic sizes so `.prose img { height: auto }` can reserve each box before
-- it loads. Markdown images can't carry dimensions, so the topic headers become
-- <p><img …></p>, which renders the same <p>-wrapped markup.
-- The Jev header moves from a 2.2 MB PNG to a 255 KB WebP already uploaded to
-- R2 as images/could-jev-power-the-next-wowanalyzer-header.webp; the PNG stays
-- in R2 and the full-resolution original stays in the project library.
-- Idempotent, and updated_at is left alone (no editorial change).

UPDATE content
SET markdown = replace(
  markdown,
  '<img class="float-left" src="https://media.orboro.net/images/about-header.webp" alt=',
  '<img class="float-left" src="https://media.orboro.net/images/about-header.webp" width="700" height="394" alt='
)
WHERE slug = 'about'
  AND instr(markdown, 'about-header.webp" alt=') > 0;

UPDATE content
SET markdown = replace(
  markdown,
  '![World of Warcraft](https://media.orboro.net/images/world-of-warcraft-header.webp)',
  '<p><img src="https://media.orboro.net/images/world-of-warcraft-header.webp" alt="World of Warcraft" width="2172" height="724"></p>'
)
WHERE slug = 'world-of-warcraft';

UPDATE content
SET markdown = replace(
  markdown,
  '![Path of Exile 2](https://media.orboro.net/images/path-of-exile-ii-header.webp)',
  '<p><img src="https://media.orboro.net/images/path-of-exile-ii-header.webp" alt="Path of Exile 2" width="1800" height="600"></p>'
)
WHERE slug = 'path-of-exile-ii';

UPDATE content
SET markdown = replace(
  markdown,
  '![Development](https://media.orboro.net/images/development-header.webp)',
  '<p><img src="https://media.orboro.net/images/development-header.webp" alt="Development" width="2172" height="724"></p>'
)
WHERE slug = 'development';

UPDATE content
SET featured_image_url = 'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.webp'
WHERE featured_image_url = 'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.png';

UPDATE media
SET url = 'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.webp'
WHERE url = 'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.png';
