import { db } from './index.js';
import { dayKey, hourOf, nowSeconds } from '../time.js';

export interface UserLike {
  id: number;
  username?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  is_bot?: boolean | undefined;
}

export interface PersonRow {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface LeaderRow extends PersonRow {
  msgs: number;
  chars: number;
  active_days: number;
  last_ts: number;
}

export interface DeadRow extends PersonRow {
  last_msg_ts: number | null;
  total_msgs: number;
  recent_reactions: number;
  source: string;
  joined_at: number | null;
}

/** Statuses that mean "currently in the chat". */
const ACTIVE_STATUSES = ['creator', 'administrator', 'member', 'restricted'];

/**
 * Bot commands are stored (they prove the user was present) but excluded from
 * every activity statistic — otherwise running /stats would inflate your own
 * message count.
 */
const REAL_MESSAGE = `kind != 'command'`;

// ---------------------------------------------------------------- writes

const upsertUserStmt = db.prepare(`
  INSERT INTO users (user_id, username, first_name, last_name, is_bot, first_seen, last_seen)
  VALUES (@user_id, @username, @first_name, @last_name, @is_bot, @ts, @ts)
  ON CONFLICT(user_id) DO UPDATE SET
    username   = excluded.username,
    first_name = excluded.first_name,
    last_name  = excluded.last_name,
    is_bot     = excluded.is_bot,
    last_seen  = MAX(users.last_seen, excluded.last_seen)
`);

export function upsertUser(user: UserLike, ts: number): void {
  upsertUserStmt.run({
    user_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    is_bot: user.is_bot ? 1 : 0,
    ts,
  });
}

/**
 * Record membership learned from a posted message. Never downgrades a row that
 * a real `chat_member` update already confirmed, and never resurrects someone
 * we know has left.
 */
const inferMemberStmt = db.prepare(`
  INSERT INTO members (chat_id, user_id, status, source, joined_at)
  VALUES (?, ?, 'member', 'inferred', ?)
  ON CONFLICT(chat_id, user_id) DO NOTHING
`);

export function inferMember(chatId: number, userId: number, ts: number): void {
  inferMemberStmt.run(chatId, userId, ts);
}

const setMemberStmt = db.prepare(`
  INSERT INTO members (chat_id, user_id, status, source, joined_at, left_at)
  VALUES (@chat_id, @user_id, @status, 'chat_member', @joined_at, @left_at)
  ON CONFLICT(chat_id, user_id) DO UPDATE SET
    status    = excluded.status,
    source    = 'chat_member',
    joined_at = COALESCE(members.joined_at, excluded.joined_at),
    left_at   = excluded.left_at
`);

export function setMemberStatus(
  chatId: number,
  userId: number,
  status: string,
  ts: number,
): void {
  const active = ACTIVE_STATUSES.includes(status);
  setMemberStmt.run({
    chat_id: chatId,
    user_id: userId,
    status,
    joined_at: active ? ts : null,
    left_at: active ? null : ts,
  });
}

export interface MessageInput {
  chatId: number;
  msgId: number;
  userId: number | null;
  senderChatId: number | null;
  ts: number;
  kind: string;
  charLen: number;
  replyToUserId: number | null;
  threadId: number | null;
  isForward: boolean;
}

const insertMessageStmt = db.prepare(`
  INSERT INTO messages
    (chat_id, msg_id, user_id, sender_chat_id, ts, day, hour, kind, char_len,
     reply_to_user_id, thread_id, is_forward)
  VALUES
    (@chat_id, @msg_id, @user_id, @sender_chat_id, @ts, @day, @hour, @kind, @char_len,
     @reply_to_user_id, @thread_id, @is_forward)
  ON CONFLICT(chat_id, msg_id) DO NOTHING
`);

export function insertMessage(m: MessageInput): void {
  insertMessageStmt.run({
    chat_id: m.chatId,
    msg_id: m.msgId,
    user_id: m.userId,
    sender_chat_id: m.senderChatId,
    ts: m.ts,
    day: dayKey(m.ts),
    hour: hourOf(m.ts),
    kind: m.kind,
    char_len: m.charLen,
    reply_to_user_id: m.replyToUserId,
    thread_id: m.threadId,
    is_forward: m.isForward ? 1 : 0,
  });
}

const markEditedStmt = db.prepare(
  `UPDATE messages SET edited_ts = ? WHERE chat_id = ? AND msg_id = ?`,
);

export function markEdited(chatId: number, msgId: number, ts: number): void {
  markEditedStmt.run(ts, chatId, msgId);
}

const clearReactionsStmt = db.prepare(
  `DELETE FROM reactions WHERE chat_id = ? AND msg_id = ? AND user_id = ?`,
);
const insertReactionStmt = db.prepare(`
  INSERT INTO reactions (chat_id, msg_id, user_id, emoji, ts, day)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT DO NOTHING
`);

/** Replace one user's reactions on one message with the new set. */
export const replaceReactions = db.transaction(
  (chatId: number, msgId: number, userId: number, emojis: string[], ts: number) => {
    clearReactionsStmt.run(chatId, msgId, userId);
    const day = dayKey(ts);
    for (const emoji of emojis) {
      insertReactionStmt.run(chatId, msgId, userId, emoji, ts, day);
    }
  },
);

// ---------------------------------------------------------------- reads

const leaderboardStmt = db.prepare(`
  SELECT m.user_id            AS user_id,
         u.username           AS username,
         u.first_name         AS first_name,
         u.last_name          AS last_name,
         COUNT(*)             AS msgs,
         SUM(m.char_len)      AS chars,
         COUNT(DISTINCT m.day) AS active_days,
         MAX(m.ts)            AS last_ts
  FROM messages m
  LEFT JOIN users u ON u.user_id = m.user_id
  WHERE m.chat_id = ? AND m.day >= ? AND m.user_id IS NOT NULL AND m.${REAL_MESSAGE}
  GROUP BY m.user_id
  ORDER BY msgs DESC
`);

export function leaderboard(chatId: number, sinceDay: string): LeaderRow[] {
  return leaderboardStmt.all(chatId, sinceDay) as LeaderRow[];
}

const chatTotalsStmt = db.prepare(`
  SELECT COUNT(*)                  AS msgs,
         COUNT(DISTINCT m.user_id) AS posters,
         COUNT(DISTINCT m.day)     AS days,
         SUM(m.char_len)           AS chars
  FROM messages m
  WHERE m.chat_id = ? AND m.day >= ? AND m.${REAL_MESSAGE}
`);

export interface ChatTotals {
  msgs: number;
  posters: number;
  days: number;
  chars: number | null;
}

export function chatTotals(chatId: number, sinceDay: string): ChatTotals {
  return chatTotalsStmt.get(chatId, sinceDay) as ChatTotals;
}

const userTotalsStmt = db.prepare(`
  SELECT COUNT(*)              AS msgs,
         SUM(m.char_len)       AS chars,
         COUNT(DISTINCT m.day) AS active_days,
         MAX(m.ts)             AS last_ts,
         MIN(m.ts)             AS first_ts
  FROM messages m
  WHERE m.chat_id = ? AND m.user_id = ? AND m.day >= ? AND m.${REAL_MESSAGE}
`);

export interface UserTotals {
  msgs: number;
  chars: number | null;
  active_days: number;
  last_ts: number | null;
  first_ts: number | null;
}

export function userTotals(chatId: number, userId: number, sinceDay: string): UserTotals {
  return userTotalsStmt.get(chatId, userId, sinceDay) as UserTotals;
}

const kindBreakdownStmt = db.prepare(`
  SELECT kind, COUNT(*) AS n
  FROM messages
  WHERE chat_id = ? AND user_id = ? AND day >= ? AND ${REAL_MESSAGE}
  GROUP BY kind
  ORDER BY n DESC
`);

export function kindBreakdown(
  chatId: number,
  userId: number,
  sinceDay: string,
): Array<{ kind: string; n: number }> {
  return kindBreakdownStmt.all(chatId, userId, sinceDay) as Array<{ kind: string; n: number }>;
}

const hourHistogramStmt = db.prepare(`
  SELECT hour, COUNT(*) AS n
  FROM messages
  WHERE chat_id = ? AND day >= ? AND (? IS NULL OR user_id = ?) AND ${REAL_MESSAGE}
  GROUP BY hour
`);

export function hourHistogram(
  chatId: number,
  sinceDay: string,
  userId: number | null,
): number[] {
  const rows = hourHistogramStmt.all(chatId, sinceDay, userId, userId) as Array<{
    hour: number;
    n: number;
  }>;
  const buckets = new Array<number>(24).fill(0);
  for (const row of rows) buckets[row.hour] = row.n;
  return buckets;
}

const weekdayHistogramStmt = db.prepare(`
  SELECT CAST(strftime('%w', day) AS INTEGER) AS dow, COUNT(*) AS n
  FROM messages
  WHERE chat_id = ? AND day >= ? AND (? IS NULL OR user_id = ?) AND ${REAL_MESSAGE}
  GROUP BY dow
`);

/** Index 0 = Sunday, matching strftime('%w'). */
export function weekdayHistogram(
  chatId: number,
  sinceDay: string,
  userId: number | null,
): number[] {
  const rows = weekdayHistogramStmt.all(chatId, sinceDay, userId, userId) as Array<{
    dow: number;
    n: number;
  }>;
  const buckets = new Array<number>(7).fill(0);
  for (const row of rows) buckets[row.dow] = row.n;
  return buckets;
}

const dailyCountsStmt = db.prepare(`
  SELECT day, COUNT(*) AS n
  FROM messages
  WHERE chat_id = ? AND day >= ? AND (? IS NULL OR user_id = ?) AND ${REAL_MESSAGE}
  GROUP BY day
`);

/** Message counts per calendar day, zero-filled across the whole range. */
export function dailySeries(
  chatId: number,
  days: string[],
  userId: number | null,
): number[] {
  const first = days[0];
  if (first === undefined) return [];
  const rows = dailyCountsStmt.all(chatId, first, userId, userId) as Array<{
    day: string;
    n: number;
  }>;
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  return days.map((d) => byDay.get(d) ?? 0);
}

const weeklyCountsStmt = db.prepare(`
  SELECT strftime('%Y-%W', day) AS week, COUNT(*) AS n
  FROM messages
  WHERE chat_id = ? AND day >= ? AND (? IS NULL OR user_id = ?) AND ${REAL_MESSAGE}
  GROUP BY week
  ORDER BY week DESC
  LIMIT ?
`);

/** Most recent ISO-ish weeks first. */
export function weeklyCounts(
  chatId: number,
  sinceDay: string,
  userId: number | null,
  limit: number,
): Array<{ week: string; n: number }> {
  return weeklyCountsStmt.all(chatId, sinceDay, userId, userId, limit) as Array<{
    week: string;
    n: number;
  }>;
}

const reactionsGivenStmt = db.prepare(
  `SELECT COUNT(*) AS n FROM reactions WHERE chat_id = ? AND user_id = ? AND day >= ?`,
);

export function reactionsGiven(chatId: number, userId: number, sinceDay: string): number {
  return (reactionsGivenStmt.get(chatId, userId, sinceDay) as { n: number }).n;
}

const reactionsReceivedStmt = db.prepare(`
  SELECT COUNT(*) AS n
  FROM reactions r
  JOIN messages m ON m.chat_id = r.chat_id AND m.msg_id = r.msg_id
  WHERE r.chat_id = ? AND m.user_id = ? AND r.day >= ?
`);

export function reactionsReceived(chatId: number, userId: number, sinceDay: string): number {
  return (reactionsReceivedStmt.get(chatId, userId, sinceDay) as { n: number }).n;
}

const activeDaysStmt = db.prepare(
  `SELECT DISTINCT day FROM messages
   WHERE chat_id = ? AND user_id = ? AND ${REAL_MESSAGE}
   ORDER BY day DESC LIMIT 400`,
);

/** Consecutive days ending today or yesterday on which the user posted. */
export function currentStreak(chatId: number, userId: number, today: string): number {
  const days = (activeDaysStmt.all(chatId, userId) as Array<{ day: string }>).map((r) => r.day);
  if (days.length === 0) return 0;

  const dayBefore = (d: string): string => {
    const t = Date.parse(`${d}T00:00:00Z`) - 86400_000;
    return new Date(t).toISOString().slice(0, 10);
  };

  let expected = today;
  if (days[0] !== today) {
    const yesterday = dayBefore(today);
    if (days[0] !== yesterday) return 0;
    expected = yesterday;
  }

  let streak = 0;
  for (const day of days) {
    if (day !== expected) break;
    streak += 1;
    expected = dayBefore(expected);
  }
  return streak;
}

const deadSoulsStmt = db.prepare(`
  SELECT * FROM (
    SELECT m.user_id     AS user_id,
           u.username    AS username,
           u.first_name  AS first_name,
           u.last_name   AS last_name,
           m.source      AS source,
           m.joined_at   AS joined_at,
           (SELECT MAX(ts) FROM messages x
             WHERE x.chat_id = m.chat_id AND x.user_id = m.user_id
               AND x.${REAL_MESSAGE}) AS last_msg_ts,
           (SELECT COUNT(*) FROM messages x
             WHERE x.chat_id = m.chat_id AND x.user_id = m.user_id
               AND x.${REAL_MESSAGE}) AS total_msgs,
           (SELECT COUNT(*) FROM reactions r
             WHERE r.chat_id = m.chat_id AND r.user_id = m.user_id AND r.day >= ?) AS recent_reactions
    FROM members m
    LEFT JOIN users u ON u.user_id = m.user_id
    WHERE m.chat_id = ?
      AND m.status IN ('creator', 'administrator', 'member', 'restricted')
      AND COALESCE(u.is_bot, 0) = 0
  )
  WHERE last_msg_ts IS NULL OR last_msg_ts < ?
  ORDER BY COALESCE(last_msg_ts, 0) ASC
`);

export function deadSouls(
  chatId: number,
  cutoffTs: number,
  reactionsSinceDay: string,
): DeadRow[] {
  return deadSoulsStmt.all(reactionsSinceDay, chatId, cutoffTs) as DeadRow[];
}

const trackedMembersStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM members
  WHERE chat_id = ? AND status IN ('creator', 'administrator', 'member', 'restricted')
`);

const confirmedMembersStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM members
  WHERE chat_id = ? AND source = 'chat_member'
    AND status IN ('creator', 'administrator', 'member', 'restricted')
`);

