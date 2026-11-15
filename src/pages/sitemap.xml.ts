import type { APIRoute } from 'astro';
import { getDB } from '../lib/db';
import { PRIVACY_UPDATED_AT } from '../lib/privacy';
import { sitemapDate } from '../lib/sitemap';
import { escapeXml } from '../lib/feed';
import { EMBEDS_SHORTCODE_SQL, TOOL_INDEX_EXCLUDED_SLUGS } from '../lib/tools';

export const GET: APIRoute = async ({ site, locals }) => {
  const BASE = (site ?? new URL('https://orboro.net')).origin;
  const staticPages = [
    { loc: `${BASE}/`, lastmod: undefined as string | undefined },
    { loc: `${BASE}/blog`, lastmod: undefined as string | undefined },
    { loc: `${BASE}/tools`, lastmod: undefined as string | undefined },
    { loc: `${BASE}/privacy-policy`, lastmod: PRIVACY_UPDATED_AT },
  ];

  const contentPages: { loc: string; lastmod?: string }[] = [];
  const categoryPages: { loc: string; lastmod?: string }[] = [];

  const db = getDB(locals);
  if (db) {
    const contentResult = await db
      .prepare(
        `SELECT slug, page_type, updated_at, (page_type = 'page' AND ${EMBEDS_SHORTCODE_SQL}) AS is_tool FROM content WHERE status = 'published' ORDER BY updated_at DESC`
      )
      .all<{ slug: string; page_type: string; updated_at: number; is_tool: number }>();

    const rows = contentResult.results ?? [];
    const postDates = rows.filter(row => row.page_type === 'post').map(row => sitemapDate(row.updated_at)).filter((date): date is string => !!date);
    staticPages[0].lastmod = staticPages[1].lastmod = postDates.sort().at(-1);
    // /tools changes when any tool page does (same rule as listToolPages).
    staticPages[2].lastmod = rows
      .filter(row => row.is_tool === 1 && !TOOL_INDEX_EXCLUDED_SLUGS.has(row.slug))
      .map(row => sitemapDate(row.updated_at))
      .filter((date): date is string => !!date)
      .sort().at(-1);
    for (const row of rows) {
      const path = row.page_type === 'post' ? `/blog/${row.slug}` : `/pages/${row.slug}`;
      contentPages.push({
        loc: `${BASE}${path}`,
        lastmod: sitemapDate(row.updated_at),
      });
    }

    const catResult = await db
      .prepare(
        `SELECT cat.slug, MAX(c.updated_at) AS updated_at
         FROM categories cat
         INNER JOIN content_categories cc ON cc.category_id = cat.id
         INNER JOIN content c ON c.id = cc.content_id
         WHERE c.status = 'published' AND c.page_type = 'post'
         GROUP BY cat.slug
         ORDER BY cat.slug ASC`
      )
      .all<{ slug: string; updated_at: number | null }>();

    for (const cat of catResult.results ?? []) {
      categoryPages.push({ loc: `${BASE}/blog/category/${cat.slug}`, lastmod: sitemapDate(cat.updated_at) });
    }
  }

  const allPages = [...staticPages, ...contentPages, ...categoryPages];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allPages.map(p =>
      `  <url>\n    <loc>${escapeXml(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}\n  </url>`
    ),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
