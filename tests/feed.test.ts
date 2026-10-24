import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeCdata, renderFeedHtml } from '../src/lib/feed.ts';
import { sitemapDate } from '../src/lib/sitemap.ts';
import { sanitizeSlug } from '../src/lib/http.ts';

test('feeds resolve markdown and raw HTML URLs without touching code samples', () => {
  const html = renderFeedHtml('[Guide](/pages/guide)\n\n![Art](/images/art.png)\n\n<img src="../images/raw.png?a=1&amp;b=2">\n\n`<img src="/code.png">`', '', 'https://orboro.net/blog/post', 'https://orboro.net');
  assert.match(html, /href="https:\/\/orboro.net\/pages\/guide"/);
  assert.match(html, /src="https:\/\/orboro.net\/images\/art.png"/);
  assert.match(html, /src="https:\/\/orboro.net\/images\/raw.png\?a=1&amp;b=2"/);
  assert.match(html, /&lt;img src=&quot;\/code.png&quot;&gt;/);
});

test('feeds omit scripts/styles and link widget posts instead of expanding them', () => {
  assert.doesNotMatch(renderFeedHtml('<style>x{color:red}</style><script>alert(1)</script>\n\nHello', '', '', 'https://orboro.net'), /<script|<style|alert\(1\)/);
  const html = renderFeedHtml('Intro\n\n{{widget}}', 'A <useful> guide', 'https://orboro.net/blog/guide', 'https://orboro.net');
  assert.match(html, /A &lt;useful&gt; guide/);
  assert.match(html, /Read the full article/);
  assert.doesNotMatch(html, /\{\{|<style|<script/);
});

test('CDATA terminators are split into adjacent safe sections', () => {
  assert.equal(escapeCdata('one]]>two]]>three'), 'one]]]]><![CDATA[>two]]]]><![CDATA[>three');
});

test('omitting script and style bodies does not reconstruct executable tags', () => {
  const script = renderFeedHtml('<div><scrip<script>removed</script>t>alert(1)</script></div>', '', 'https://orboro.net/blog/post', 'https://orboro.net');
  assert.equal(script, '<div>&lt;script&gt;alert(1)</div>');
  const style = renderFeedHtml('<div><sty<style>removed</style>le>p{color:red}</style></div>', '', 'https://orboro.net/blog/post', 'https://orboro.net');
  assert.equal(style, '<div>&lt;style&gt;p{color:red}</div>');
});

test('feeds omit unclosed code blocks and follow raw-text closing tags', () => {
  const link = 'https://orboro.net/blog/post';
  assert.equal(renderFeedHtml('<script src="/script.js">unclosed script', '', link, 'https://orboro.net'), '');
  assert.equal(renderFeedHtml('<style>unclosed style', '', link, 'https://orboro.net'), '');
  assert.equal(renderFeedHtml('<script>outer<script>inner</script>After</script>', '', link, 'https://orboro.net'), 'After');
  assert.equal(renderFeedHtml('<style>outer<style>inner</style>After</style>', '', link, 'https://orboro.net'), 'After');
});

test('feed code omission is case-insensitive and preserves other portable markup', () => {
  const link = 'https://orboro.net/blog/post';
  assert.equal(renderFeedHtml('<div>Before<ScRiPt src="/script.js">code</ScRiPt>After</div>', '', link, 'https://orboro.net'), '<div>BeforeAfter</div>');
  assert.equal(renderFeedHtml('<div>Before<StYlE>p{color:red}</StYlE>After</div>', '', link, 'https://orboro.net'), '<div>BeforeAfter</div>');
  const markup = '<div><custom-card data-kind="example" aria-label="Example"><span role="note">Portable</span></custom-card></div>';
  assert.equal(renderFeedHtml(markup, '', link, 'https://orboro.net'), markup);
});

test('raw code text cannot hide its closing tag or following article content', () => {
  const link = 'https://orboro.net/blog/post';
  const script = `<script>const example = '<div title="unfinished';</script><p>Article survives</p>`;
  const style = '<style>/* <div title="unfinished */</style><p>Article survives</p>';
  assert.equal(renderFeedHtml(script, '', link, 'https://orboro.net'), '<p>Article survives</p>');
  assert.equal(renderFeedHtml(style, '', link, 'https://orboro.net'), '<p>Article survives</p>');
});

test('feed code tag names recognize slash delimiters', () => {
  const link = 'https://orboro.net/blog/post';
  assert.equal(renderFeedHtml('<div><script/src="/code.js">alert(1)</script></div>', '', link, 'https://orboro.net'), '<div></div>');
  assert.equal(renderFeedHtml('<div><style/type="text/css">p{color:red}</style></div>', '', link, 'https://orboro.net'), '<div></div>');
});

test('URL rewriting respects quoted metadata, data attributes and article-relative links', () => {
  const html = renderFeedHtml('<img title="example > src=\'/sample\'" data-src="/lazy.png" src="art.png"><a href="#section">Section</a>', '', 'https://orboro.net/blog/post', 'https://orboro.net');
  assert.match(html, /title="example > src='\/sample'"/);
  assert.match(html, /data-src="\/lazy.png"/);
  assert.match(html, /src="https:\/\/orboro.net\/blog\/art.png"/);
  assert.match(html, /href="https:\/\/orboro.net\/blog\/post#section"/);
});

test('sitemap dates use actual UTC changes and omit invalid units', () => {
  const now = Date.UTC(2026, 8, 30);
  assert.equal(sitemapDate(Date.UTC(2026, 7, 9), now), '2026-08-09');
  for (const value of [null, NaN, 0, 1786305397, now + 2 * 86_400_000]) assert.equal(sitemapDate(value, now), undefined);
});

test('slugs always fit a single route segment', () => {
  assert.equal(sanitizeSlug('../../foo'), 'foo');
  assert.equal(sanitizeSlug('Gaming / WoW'), 'gaming-wow');
  assert.equal(sanitizeSlug(' / '), '');
});
