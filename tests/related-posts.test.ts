import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickKicker, queryRelatedPosts } from '../src/lib/related-posts.ts';
import { makeMigratedDb, seedContent } from './helpers/d1.ts';

// seedContent adds 'post1' (published, at 0), a page and a draft post.
function setup() {
  const harness = makeMigratedDb();
  seedContent(harness.sqlite);
  harness.sqlite.exec(`
    INSERT INTO categories (id, name, slug, created_at) VALUES
      ('wow', 'World of Warcraft', 'world-of-warcraft', 0),
      ('gaming', 'Gaming', 'gaming', 0),
      ('dev', 'Development', 'development', 0);
  `);
  let n = 0;
  const add = (id: string, at: number, cats: string[], o: { status?: string; type?: string; markdown?: string } = {}) => {
    harness.sqlite.prepare(
      `INSERT INTO content (id, slug, title, markdown, page_type, status, author_id, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'admin1', ?, 0, 0)`,
    ).run(id, `${id}-${++n}`, `Title ${id}`, o.markdown ?? `Body of ${id}`, o.type ?? 'post', o.status ?? 'published', at);
    for (const cat of cats) harness.sqlite.prepare('INSERT INTO content_categories (content_id, category_id) VALUES (?, ?)').run(id, cat);
  };
  return { ...harness, add };
}

test('related posts rank by shared categories, then newest, and exclude the current post', async () => {
  const { db, add } = setup();
  add('current', 500, ['wow', 'gaming']);
  add('both-old', 100, ['wow', 'gaming']);
  add('wow-new', 400, ['wow']);
  add('gaming-newer', 450, ['gaming', 'dev']);
  add('dev-newest', 900, ['dev']);
  const related = await queryRelatedPosts(db, 'current');
  assert.deepEqual(related.map((p) => p.id), ['both-old', 'gaming-newer', 'wow-new']);
  assert.deepEqual(related.map((p) => p.sharedCategories), [2, 1, 1]);
  assert.ok(!related.some((p) => p.id === 'current'));
});

test('drafts and pages never appear', async () => {
  const { db, add } = setup();
  add('current', 500, ['wow']);
  add('wow-draft', 900, ['wow'], { status: 'draft' });
  add('wow-page', 900, ['wow'], { type: 'page' });
  add('wow-post', 100, ['wow']);
  const related = await queryRelatedPosts(db, 'current', 10);
  assert.deepEqual(related.map((p) => p.id), ['wow-post', 'post1']);
});

test('a short related row is topped up with the newest other posts, without duplicates', async () => {
  const { db, add } = setup();
  add('current', 500, ['wow', 'gaming']);
  add('wow-old', 100, ['wow', 'gaming']);
  add('dev-new', 800, ['dev']);
  add('plain-newest', 900, []);
  const related = await queryRelatedPosts(db, 'current');
  assert.deepEqual(related.map((p) => p.id), ['wow-old', 'plain-newest', 'dev-new']);
  assert.deepEqual(related.map((p) => p.sharedCategories), [2, 0, 0]);
  assert.equal(new Set(related.map((p) => p.id)).size, related.length);

  // With every other post requested, each still appears once.
  const all = await queryRelatedPosts(db, 'current', 10);
  assert.deepEqual(all.map((p) => p.id), ['wow-old', 'plain-newest', 'dev-new', 'post1']);
});

test('a post with no categories gets the newest posts', async () => {
  const { db, add } = setup();
  add('current', 500, []);
  add('a', 100, ['wow']);
  add('b', 300, ['dev']);
  const related = await queryRelatedPosts(db, 'current');
  assert.deepEqual(related.map((p) => p.id), ['b', 'a', 'post1']);
});

test('cards carry a shared category as the kicker, preferring a game one, and an excerpt from the bounded prefix', async () => {
  const { db, sqlite, add } = setup();
  sqlite.exec("INSERT INTO categories (id, name, slug, created_at) VALUES ('ai', 'AI', 'ai', 0)");
  add('current', 500, ['wow', 'gaming', 'dev']);
  add('wow-gaming', 400, ['gaming', 'wow'], { markdown: `# Heading

Opening **words** here. ${'x'.repeat(2000)}` });
  add('dev-ai', 300, ['ai', 'dev']);
  add('untagged', 200, []);
  add('ai-only', 100, ['ai']);
  const related = await queryRelatedPosts(db, 'current', 10);
  const kicker = (id: string) => related.find((p) => p.id === id)?.category;
  assert.deepEqual(kicker('wow-gaming'), { name: 'World of Warcraft', slug: 'world-of-warcraft' }, 'a game category beats Gaming, which sorts first');
  assert.deepEqual(kicker('dev-ai'), { name: 'Development', slug: 'development' }, 'a shared category beats the alphabetical first');
  assert.deepEqual(kicker('ai-only'), { name: 'AI', slug: 'ai' }, 'top-up posts fall back to their first category');
  assert.equal(kicker('untagged'), null);
  const card = related.find((p) => p.id === 'wow-gaming')!;
  assert.ok(card.excerpt.startsWith('Opening words here.'));
  assert.ok(card.excerpt.length <= 141);
});

test('kicker choice: shared game category, then shared by name, then first by name', () => {
  const c = (name: string, slug: string, shared: boolean) => ({ name, slug, shared });
  assert.equal(pickKicker([c('Gaming', 'gaming', true), c('World of Warcraft', 'world-of-warcraft', true)])?.slug, 'world-of-warcraft');
  assert.equal(pickKicker([c('Path of Exile II', 'path-of-exile-ii', false), c('Zed', 'zed', true)])?.slug, 'zed', 'an unshared game category does not beat a shared one');
  assert.equal(pickKicker([c('Gaming', 'gaming', false), c('World of Warcraft', 'world-of-warcraft', false)])?.slug, 'world-of-warcraft', 'top-up posts prefer a game category');
  assert.equal(pickKicker([c('Zed', 'zed', false), c('Alpha', 'alpha', false)])?.slug, 'alpha');
  assert.equal(pickKicker([]), null);
});

test('a WoW post topped up onto an unrelated post gets the WoW kicker, not Gaming', async () => {
  const { db, add } = setup();
  add('current', 500, ['dev']);
  add('wow-gaming', 400, ['gaming', 'wow']);
  const [card] = await queryRelatedPosts(db, 'current');
  assert.equal(card.id, 'wow-gaming');
  assert.equal(card.sharedCategories, 0);
  assert.deepEqual(card.category, { name: 'World of Warcraft', slug: 'world-of-warcraft' });
});
