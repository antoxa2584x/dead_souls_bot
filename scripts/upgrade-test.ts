/**
 * Regression test for a bug where migrations never ran.
 *
 * db/queries.ts prepares every statement at import time. ES module imports are
 * evaluated before the importing module's body, so calling migrate() from
 * src/index.ts was too late — queries.ts threw "no such column" first and the
 * bot crash-looped on any database created by an earlier release.
 *
 * This builds a database with an older schema, then imports the query layer in
 * a fresh process. Importing must succeed and the data must survive.
 * Run: npm run upgrade-test
 */
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const DB = './data/upgrade-test.db';
const PROBE = './data/upgrade-probe.mts';

function cleanup(): void {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${DB}${suffix}`, { force: true });
  rmSync(PROBE, { force: true });
}

mkdirSync('./data', { recursive: true });
cleanup();

// A database as an earlier release would have left it: chat_settings exists
// but predates announce_ach, and the achievements table does not exist at all.
const old = new Database(DB);
old.exec(`
  CREATE TABLE chat_settings (chat_id INTEGER PRIMARY KEY, lang TEXT, dead_after_days INTEGER);
  INSERT INTO chat_settings VALUES (-100123, 'en', 45);
  CREATE TABLE users (
    user_id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT,
    is_bot INTEGER NOT NULL DEFAULT 0, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL
  );
  INSERT INTO users VALUES (7, 'grace', 'Grace', NULL, 0, 1000, 2000);
`);
old.close();

writeFileSync(
  PROBE,
  `const q = await import('../src/db/queries.js');
   const s = await import('../src/settings.js');
   console.log(JSON.stringify({
     settings: q.getChatSettings(-100123),
     lang: s.chatLang(-100123),
     days: s.chatDeadAfterDays(-100123),
     announce: s.chatAnnounceAch(-100123),
     user: q.getUser(7)?.username ?? null,
     unlocks: q.unlockedAchievements(-100123, 7).size,
   }));`,
);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}: ${JSON.stringify(actual)}`);
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}`);
    failures += 1;
  }
}

console.log('\n— upgrading a previous-release database —');

let out = '';
try {
  out = execFileSync('npx', ['tsx', PROBE], {
    encoding: 'utf8',
    env: { ...process.env, BOT_TOKEN: '0:upgrade', DB_PATH: DB, TZ_NAME: 'Europe/Kyiv' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  const e = err as { stderr?: string; stdout?: string };
  console.log(' FAIL  importing the query layer threw');
  console.log((e.stderr ?? '').split('\n').slice(0, 6).join('\n'));
  cleanup();
  process.exit(1);
}

const result = JSON.parse(out.trim().split('\n').pop()!) as Record<string, unknown>;

check('query layer imports cleanly', typeof result, 'object');
check('announce_ach column added', 'announce_ach' in (result['settings'] as object), true);
check('existing language preserved', result['lang'], 'en');
check('existing threshold preserved', result['days'], 45);
check('new setting defaults to on', result['announce'], true);
check('existing user rows preserved', result['user'], 'grace');
check('achievements table created', result['unlocks'], 0);

// The schema must be applied and migrated before anything reads it, which only
// holds while db/index.ts owns the call.
const after = new Database(DB);
const tables = (
  after.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{
    name: string;
  }>
).map((t) => t.name);
after.close();
check('achievements table exists on disk', tables.includes('achievements'), true);
check('messages table created', tables.includes('messages'), true);

cleanup();
console.log(failures ? '\nUPGRADE TEST FAILED' : '\nUpgrade path verified.\n');
process.exit(failures ? 1 : 0);
