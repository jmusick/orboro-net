import type { APIRoute } from 'astro';
import { getDB } from '../lib/db';
import { escapeXml, escapeCdata, feedDescription, renderFeedHtml } from '../lib/feed';

export const GET: APIRoute = async ({ site, locals }) => {
  const BASE = (site ?? new URL('https://orboro.net')).origin;
  const db = getDB(locals);

  type Row = {
    slug: string;
    title: string;
    markdown: string;
    summary: string;
    published_at: number | null;
    created_at: number;
    updated_at: number;
  };

  let rows: Row[] = [];
  if (db) {
    const result = await db
      .prepare(
        `SELECT slug, title, markdown, summary, published_at, created_at, updated_at
         FROM content
         WHERE page_type = 'post' AND status = 'published'
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT 50`
      )
      .all<Row>();
    rows = result.results ?? [];
  }

  const items = await Promise.all(
    rows.map(async (row) => {
      const link = `${BASE}/blog/${row.slug}`;
      const pubDate = new Date(row.published_at ?? row.created_at).toUTCString();
      const excerpt = feedDescription(row);
      const html = renderFeedHtml(row.markdown, excerpt, link, BASE);
      return [
        '  <item>',
        `    <title>${escapeXml(row.title)}</title>`,
        `    <link>${link}</link>`,
        `    <guid isPermaLink="true">${link}</guid>`,
        `    <pubDate>${pubDate}</pubDate>`,
        `    <description>${escapeXml(excerpt)}</description>`,
        `    <content:encoded><![CDATA[${escapeCdata(html)}]]></content:encoded>`,
        '  </item>',
      ].join('\n');
    })
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '  <title>Orboro.net</title>',
    `  <link>${BASE}/</link>`,
    `  <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />`,
    '  <atom:link href="https://pubsubhubbub.appspot.com/" rel="hub" />',
    '  <description>Latest posts from Orboro.net</description>',
    '  <language>en-us</language>',
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
