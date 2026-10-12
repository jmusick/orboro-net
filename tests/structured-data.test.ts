import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARTICLE_MIN_WORDS, breadcrumbList, classifyPage, graphOf, pageNode, pageTrail, withHome,
} from '../src/lib/structured-data.ts';
import { jsonForHtml } from '../src/lib/json.ts';

const ORIGIN = 'https://orboro.net';
const longProse = Array.from({ length: ARTICLE_MIN_WORDS + 5 }, (_, i) => `word${i}`).join(' ');

test('shortcode pages are never articles, even with long prose', () => {
  assert.equal(classifyPage(`${longProse}\n\n{{bookmarks}}`), 'WebPage');
  assert.equal(classifyPage('{{tool attr=&quot;x&quot;}}'), 'WebPage');
});

test('prose pages become articles only above the word threshold', () => {
  assert.equal(classifyPage(longProse), 'Article');
  assert.equal(classifyPage('A short about blurb.'), 'WebPage');
  assert.equal(classifyPage('```\n' + longProse + '\n```'), 'WebPage');
});

const nav = [
  { id: 'a', label: 'WoW', contentId: null, url: '/pages/', parentItemId: null },
  { id: 'b', label: 'Guides', contentId: 'c-guides', url: '/pages/guides', parentItemId: 'a' },
  { id: 'c', label: 'Tool', contentId: 'c-tool', url: '/pages/tool', parentItemId: 'b' },
  { id: 'd', label: 'Top', contentId: 'c-top', url: '/pages/top', parentItemId: null },
  { id: 'e', label: 'Loop', contentId: 'c-loop', url: '/pages/loop', parentItemId: 'f' },
  { id: 'f', label: 'Loop2', contentId: 'c-loop2', url: '/pages/loop2', parentItemId: 'e' },
];

test('page trail follows the nav parent chain and skips unlinkable parents', () => {
  const trail = pageTrail(nav, 'c-tool', 'Tool Title', '/pages/tool');
  assert.deepEqual(trail, [
    { name: 'Guides', path: '/pages/guides' },
    { name: 'Tool Title', path: '/pages/tool' },
  ]);
});

test('top-level, unlisted and label-only-parent pages get no trail', () => {
  assert.deepEqual(pageTrail(nav, 'c-top', 'Top', '/pages/top'), []);
  assert.deepEqual(pageTrail(nav, 'missing', 'X', '/pages/x'), []);
  const onlyLabel = [nav[0], { id: 'z', label: 'Z', contentId: 'c-z', url: '/pages/z', parentItemId: 'a' }];
  assert.deepEqual(pageTrail(onlyLabel, 'c-z', 'Z', '/pages/z'), []);
});

test('nav cycles terminate', () => {
  const trail = pageTrail(nav, 'c-loop', 'Loop', '/pages/loop');
  assert.deepEqual(trail.map((c) => c.path), ['/pages/loop2', '/pages/loop']);
});

test('breadcrumb list uses absolute URLs and 1-based positions', () => {
  const list = breadcrumbList(withHome([{ name: 'Blog', path: '/blog' }, { name: 'Post', path: '/blog/p' }]), ORIGIN) as any;
  assert.equal(list['@type'], 'BreadcrumbList');
  assert.deepEqual(list.itemListElement.map((i: any) => [i.position, i.name, i.item]), [
    [1, 'Home', 'https://orboro.net/'],
    [2, 'Blog', 'https://orboro.net/blog'],
    [3, 'Post', 'https://orboro.net/blog/p'],
  ]);
  assert.equal(breadcrumbList([], ORIGIN), undefined);
  assert.equal(breadcrumbList([{ name: 'Home', path: '/' }], ORIGIN), undefined);
});

test('article node carries dates and image; implausible dates are dropped', () => {
  const now = Date.UTC(2026, 9, 11);
  const node = pageNode({
    type: 'Article', origin: ORIGIN, path: '/pages/a', title: 'A', description: 'd',
    imageUrl: 'https://orboro.net/i.png', publishedAt: Date.UTC(2026, 0, 1), updatedAt: Date.UTC(2026, 5, 1), now,
  }) as any;
  assert.equal(node['@type'], 'Article');
  assert.equal(node.datePublished, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(node.image, ['https://orboro.net/i.png']);
  const bad = pageNode({ type: 'Article', origin: ORIGIN, path: '/pages/a', title: 'A', description: 'd', publishedAt: 12345, updatedAt: now * 10, now }) as any;
  assert.equal('datePublished' in bad, false);
  assert.equal('dateModified' in bad, false);
});

test('webpage node omits article-only fields', () => {
  const node = pageNode({ type: 'WebPage', origin: ORIGIN, path: '/pages/t', title: 'T', description: 'd' }) as any;
  assert.equal(node['@type'], 'WebPage');
  assert.equal(node.url, 'https://orboro.net/pages/t');
  assert.equal('author' in node, false);
});

test('graph drops undefined nodes and serializes safely', () => {
  const graph = graphOf(pageNode({ type: 'WebPage', origin: ORIGIN, path: '/pages/t', title: '</script><b>', description: 'a & b' }), undefined);
  assert.equal((graph['@graph'] as unknown[]).length, 1);
  assert.doesNotMatch(jsonForHtml(graph), /[<>&]/);
});
