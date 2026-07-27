import { db } from './index.js';

interface ColumnInfo {
  name: string;
}

/**
 * Adds columns introduced after a database was first created, so upgrading the
 * bot never requires deleting the file. `CREATE TABLE IF NOT EXISTS` in
 * schema.ts covers new tables; this covers new columns on existing ones.
 */
function ensureColumn(table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  if (existing.length === 0) return; // table not created yet — schema.ts owns it
  if (existing.some((c) => c.name === column)) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`migration: added ${table}.${column}`);
}

export function migrate(): void {
  ensureColumn('chat_settings', 'lang', 'TEXT');
  ensureColumn('chat_settings', 'dead_after_days', 'INTEGER');
  ensureColumn('chat_settings', 'announce_ach', 'INTEGER');
}
