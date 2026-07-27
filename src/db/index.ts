import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { migrate } from './migrate.js';
import { SCHEMA } from './schema.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

db.exec(SCHEMA);
// Must happen here, not in index.ts: db/queries.ts prepares its statements at
// import time, which is before any entry-point body runs.
migrate(db);

export function closeDb(): void {
  db.close();
}
