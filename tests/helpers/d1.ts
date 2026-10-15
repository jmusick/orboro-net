// A D1 stand-in over node:sqlite with the real schema: every file in
// migrations/ is applied in order, so tests also prove the migrations run.
// batch() is transactional like D1's.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function makeMigratedDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const statement = (sql: string, values: unknown[] = []): any => ({
    sql,
    values,
    bind: (...v: unknown[]) => statement(sql, v),
    first: async () => (sqlite.prepare(sql).get(...(values as never[])) as unknown) ?? null,
    run: async () => sqlite.prepare(sql).run(...(values as never[])),
    all: async () => ({ results: sqlite.prepare(sql).all(...(values as never[])) }),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { sql: string; values: unknown[] }[]) => {
      sqlite.exec('BEGIN');
      try {
        for (const s of statements) sqlite.prepare(s.sql).run(...(s.values as never[]));
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const one = (sql: string, ...values: unknown[]) => sqlite.prepare(sql).get(...(values as never[])) as Record<string, any> | undefined;
  return { db: db as any, sqlite, one };
}

/** Seeds an admin user and one published post and page. */
export function seedContent(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO users (id, email, password_hash, role, created_at) VALUES ('admin1', 'jd@example.com', 'x', 'admin', 0);
    INSERT INTO content (id, slug, title, markdown, page_type, status, author_id, published_at, created_at, updated_at)
      VALUES ('post1', 'hello', 'Hello', 'Body', 'post', 'published', 'admin1', 0, 0, 0),
             ('page1', 'tools', 'Tools', 'Body', 'page', 'published', 'admin1', 0, 0, 0),
             ('draft1', 'draft', 'Draft', 'Body', 'post', 'draft', 'admin1', NULL, 0, 0);
  `);
}