export function rosterCoverage(chatId: number): { tracked: number; confirmed: number } {
  return {
    tracked: (trackedMembersStmt.get(chatId) as { n: number }).n,
    confirmed: (confirmedMembersStmt.get(chatId) as { n: number }).n,
  };
}

const findUserByNameStmt = db.prepare(`
  SELECT user_id, username, first_name, last_name FROM users
  WHERE LOWER(username) = LOWER(?)
  LIMIT 1
`);

export function findUserByUsername(username: string): PersonRow | undefined {
  return findUserByNameStmt.get(username.replace(/^@/, '')) as PersonRow | undefined;
}

const getUserStmt = db.prepare(
  `SELECT user_id, username, first_name, last_name FROM users WHERE user_id = ?`,
);

export function getUser(userId: number): PersonRow | undefined {
  return getUserStmt.get(userId) as PersonRow | undefined;
}

const lastMessageStmt = db.prepare(`
  SELECT ts, kind, msg_id FROM messages
  WHERE chat_id = ? AND user_id = ? AND ${REAL_MESSAGE}
  ORDER BY ts DESC LIMIT 1
`);

export function lastMessage(
  chatId: number,
  userId: number,
): { ts: number; kind: string; msg_id: number } | undefined {
  return lastMessageStmt.get(chatId, userId) as
    | { ts: number; kind: string; msg_id: number }
    | undefined;
}

