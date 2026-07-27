import type { Database } from 'better-sqlite3';

interface ColumnInfo {
  name: string;
}

/**
 * Adds columns introduced after a database was first created, so upgrading the
 * bot never requires deleting the file. `CREATE TABLE IF NOT EXISTS` in
 * schema.ts covers new tables; this covers new columns on existing ones.
 */
function ensureColumn(db: Database, table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  if (existing.length === 0) return; // table not created yet — schema.ts owns it
  if (existing.some((c) => c.name === column)) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`migration: added ${table}.${column}`);
}

/**
 * Takes the database explicitly rather than importing it.
 *
 * This MUST run before any module that prepares statements against these
 * tables. ES module imports are evaluated before the importing module's body,
 * so calling this from index.ts would be too late: db/queries.ts prepares every
 * statement at import time and would throw "no such column" first. db/index.ts
 * therefore calls it directly, immediately after applying the schema.
 */
export function migrate(db: Database): void {
  ensureColumn(db, 'chat_settings', 'lang', 'TEXT');
  ensureColumn(db, 'chat_settings', 'dead_after_days', 'INTEGER');
  ensureColumn(db, 'chat_settings', 'announce_ach', 'INTEGER');
}
