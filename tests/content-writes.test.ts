import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  MAX_CATEGORIES_PER_CONTENT, MAX_MARKDOWN_LENGTH, MAX_TITLE_LENGTH,
  WriteValidationError, isAllowedImageUrl, parseNavItems, parseRecordId, replaceNavItems,
  saveCategoryRecord, saveContentWithCategories, validateContentInput, validateMediaInput,
} from '../src/lib/content-writes.ts';

// A D1 stand-in over node:sqlite. batch() is transactional like D1's.
function makeDb(options: { failOn?: string } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE content (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, markdown TEXT NOT NULL,
      page_type TEXT NOT NULL, status TEXT NOT NULL, author_id TEXT NOT NULL, published_at INTEGER, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, featured_image_url TEXT, homepage_featured INTEGER, homepage_group TEXT,
      homepage_order INTEGER, homepage_description TEXT, comments_mode TEXT NOT NULL DEFAULT 'open');
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT, slug TEXT UNIQUE, created_at INTEGER);
    CREATE TABLE content_categories (content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE, PRIMARY KEY (content_id, category_id));
    CREATE TABLE nav_items (id TEXT PRIMARY KEY, label TEXT NOT NULL, content_id TEXT REFERENCES content(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
      parent_item_id TEXT REFERENCES nav_items(id) ON DELETE CASCADE);
  `);
  const make = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...v: unknown[]) => make(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(values as never[])) }),
  });
  const db = {
    batches: 0,
    prepare: (sql: string) => make(sql),
    batch: async (statements: ReturnType<typeof make>[]) => {
      db.batches += 1;
      sqlite.exec('BEGIN');
      try {
        for (const s of statements) {
          if (options.failOn && s.sql.includes(options.failOn)) throw new Error('injected failure');
          sqlite.prepare(s.sql).run(...(s.values as never[]));
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db: db as any, sqlite };
}

const rows = (sqlite: DatabaseSync, sql: string) => JSON.parse(JSON.stringify(sqlite.prepare(sql).all()));

function seed(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO content (id, slug, title, markdown, page_type, status, author_id, created_at, updated_at)
      VALUES ('p1','one','One','x','page','published','u',1,1), ('p2','two','Two','x','page','published','u',1,1);
    INSERT INTO categories (id) VALUES ('c1'), ('c2');
    INSERT INTO nav_items (id, label, content_id, sort_order, created_at) VALUES ('old','Old','p1',0,1);
    INSERT INTO content_categories (content_id, category_id) VALUES ('p1','c1');
  `);
}

const item = (clientId: string, parentId?: string | null, extra: object = {}) =>
  ({ clientId, contentId: 'p1', label: clientId, sortOrder: 0, parentId, ...extra });
const raw = (items: unknown[]) => JSON.stringify(items);

test('non-array JSON and malformed JSON are rejected, an empty array is accepted', () => {
  assert.throws(() => parseNavItems('{"a":1}'), WriteValidationError);
  assert.throws(() => parseNavItems('"x"'), WriteValidationError);
  assert.throws(() => parseNavItems('null'), WriteValidationError);
  assert.throws(() => parseNavItems('{oops'), WriteValidationError);
  assert.deepEqual(parseNavItems('[]'), []);
});

test('malformed items, duplicate IDs, bad references and cycles are rejected', () => {
  assert.throws(() => parseNavItems(raw([item('a', null, { label: '  ' })])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', null, { contentId: undefined })])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', null, { sortOrder: 'NaN' })])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', null, { sortOrder: 1.5 })])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a'), item('a')])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', 'missing')])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', 'a')])), WriteValidationError);
  assert.throws(() => parseNavItems(raw([item('a', 'b'), item('b', 'c'), item('c', 'a')])), WriteValidationError);
});

test('parents are ordered ahead of children whatever the input order', () => {
  const ordered = parseNavItems(raw([item('c', 'b'), item('b', 'a'), item('a')])).map((i) => i.clientId);
  assert.deepEqual(ordered, ['a', 'b', 'c']);
});

test('replaceNavItems writes the tree and links parents', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  await replaceNavItems(db, parseNavItems(raw([item('child', 'top', { sortOrder: 1 }), item('top')])), 5);
  const nav = rows(sqlite, 'SELECT id, label, parent_item_id FROM nav_items ORDER BY label');
  assert.equal(nav.length, 2);
  const top = nav.find((r: any) => r.label === 'top');
  assert.equal(nav.find((r: any) => r.label === 'child').parent_item_id, top.id);
  assert.equal(top.parent_item_id, null);
});

