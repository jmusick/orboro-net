import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  BLOG_PAGE_SIZE, blogHref, parseFilters, parsePageNumber, queryBlogPage, type BlogFilters,
} from '../src/lib/blog-listing.ts';
import { excerptFromMarkdown } from '../src/lib/excerpt.ts';

const NEWEST: BlogFilters = { q: '', sort: 'newest' };

// D1 stand-in over node:sqlite (real SQL, so ordering/LIKE/LIMIT are genuinely exercised).
function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE content (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, markdown TEXT NOT NULL,
      page_type TEXT NOT NULL, status TEXT NOT NULL, published_at INTEGER, created_at INTEGER NOT NULL, featured_image_url TEXT);
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE content_categories (content_id TEXT NOT NULL, category_id TEXT NOT NULL);
  `);
  const statements: string[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async () => { statements.push(sql); return { results: sqlite.prepare(sql).all(...(values as never[])) as never[] }; },
      }),
    }),
  };
  let n = 0;
  const add = (o: Partial<{ title: string; markdown: string; type: string; status: string; at: number | null; created: number; image: string | null; cats: string[] }> = {}) => {
    const id = `id${++n}`;
    sqlite.prepare('INSERT INTO content VALUES (?,?,?,?,?,?,?,?,?)').run(
      id, `post-${n}`, o.title ?? `Post ${n}`, o.markdown ?? `Body ${n}`, o.type ?? 'post', o.status ?? 'published',
      o.at === undefined ? 1000 + n : o.at, o.created ?? 1, o.image ?? null);
    for (const name of o.cats ?? []) {
      sqlite.prepare('INSERT OR IGNORE INTO categories VALUES (?,?)').run(`cat-${name}`, name);
      sqlite.prepare('INSERT INTO content_categories VALUES (?,?)').run(id, `cat-${name}`);
    }
    return id;
  };
  return { db, add, statements };
}

test('zero posts: one empty page, page 2 is out of range', async () => {
  const { db } = makeDb();
  const first = await queryBlogPage(db, { page: 1, filters: NEWEST });
  assert.deepEqual([first.posts.length, first.total, first.totalPages], [0, 0, 1]);
  const second = await queryBlogPage(db, { page: 2, filters: NEWEST });
  assert.ok(second.page > second.totalPages);
});

test('one page of posts has a single page and page 2 is out of range', async () => {
  const { db, add } = makeDb();
  for (let i = 0; i < BLOG_PAGE_SIZE; i++) add();
  const result = await queryBlogPage(db, { page: 1, filters: NEWEST });
  assert.equal(result.posts.length, BLOG_PAGE_SIZE);
  assert.equal(result.totalPages, 1);
  const second = await queryBlogPage(db, { page: 2, filters: NEWEST });
  assert.ok(second.page > second.totalPages);
});

test('multiple pages split newest-first with no overlap; last page is partial; beyond is out of range', async () => {
  const { db, add } = makeDb();
  for (let i = 0; i < 30; i++) add({ title: `T${i}`, at: 5000 + i });
  const pages = [];
  for (const page of [1, 2, 3]) pages.push(await queryBlogPage(db, { page, filters: NEWEST }));
  assert.deepEqual(pages.map((p) => p.posts.length), [12, 12, 6]);
  assert.ok(pages.every((p) => p.totalPages === 3 && p.total === 30));
  const titles = pages.flatMap((p) => p.posts.map((x) => x.title));
  assert.equal(new Set(titles).size, 30);
  assert.deepEqual(titles, Array.from({ length: 30 }, (_, i) => `T${29 - i}`));
  const beyond = await queryBlogPage(db, { page: 4, filters: NEWEST });
  assert.equal(beyond.posts.length, 0);
  assert.ok(beyond.page > beyond.totalPages);
});

test('ordering: sorts, published_at falls back to created_at, ties break on id', async () => {
  const { db, add } = makeDb();
  add({ title: 'banana', at: 100 });
  add({ title: 'Apple', at: null, created: 300 });
  add({ title: 'cherry', at: 200 });
  const titles = async (sort: BlogFilters['sort']) => (await queryBlogPage(db, { page: 1, filters: { q: '', sort } })).posts.map((p) => p.title);
  assert.deepEqual(await titles('newest'), ['Apple', 'cherry', 'banana']);
  assert.deepEqual(await titles('oldest'), ['banana', 'cherry', 'Apple']);
  assert.deepEqual(await titles('title-asc'), ['Apple', 'banana', 'cherry']);
  assert.deepEqual(await titles('title-desc'), ['cherry', 'banana', 'Apple']);
  const t = makeDb();
  const a = t.add({ title: 'same', at: 50 });
  const b = t.add({ title: 'same', at: 50 });
  const tied = await queryBlogPage(t.db, { page: 1, filters: NEWEST });
  assert.deepEqual(tied.posts.map((p) => p.id), [b, a]);
});

test('only published posts are listed or counted; pages and drafts are excluded', async () => {
  const { db, add } = makeDb();
  add({ title: 'Live' });
  add({ title: 'Draft', status: 'draft' });
  add({ title: 'Scheduled', status: 'scheduled' });
  add({ title: 'A page', type: 'page' });
  const result = await queryBlogPage(db, { page: 1, filters: NEWEST });
  assert.deepEqual(result.posts.map((p) => p.title), ['Live']);
  assert.equal(result.total, 1);
  assert.equal((await queryBlogPage(db, { page: 1, filters: { q: 'Draft', sort: 'newest' } })).total, 0);
});

test('search matches title, bounded body prefix and category, with wildcards escaped', async () => {
  const { db, add } = makeDb();
  add({ title: 'Mythic guide' });
  add({ title: 'Other', markdown: 'Talks about delves here' });
  add({ title: 'Third', cats: ['Path of Exile 2'] });
  add({ title: 'Deep', markdown: 'x'.repeat(1300) + ' hiddenword' });
  add({ title: '100% done' });
  const find = async (q: string) => (await queryBlogPage(db, { page: 1, filters: { q, sort: 'oldest' } })).posts.map((p) => p.title);
  assert.deepEqual(await find('MYTHIC'), ['Mythic guide']);
  assert.deepEqual(await find('delves'), ['Other']);
  assert.deepEqual(await find('exile'), ['Third']);
  assert.deepEqual(await find('hiddenword'), []);
  assert.deepEqual(await find('100%'), ['100% done']);
  assert.deepEqual(await find('%'), ['100% done']);
  assert.deepEqual(await find('_'), []);
});

test('filtered results paginate by the filtered total', async () => {
  const { db, add } = makeDb();
  for (let i = 0; i < 15; i++) add({ title: `Match ${i}` });
  for (let i = 0; i < 5; i++) add({ title: `Other ${i}` });
  const p2 = await queryBlogPage(db, { page: 2, filters: { q: 'match', sort: 'newest' } });
  assert.deepEqual([p2.total, p2.totalPages, p2.posts.length], [15, 2, 3]);
});

test('queries read a bounded body prefix only, and attach categories for the page', async () => {
  const { db, add, statements } = makeDb();
  add({ title: 'A', markdown: '# Heading\n\nHello **world** from the body.', cats: ['Zeta', 'Alpha'], image: '/i.png' });
  const result = await queryBlogPage(db, { page: 1, filters: NEWEST });
  const [post] = result.posts;
  assert.equal(post.excerpt, 'Hello world from the body.');
  assert.deepEqual(post.categories, ['Alpha', 'Zeta']);
  assert.equal(post.featuredImageUrl, '/i.png');
  assert.ok(statements.every((s) => !/SELECT \*/i.test(s)));
  assert.ok(statements.every((s) => !/\bc\.markdown\b/.test(s.replaceAll(/substr\(c\.markdown, 1, 1200\)/g, ''))));
});

test('excerpts from a truncated prefix drop an unclosed code fence', () => {
  assert.equal(excerptFromMarkdown('Intro text.\n\n```js\nconst a = 1;\nmore code', 140), 'Intro text.');
  assert.equal(excerptFromMarkdown('```js\ncode\n```\nAfter', 140), 'After');
});

