/**
 * Exercises the storage and query layer against a throwaway database with
 * synthetic traffic. Run: npm run smoke
 */
import { rmSync } from 'node:fs';

const DB = './data/smoke-test.db';
process.env.BOT_TOKEN ??= '0:smoke';
process.env.DB_PATH = DB;
process.env.TZ_NAME ??= 'Europe/Kyiv';

rmSync(DB, { force: true });
rmSync(`${DB}-wal`, { force: true });
rmSync(`${DB}-shm`, { force: true });

const q = await import('../src/db/queries.js');
const { dayKey, humanSince, nowSeconds } = await import('../src/time.js');
const { parseRange, rangeDays } = await import('../src/commands/range.js');
const { LOCALES, dictFor } = await import('../src/i18n/index.js');
const { ukPlural } = await import('../src/i18n/plural.js');
const settings = await import('../src/settings.js');

const UK = dictFor('uk');
const EN = dictFor('en');

const CHAT = -1001234567890;
const now = nowSeconds();
const DAY = 86400;

const people = [
  { id: 1, first_name: 'Alice', username: 'alice', is_bot: false },
  { id: 2, first_name: 'Bob', username: 'bob', is_bot: false },
  { id: 3, first_name: 'Carol', username: 'carol', is_bot: false },
  { id: 4, first_name: 'Dmitri', username: 'dmitri', is_bot: false },
  { id: 5, first_name: 'Eve', username: 'eve', is_bot: false },
];

for (const p of people) {
  q.upsertUser(p, now - 90 * DAY);
  q.setMemberStatus(CHAT, p.id, 'member', now - 90 * DAY);
}

let msgId = 1000;
function post(userId: number, daysAgo: number, count: number, kind = 'text'): void {
  for (let i = 0; i < count; i++) {
    q.insertMessage({
      chatId: CHAT,
      msgId: msgId++,
      userId,
      senderChatId: null,
      ts: now - daysAgo * DAY + i * 137,
      kind,
      charLen: 20 + i,
      replyToUserId: null,
      threadId: null,
      isForward: false,
    });
  }
}

// Alice: heavy, posts every day for 10 days.
for (let d = 0; d < 10; d++) post(1, d, 5);
// Bob: moderate, only in the last 3 days.
for (let d = 0; d < 3; d++) post(2, d, 2);
// Carol: went quiet 20 days ago.
post(3, 20, 8);
// Dmitri: never posted, but reacts.
q.replaceReactions(CHAT, 1001, 4, ['👍', '🔥'], now - 2 * DAY);
// Eve: never posted, never reacted — a true dead soul.

