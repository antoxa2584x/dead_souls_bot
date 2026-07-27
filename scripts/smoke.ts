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
const { dayKey, nowSeconds } = await import('../src/time.js');
const { parseRange, rangeDays } = await import('../src/commands/range.js');

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
const week = parseRange('week');
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
const all = parseRange('all');
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

console.log('\n— forget —');
q.forgetUser(CHAT, 1);
check('Alice erased', q.userTotals(CHAT, 1, all.sinceDay).msgs, 0);
check('roster shrank', q.rosterCoverage(CHAT).tracked, 4);
check('others untouched', q.userTotals(CHAT, 3, all.sinceDay).msgs, 8);

rmSync(DB, { force: true });
rmSync(`${DB}-wal`, { force: true });
rmSync(`${DB}-shm`, { force: true });

console.log(process.exitCode ? '\nSMOKE TEST FAILED' : '\nAll smoke checks passed.');
