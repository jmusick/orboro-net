import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  WriteValidationError, parseNavItems, replaceNavItems, saveContentWithCategories,
} from '../src/lib/content-writes.ts';

// A D1 stand-in over node:sqlite. batch() is transactional like D1's.
function makeDb(options: { failOn?: string } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE content (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, markdown TEXT NOT NULL,
      page_type TEXT NOT NULL, status TEXT NOT NULL, author_id TEXT NOT NULL, published_at INTEGER, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, featured_image_url TEXT, homepage_featured INTEGER, homepage_group TEXT,
      homepage_order INTEGER, homepage_description TEXT);
    CREATE TABLE categories (id TEXT PRIMARY KEY);
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
    prepare: (sql: string) => make(sql),
    batch: async (statements: ReturnType<typeof make>[]) => {
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