// Bot commands must never count as activity.
post(2, 0, 50, 'command');

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}: ${JSON.stringify(actual)}`);
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

console.log('\n— leaderboard, last 7 days —');
const week = parseRange('week', UK);
const board = q.leaderboard(CHAT, week.sinceDay);
check('top poster is Alice', board[0]?.username, 'alice');
check('Alice 7d messages', board[0]?.msgs, 35);
check('Bob is second', board[1]?.username, 'bob');
check('Bob 7d messages (commands excluded)', board[1]?.msgs, 6);
check('Carol absent from 7d board', board.some((r) => r.username === 'carol'), false);

console.log('\n— chat totals —');
const totals = q.chatTotals(CHAT, week.sinceDay);
check('7d total messages', totals.msgs, 41);
check('7d distinct posters', totals.posters, 2);

console.log('\n— per-user totals —');
const alice = q.userTotals(CHAT, 1, week.sinceDay);
check('Alice active days', alice.active_days, 7);
check('Alice streak', q.currentStreak(CHAT, 1, dayKey(now)), 10);
check('Bob streak', q.currentStreak(CHAT, 2, dayKey(now)), 3);
check('Carol streak is broken', q.currentStreak(CHAT, 3, dayKey(now)), 0);

console.log('\n— all-time —');
const all = parseRange('all', UK);
check('Carol all-time messages', q.userTotals(CHAT, 3, all.sinceDay).msgs, 8);
check('Eve all-time messages', q.userTotals(CHAT, 5, all.sinceDay).msgs, 0);

console.log('\n— dead souls, 14 day cutoff —');
const cutoff = now - 14 * DAY;
const dead = q.deadSouls(CHAT, cutoff, dayKey(now - 13 * DAY));
const byName = Object.fromEntries(dead.map((d) => [d.username, d]));
check('quiet members', dead.map((d) => d.username).sort(), ['carol', 'dmitri', 'eve']);
check('Alice not listed', 'alice' in byName, false);
check('Dmitri flagged as lurker', (byName['dmitri']?.recent_reactions ?? 0) > 0, true);
check('Eve has no reactions', byName['eve']?.recent_reactions, 0);
check('Eve never posted', byName['eve']?.total_msgs, 0);
check('Carol posted before going quiet', byName['carol']?.total_msgs, 8);

console.log('\n— series and histograms —');
const series = q.dailySeries(CHAT, rangeDays(week, 21), 1);
check('daily series length', series.length, 7);
check('daily series values', series, [5, 5, 5, 5, 5, 5, 5]);
const hours = q.hourHistogram(CHAT, week.sinceDay, 1);
check('hour histogram sums to Alice 7d', hours.reduce((a, b) => a + b, 0), 35);
check('weekday histogram sums', q.weekdayHistogram(CHAT, week.sinceDay, null).reduce((a, b) => a + b, 0), 41);

console.log('\n— reactions —');
check('Dmitri reactions given', q.reactionsGiven(CHAT, 4, dayKey(now - 6 * DAY)), 2);
check('Alice reactions received', q.reactionsReceived(CHAT, 1, dayKey(now - 6 * DAY)), 2);
q.replaceReactions(CHAT, 1001, 4, ['👍'], now - DAY);
check('reactions replaced, not appended', q.reactionsGiven(CHAT, 4, dayKey(now - 6 * DAY)), 1);

console.log('\n— lookups —');
check('find by username', q.findUserByUsername('@ALICE')?.user_id, 1);
check('last message kind', q.lastMessage(CHAT, 2)?.kind, 'text');
check('roster coverage', q.rosterCoverage(CHAT), { tracked: 5, confirmed: 5 });

console.log('\n— ukrainian plurals —');
const dayForm = (n: number) => ukPlural(n, 'день', 'дні', 'днів');
check('1 день', dayForm(1), 'день');
check('2 дні', dayForm(2), 'дні');
check('5 днів', dayForm(5), 'днів');
check('11 днів (exception)', dayForm(11), 'днів');
check('14 днів (exception)', dayForm(14), 'днів');
check('21 день', dayForm(21), 'день');
check('22 дні', dayForm(22), 'дні');
check('25 днів', dayForm(25), 'днів');
check('101 день', dayForm(101), 'день');
check('112 днів (exception)', dayForm(112), 'днів');

console.log('\n— locale parity —');
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}
const ukKeys = keyPaths(UK).sort();
const enKeys = keyPaths(EN).sort();
check('locales expose identical key paths', enKeys, ukKeys);
check('both locales registered', Object.keys(LOCALES).sort(), ['en', 'uk']);
check('uk is the default locale', dictFor(undefined).code, 'uk');
check('unknown code falls back to default', dictFor('de').code, 'uk');

console.log('\n— localised strings —');
check('uk range label', parseRange('week', UK).label, 'останні 7 днів');
check('en range label', parseRange('week', EN).label, 'last 7 days');
check('uk one-day range', parseRange('1', UK).label, 'останній 1 день');
check('uk two-day range', parseRange('2', UK).label, 'останні 2 дні');
check('uk five-day range', parseRange('5', UK).label, 'останні 5 днів');
check('uk 21-day range (adjective agrees)', parseRange('21', UK).label, 'останній 21 день');
check('uk ago', humanSince(now - 3 * DAY - 3600, UK.ago), '3 дні 1 год тому');
check('en ago', humanSince(now - 3 * DAY - 3600, EN.ago), '3d 1h ago');
check('uk just now', humanSince(now, UK.ago), 'щойно');
check('uk message kind', UK.kinds['sticker'], 'стікер');
check('en message kind', EN.kinds['sticker'], 'sticker');
check('kind maps cover the same set', Object.keys(EN.kinds).sort(), Object.keys(UK.kinds).sort());

console.log('\n— per-chat settings —');
check('lang defaults to uk', settings.chatLang(CHAT), 'uk');
check('threshold defaults to env value', settings.chatDeadAfterDays(CHAT), 14);
settings.updateLang(CHAT, 'en');
check('lang override applied', settings.chatLang(CHAT), 'en');
check('lang override persisted', q.getChatLang(CHAT), 'en');
settings.updateDeadAfterDays(CHAT, 30);
check('threshold override applied', settings.chatDeadAfterDays(CHAT), 30);
check('changing threshold kept lang', settings.chatLang(CHAT), 'en');
settings.updateLang(CHAT, 'uk');
check('changing lang kept threshold', settings.chatDeadAfterDays(CHAT), 30);
check('other chats unaffected', settings.chatLang(-999), 'uk');

console.log('\n— migration —');
const { db } = await import('../src/db/index.js');
const { migrate } = await import('../src/db/migrate.js');
const cols = () =>
  (db.prepare('PRAGMA table_info(chat_settings)').all() as Array<{ name: string }>)
    .map((c) => c.name)
    .sort();
// Simulate a database created before dead_after_days existed.
db.exec('ALTER TABLE chat_settings DROP COLUMN dead_after_days');
check('column dropped', cols(), ['chat_id', 'lang']);
migrate();
check('migration restores the column', cols(), ['chat_id', 'dead_after_days', 'lang']);
migrate();
check('migration is idempotent', cols(), ['chat_id', 'dead_after_days', 'lang']);

console.log('\n— forget —');
q.forgetUser(CHAT, 1);
check('Alice erased', q.userTotals(CHAT, 1, all.sinceDay).msgs, 0);
check('roster shrank', q.rosterCoverage(CHAT).tracked, 4);
check('others untouched', q.userTotals(CHAT, 3, all.sinceDay).msgs, 8);

rmSync(DB, { force: true });
rmSync(`${DB}-wal`, { force: true });
rmSync(`${DB}-shm`, { force: true });

console.log(process.exitCode ? '\nSMOKE TEST FAILED' : '\nAll smoke checks passed.');