test('an unknown page rejects the save and keeps the previous navigation', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  await assert.rejects(
    replaceNavItems(db, parseNavItems(raw([item('a', null, { contentId: 'nope' })])), 5),
    WriteValidationError,
  );
  assert.deepEqual(rows(sqlite, 'SELECT id FROM nav_items'), [{ id: 'old' }]);
});

test('an insert failure rolls back the nav delete', async () => {
  const { db, sqlite } = makeDb({ failOn: 'INSERT INTO nav_items' });
  seed(sqlite);
  await assert.rejects(replaceNavItems(db, parseNavItems(raw([item('a')])), 5), /injected failure/);
  assert.deepEqual(rows(sqlite, 'SELECT id FROM nav_items'), [{ id: 'old' }]);
});

const content = (extra: object = {}) => ({
  id: 'p1', slug: 'one', title: 'One v2', markdown: 'x', pageType: 'page', status: 'published' as const,
  authorId: 'u', categoryIds: ['c2'], ...extra,
});

test('content and categories are saved together', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  await saveContentWithCategories(db, content(), 9);
  assert.equal((sqlite.prepare("SELECT title FROM content WHERE id = 'p1'").get() as any).title, 'One v2');
  assert.deepEqual(rows(sqlite, "SELECT category_id FROM content_categories WHERE content_id = 'p1'"), [{ category_id: 'c2' }]);
});

test('a new content row gets its categories', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  const id = await saveContentWithCategories(db, content({ id: undefined, slug: 'three', categoryIds: ['c1', 'c1', 'c2'] }), 9, () => 'new-id');
  assert.equal(id, 'new-id');
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM content_categories WHERE content_id = 'new-id'").get() as any).n, 2);
});

test('an unknown category rejects the whole save', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  await assert.rejects(saveContentWithCategories(db, content({ categoryIds: ['c2', 'zzz'] }), 9), WriteValidationError);
  assert.equal((sqlite.prepare("SELECT title FROM content WHERE id = 'p1'").get() as any).title, 'One');
  assert.deepEqual(rows(sqlite, "SELECT category_id FROM content_categories WHERE content_id = 'p1'"), [{ category_id: 'c1' }]);
});

test('a category insert failure rolls back the content update and the delete', async () => {
  const { db, sqlite } = makeDb({ failOn: 'INSERT INTO content_categories' });
  seed(sqlite);
  await assert.rejects(saveContentWithCategories(db, content(), 9), /injected failure/);
  assert.equal((sqlite.prepare("SELECT title FROM content WHERE id = 'p1'").get() as any).title, 'One');
  assert.deepEqual(rows(sqlite, "SELECT category_id FROM content_categories WHERE content_id = 'p1'"), [{ category_id: 'c1' }]);
});

// Field validation

const snapshot = (sqlite: DatabaseSync) => ({
  content: rows(sqlite, 'SELECT * FROM content ORDER BY id'),
  categories: rows(sqlite, 'SELECT * FROM categories ORDER BY id'),
  links: rows(sqlite, 'SELECT * FROM content_categories ORDER BY content_id, category_id'),
});

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof WriteValidationError) return error.code;
    throw error;
  }
  return null;
};

test('image URLs are limited to https:// and root-relative site paths', () => {
  for (const ok of ['https://media.orboro.net/images/a.webp', '/media/uploads/2026/10/a.png', '/images/x.jpg?v=2']) {
    assert.equal(isAllowedImageUrl(ok), true, ok);
  }
  for (const bad of [
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:image/png;base64,AAAA', 'http://example.com/a.png',
    '//evil.example/a.png', '/\\evil.example/a.png', 'https://user:pw@example.com/a.png', 'images/a.png',
    ' https://example.com/a.png', 'https://example.com/a b.png', 'ftp://example.com/a.png',
    'vbscript:x', `https://example.com/${'a'.repeat(2048)}`, '',
  ]) {
    assert.equal(isAllowedImageUrl(bad), false, bad);
  }
});

test('record IDs are bounded and free of whitespace and control characters', () => {
  assert.equal(parseRecordId(' abc-123 '), 'abc-123');
  for (const bad of ['', '   ', 'a b', 'a\u0000b', 'x'.repeat(101), null, 5, undefined]) {
    assert.equal(parseRecordId(bad), null, JSON.stringify(bad));
  }
});