test('page and filter parsing is strict; hrefs keep page 1 canonical', () => {
  assert.equal(parsePageNumber('2'), 2);
  for (const bad of [undefined, '', '0', '-1', '02', '2.5', '1e3', 'abc', '99999999999']) assert.equal(parsePageNumber(bad), null);
  assert.deepEqual(parseFilters(new URLSearchParams('q=%20%20hi%20%20there&sort=bogus')), { q: 'hi there', sort: 'newest' });
  assert.equal(parseFilters(new URLSearchParams('sort=oldest')).sort, 'oldest');
  assert.equal(parseFilters(new URLSearchParams(`q=${'a'.repeat(500)}`)).q.length, 100);
  assert.equal(blogHref(1), '/blog');
  assert.equal(blogHref(3), '/blog/page/3');
  assert.equal(blogHref(2, { q: 'a b', sort: 'oldest' }), '/blog/page/2?q=a+b&sort=oldest');
  assert.equal(blogHref(1, { q: '', sort: 'newest' }), '/blog');
});

test('excerpts end on a word boundary', () => {
  const text = 'Enshittification and AI slop are useful terms until we start using them for everything. A browser changes its tabs. A developer ships a feature.';
  const excerpt = excerptFromMarkdown(text, 120);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(text.startsWith(excerpt.slice(0, -1)));
  assert.match(excerpt, /\S…$/);
  assert.equal(text.charAt(excerpt.length - 1), ' ');
  assert.equal(excerptFromMarkdown('Supercalifragilistic'.repeat(10), 20), 'Supercalifragilistic…');
  assert.equal(excerptFromMarkdown('Short text.', 140), 'Short text.');
});
