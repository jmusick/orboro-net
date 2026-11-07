import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { makeMigratedDb } from './helpers/d1.ts';

// Supply the Worker binding while retaining db.ts and the real query functions.
// Node also needs extensions for content.ts's Astro-resolved relative imports.
const workerModule = 'data:text/javascript,export const env = {};';
const contentUrl = new URL('../src/lib/content.ts', import.meta.url).href;
const dbUrl = new URL('../src/lib/db.ts', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  export function resolve(specifier, context, nextResolve) {
    if (context.parentURL === ${JSON.stringify(dbUrl)} && specifier === 'cloudflare:workers') {
      return { url: ${JSON.stringify(workerModule)}, shortCircuit: true };
    }
    if (context.parentURL === ${JSON.stringify(contentUrl)} &&
        ['./content-writes', './db', './blog-listing', './related-posts', './excerpt'].includes(specifier)) {
      return nextResolve(specifier + '.ts', context);
    }
    return nextResolve(specifier, context);
  }
`)}`, import.meta.url);
const content = await import('../src/lib/content.ts');
const { env } = await import(workerModule);
const locals = {} as App.Locals;

function setup(t: { after: (fn: () => void) => void }) {
  const { db, sqlite } = makeMigratedDb();
  env.DB = db;
  t.after(() => { delete env.DB; sqlite.close(); });
  sqlite.exec(`
    INSERT INTO users (id, email, password_hash, role, created_at)
      VALUES ('admin', 'admin@example.com', 'unused', 'admin', 0);
    INSERT INTO categories (id, name, slug, created_at) VALUES
      ('shared', 'Shared', 'shared', 0), ('draft-only', 'Draft only', 'draft-only', 0),
      ('pages-only', 'Pages only', 'pages-only', 0);
  `);
  const insert = sqlite.prepare(`INSERT INTO content
    (id, slug, title, markdown, page_type, status, author_id, published_at, created_at, updated_at,
     homepage_featured, homepage_group, homepage_order, homepage_description)
    VALUES (?, ?, ?, 'Opening body', ?, ?, 'admin', ?, ?, 999, ?, ?, ?, 'Tool description')`);
  // Created order intentionally disagrees with publication order. Null publication
  // dates exercise the created_at fallback; drafts have the newest dates and flags.
  for (const row of [
    ['post-old', 'post', 'published', 100, 500, 1, 'wow', 0],
    ['post-new', 'post', 'published', 300, 50, 0, 'other', 0],
    ['post-fallback', 'post', 'published', null, 200, 0, 'other', 0],
    ['post-draft', 'post', 'draft', 900, 900, 1, 'wow', 0],
    ['page-wow', 'page', 'published', 250, 10, 1, 'wow', 2],
    ['page-poe', 'page', 'published', null, 150, 1, 'poe2', 1],
    ['page-plain', 'page', 'published', 50, 600, 0, 'wow', 0],
    ['page-draft', 'page', 'draft', 950, 950, 1, 'wow', 0],
  ] as const) {
    const [id, ...values] = row;
    insert.run(id, id, id, ...values);
    sqlite.prepare('INSERT INTO content_categories (content_id, category_id) VALUES (?, ?)').run(id, 'shared');
  }
  sqlite.exec(`INSERT INTO content_categories (content_id, category_id) VALUES
    ('post-draft', 'draft-only'), ('page-draft', 'draft-only'), ('page-wow', 'pages-only');`);
}

test('published slug lookups reject drafts and the wrong page type', async (t) => {
  setup(t);
  for (const [slug, type] of [['post-new', 'post'], ['page-wow', 'page']]) {
    const record = await content.getPublishedBySlugAndType(locals, slug, type);
    assert.equal(record?.slug, slug);
    assert.equal(record?.status, 'published');
    assert.equal(record?.pageType, type);
    assert.equal(await content.getPublishedBySlugAndType(locals, slug, type === 'post' ? 'page' : 'post'), null);
  }
  assert.equal(await content.getPublishedBySlugAndType(locals, 'post-draft', 'post'), null);
  assert.equal(await content.getPublishedBySlugAndType(locals, 'page-draft', 'page'), null);
});

test('homepage features and grouped tools include only featured published pages', async (t) => {
  setup(t);
  assert.deepEqual((await content.listHomepageFeatures(locals)).map(row => row.slug), ['page-poe', 'page-wow']);
  assert.deepEqual((await content.listFeaturedTools(locals, ['wow', 'poe2'])).map(row => row.slug), ['page-poe', 'page-wow']);
  const tools = await content.listFeaturedTools(locals, ['wow']);
  assert.deepEqual(tools.map(row => row.slug), ['page-wow']);
  assert.equal(tools[0].homepageGroup, 'wow');
  assert.equal(tools[0].homepageDescription, 'Tool description');
  assert.equal(tools[0].markdown, 'Opening body');
});

test('category content excludes drafts with and without a page type filter', async (t) => {
  setup(t);
  assert.deepEqual((await content.getPublishedContentByCategory(locals, 'shared')).map(row => row.slug),
    ['post-new', 'page-wow', 'post-fallback', 'page-poe', 'post-old', 'page-plain']);
  assert.deepEqual((await content.getPublishedContentByCategory(locals, 'shared', 'post')).map(row => row.slug),
    ['post-new', 'post-fallback', 'post-old']);
  assert.deepEqual((await content.getPublishedContentByCategory(locals, 'shared', 'page')).map(row => row.slug),
    ['page-wow', 'page-poe', 'page-plain']);
  assert.deepEqual(await content.getPublishedContentByCategory(locals, 'draft-only'), []);
});

test('category counts count published content of the requested type only', async (t) => {
  setup(t);
  const counts = (rows: Awaited<ReturnType<typeof content.listCategoriesWithPostCounts>>) =>
    rows.map(row => [row.slug, row.postCount]);
  assert.deepEqual(counts(await content.listCategoriesWithPostCounts(locals)), [['shared', 3]]);
  assert.deepEqual(counts(await content.listCategoriesWithPostCounts(locals, 'page')), [['pages-only', 1], ['shared', 3]]);
});

test('post summaries exclude drafts and pages and order by publication with a creation fallback', async (t) => {
  setup(t);
  const summaries = await content.listPostSummaries(locals);
  assert.deepEqual(summaries.map(row => row.slug), ['post-new', 'post-fallback', 'post-old']);
  assert.equal(summaries[0].publishedAt, 300);
  assert.equal(summaries[0].createdAt, 50);
  assert.equal(summaries[1].publishedAt, null);
  assert.equal(summaries[1].createdAt, 200);
  assert.deepEqual((await content.listPostSummaries(locals, 2)).map(row => row.slug), ['post-new', 'post-fallback']);
});