test('content fields, enums and limits are checked with the right error code', () => {
  const input = (extra: object = {}) => content({ id: undefined, ...extra });
  assert.equal(codeOf(() => validateContentInput(input())), null);
  assert.equal(codeOf(() => validateContentInput(input({ pageType: 'category' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ pageType: '' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ status: 'archived' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ title: '  ' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ markdown: 'x'.repeat(MAX_MARKDOWN_LENGTH + 1) }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ slug: 'Not A Slug' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ slug: '' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ id: 'has space' }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ categoryIds: Array.from({ length: MAX_CATEGORIES_PER_CONTENT + 1 }, () => 'c1') }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ categoryIds: ['c1', ''] }))), 'invalid');
  assert.equal(codeOf(() => validateContentInput(input({ featuredImageUrl: 'javascript:alert(1)' }))), 'image');
  assert.equal(codeOf(() => validateContentInput(input({ featuredImageUrl: 'http://example.com/a.png' }))), 'image');
  assert.equal(codeOf(() => validateContentInput(input({ featuredImageUrl: 'data:image/png;base64,AA' }))), 'image');
  assert.equal(codeOf(() => validateContentInput(input({ featuredImageUrl: '/media/a.png' }))), null);
  assert.equal(codeOf(() => validateContentInput(input({ homepageGroup: 'diablo' }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageOrder: Number.NaN }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageOrder: Infinity }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageOrder: 1.5 }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageOrder: -1 }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageOrder: 10_000 }))), 'homepage');
  assert.equal(codeOf(() => validateContentInput(input({ homepageDescription: 'x'.repeat(241) }))), 'homepage');
});

test('invalid content input writes nothing', async () => {
  for (const bad of [
    { pageType: 'nope' }, { status: 'archived' }, { featuredImageUrl: 'javascript:alert(1)' },
    { homepageGroup: 'nope' }, { homepageOrder: Number.NaN }, { markdown: '' },
    { id: 'missing' }, { slug: 'two' }, { categoryIds: ['zzz'] },
  ]) {
    const { db, sqlite } = makeDb();
    seed(sqlite);
    const before = snapshot(sqlite);
    await assert.rejects(saveContentWithCategories(db, content(bad), 9), WriteValidationError, JSON.stringify(bad));
    assert.equal(db.batches, 0, JSON.stringify(bad));
    assert.deepEqual(snapshot(sqlite), before);
  }
});

test('a new row may not take an existing slug; an edit may keep its own', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  await assert.rejects(saveContentWithCategories(db, content({ id: undefined, slug: 'one' }), 9), WriteValidationError);
  await saveContentWithCategories(db, content({ slug: 'one' }), 9);
  assert.equal((sqlite.prepare("SELECT title FROM content WHERE id = 'p1'").get() as any).title, 'One v2');
});

test('categories are validated, must exist when edited and keep unique slugs', async () => {
  const { db, sqlite } = makeDb();
  seed(sqlite);
  sqlite.exec("UPDATE categories SET name = 'One', slug = 'one' WHERE id = 'c1'");
  const before = snapshot(sqlite);
  for (const bad of [
    { name: '', slug: 'x' }, { name: 'x'.repeat(101), slug: 'x' }, { name: 'X', slug: 'Bad Slug' },
    { id: 'missing', name: 'X', slug: 'x' }, { name: 'X', slug: 'one' }, { id: 'c2', name: 'X', slug: 'one' },
  ]) {
    await assert.rejects(saveCategoryRecord(db, bad, 9), WriteValidationError, JSON.stringify(bad));
  }
  assert.equal(db.batches, 0);
  assert.deepEqual(snapshot(sqlite), before);

  assert.equal(await saveCategoryRecord(db, { name: 'New', slug: 'new' }, 9, () => 'c3'), 'c3');
  assert.equal(await saveCategoryRecord(db, { id: 'c1', name: 'Renamed', slug: 'one' }, 9), 'c1');
  assert.deepEqual(rows(sqlite, "SELECT id, name, slug FROM categories WHERE id IN ('c1','c3') ORDER BY id"),
    [{ id: 'c1', name: 'Renamed', slug: 'one' }, { id: 'c3', name: 'New', slug: 'new' }]);
});

test('media records need an allowed URL, alt text and bounded fields', () => {
  const media = (extra: object = {}) => ({ url: 'https://media.orboro.net/a.png', altText: 'Alt', caption: '', ...extra });
  assert.doesNotThrow(() => validateMediaInput(media()));
  assert.doesNotThrow(() => validateMediaInput(media({ url: '/media/uploads/a.png' })));
  for (const bad of [
    { url: 'javascript:alert(1)' }, { url: 'data:image/png;base64,AA' }, { url: 'http://example.com/a.png' },
    { url: '' }, { altText: '' }, { altText: 'x'.repeat(501) }, { caption: 'x'.repeat(1001) },
  ]) {
    assert.throws(() => validateMediaInput(media(bad)), WriteValidationError, JSON.stringify(bad));
  }
});