const trackingSinceStmt = db.prepare(`SELECT MIN(ts) AS ts FROM messages WHERE chat_id = ?`);

export function trackingSince(chatId: number): number {
  return (trackingSinceStmt.get(chatId) as { ts: number | null }).ts ?? nowSeconds();
}

export interface ChatSettings {
  lang: string | null;
  dead_after_days: number | null;
}

const getChatSettingsStmt = db.prepare(
  `SELECT lang, dead_after_days FROM chat_settings WHERE chat_id = ?`,
);

export function getChatSettings(chatId: number): ChatSettings | undefined {
  return getChatSettingsStmt.get(chatId) as ChatSettings | undefined;
}

export function getChatLang(chatId: number): string | undefined {
  return getChatSettings(chatId)?.lang ?? undefined;
}

const setChatLangStmt = db.prepare(`
  INSERT INTO chat_settings (chat_id, lang) VALUES (?, ?)
  ON CONFLICT(chat_id) DO UPDATE SET lang = excluded.lang
`);

export function setChatLang(chatId: number, lang: string): void {
  setChatLangStmt.run(chatId, lang);
}

const setDeadAfterDaysStmt = db.prepare(`
  INSERT INTO chat_settings (chat_id, dead_after_days) VALUES (?, ?)
  ON CONFLICT(chat_id) DO UPDATE SET dead_after_days = excluded.dead_after_days
`);

export function setDeadAfterDays(chatId: number, days: number): void {
  setDeadAfterDaysStmt.run(chatId, days);
}

const forgetUserTx = db.transaction((chatId: number, userId: number) => {
  db.prepare(`DELETE FROM messages  WHERE chat_id = ? AND user_id = ?`).run(chatId, userId);
  db.prepare(`DELETE FROM reactions WHERE chat_id = ? AND user_id = ?`).run(chatId, userId);
  db.prepare(`DELETE FROM members   WHERE chat_id = ? AND user_id = ?`).run(chatId, userId);
});

/** Erase everything recorded about one user in one chat. */
export function forgetUser(chatId: number, userId: number): void {
  forgetUserTx(chatId, userId);
}
