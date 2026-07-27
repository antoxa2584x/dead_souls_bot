import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.exec(SCHEMA);

export function closeDb(): void {
  db.close();
}
