import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queryRelatedPosts } from '../src/lib/related-posts.ts';
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

test('cards carry a shared category as the kicker and an excerpt from the bounded prefix', async () => {
  const { db, add } = setup();
  add('current', 500, ['wow']);
  add('other', 100, ['gaming', 'wow'], { markdown: `# Heading\n\nOpening **words** here. ${'x'.repeat(2000)}` });
  add('untagged', 50, []);
  const [other, untagged] = await queryRelatedPosts(db, 'current');
  assert.deepEqual(other.category, { name: 'World of Warcraft', slug: 'world-of-warcraft' }, 'shared category beats the alphabetical first');
  assert.ok(other.excerpt.startsWith('Opening words here.'));
  assert.ok(other.excerpt.length <= 141);
  assert.equal(untagged.id, 'untagged');
  assert.equal(untagged.category, null);
});
