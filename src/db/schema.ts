/**
 * Message *text* is deliberately never stored. Every statistic this bot
 * produces comes from metadata alone, which keeps the database from becoming
 * a copy of the group's conversations.
 *
 * `day` and `hour` are denormalised onto rows at insert time because SQLite
 * cannot convert a unix timestamp into an IANA timezone. Changing TZ_NAME
 * later therefore does not retroactively re-bucket old rows.
 */
export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id     INTEGER PRIMARY KEY,
  username    TEXT,
  first_name  TEXT,
  last_name   TEXT,
  is_bot      INTEGER NOT NULL DEFAULT 0,
  first_seen  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  chat_id   INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  status    TEXT    NOT NULL,
  -- 'chat_member' = confirmed by a membership update (authoritative)
  -- 'inferred'    = we only know they exist because they posted
  source    TEXT    NOT NULL DEFAULT 'inferred',
  joined_at INTEGER,
  left_at   INTEGER,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  chat_id          INTEGER NOT NULL,
  msg_id           INTEGER NOT NULL,
  user_id          INTEGER,
  sender_chat_id   INTEGER,
  ts               INTEGER NOT NULL,
  day              TEXT    NOT NULL,
  hour             INTEGER NOT NULL,
  kind             TEXT    NOT NULL,
  char_len         INTEGER NOT NULL DEFAULT 0,
  reply_to_user_id INTEGER,
  thread_id        INTEGER,
  is_forward       INTEGER NOT NULL DEFAULT 0,
  edited_ts        INTEGER,
  PRIMARY KEY (chat_id, msg_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_day ON messages (chat_id, user_id, day);
CREATE INDEX IF NOT EXISTS idx_messages_ts       ON messages (chat_id, ts);
CREATE INDEX IF NOT EXISTS idx_messages_day      ON messages (chat_id, day);

CREATE TABLE IF NOT EXISTS reactions (
  chat_id INTEGER NOT NULL,
  msg_id  INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji   TEXT    NOT NULL,
  ts      INTEGER NOT NULL,
  day     TEXT    NOT NULL,
  PRIMARY KEY (chat_id, msg_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_user_day ON reactions (chat_id, user_id, day);

-- Per-chat overrides. NULL means "fall back to the value from .env".
CREATE TABLE IF NOT EXISTS chat_settings (
  chat_id         INTEGER PRIMARY KEY,
  lang            TEXT,
  dead_after_days INTEGER,
  announce_ach    INTEGER
);

-- Unlock times only. Which achievements exist, and their thresholds, live in
-- code — so the catalogue can be retuned without migrating data.
CREATE TABLE IF NOT EXISTS achievements (
  chat_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  ach_id      TEXT    NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id, ach_id)
);

CREATE INDEX IF NOT EXISTS idx_ach_user ON achievements (chat_id, user_id);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
