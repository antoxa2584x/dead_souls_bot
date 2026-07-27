# Dead Souls

A Telegram bot that tracks per-user messaging activity in a private group: how much
each person posts per week, when they last spoke, when they're active during the day,
and who has gone quiet.

Records **message metadata only** — never message text. Every statistic below is
derived from timestamps, authorship and message type.

## Setup

### 1. Create the bot

In [@BotFather](https://t.me/BotFather):

1. `/newbot` → copy the token.
2. **`/setprivacy` → select your bot → `Disable`.**

Step 2 is not optional. With privacy mode on, a bot in a group receives only
commands and replies addressed to it — you would record almost nothing.

### 2. Install

```bash
npm install
cp .env.example .env      # paste your token into BOT_TOKEN, set TZ_NAME
npm run build
npm start
```

For development: `npm run dev` (watch mode). To verify the query layer: `npm run smoke`.

### 3. Add to the group

1. Add the bot to your group.
2. **Promote it to administrator.** Admin rights are required for `chat_member`
   and `message_reaction` updates — without them the bot cannot build a member
   roster or detect lurkers. It needs no special permissions beyond being an admin.
3. If you had added the bot *before* disabling privacy mode, **remove and re-add
   it** — the privacy setting is applied when the bot joins.

Run `/status` in the group to confirm everything is wired up correctly.

## Commands

| Command | What it shows |
| --- | --- |
| `/stats [period]` | Group overview: total messages, daily sparkline, top 10 |
| `/top [period]` | Full leaderboard, up to 25 people |
| `/me [@user] [period]` | Messages, per-week rate, streak, busiest hour, media split, reactions |
| `/last [@user]` | When that person last posted |
| `/when [@user] [period]` | Hour-of-day activity histogram |
| `/dead [days]` | Members quiet for N+ days, split by lurking vs. silent vs. never posted |
| `/status` | Roster coverage, privacy-mode check, tracking start date |
| `/forget` | Erase your own data (admins may reply to erase someone else's) |

`period` is `week` (default), `month`, `year`, `all`, or a plain number of days.

Reply to someone's message and run `/me`, `/last` or `/when` to target them without
typing their username.

## What the Bot API makes impossible

These are Telegram platform limits, not gaps in the implementation:

- **No history.** A bot receives messages only from the moment it joins. There is no
  backfill API. Day one of the bot is day one of the data.
- **No member enumeration.** `getChatMember`, `getChatMemberCount` and
  `getChatAdministrators` are the only member methods; nothing lists everyone. The
  roster is therefore built up over time from `chat_member` updates plus anyone who
  posts or reacts.

  The practical consequence: a member who joined before the bot and has never posted
  or reacted is **invisible**. `/dead` reports its coverage and treats its output as a
  lower bound.
- **No delete notifications.** Counts mean "messages sent", not "messages still there".
  Edits *are* tracked, via `edited_message`.
- **Anonymous admins** post as the group rather than as a user, so their messages are
  recorded against `sender_chat` and excluded from per-user statistics.

## Design notes

- **SQLite** (`better-sqlite3`, WAL mode) at `DB_PATH`. Single-writer, read-heavy —
  a good fit, and it keeps deployment to one file.
- **`day` and `hour` are denormalised onto each row** at insert time, because SQLite
  cannot convert a unix timestamp into an IANA timezone. Changing `TZ_NAME` later does
  not re-bucket existing rows.
- **Bot commands are stored with `kind = 'command'` but excluded from every statistic**,
  so running `/stats` does not inflate your own message count.
- No rollup tables. All aggregates run straight off indexed columns; for a private
  group this stays in the low milliseconds well past a million messages. If it ever
  stops being fast, a nightly `daily_stats` rollup is the next step.

## Layout

```
src/
  index.ts          entry point, allowed_updates, command registration
  config.ts         env parsing and validation
  time.ts           timezone-aware day/hour bucketing
  format.ts         monospace tables, sparklines, bars
  db/
    schema.ts       table definitions
    queries.ts      every SQL statement, prepared once
  handlers/         message, membership and reaction recording
  commands/         user-facing commands
scripts/
  smoke.ts          synthetic-traffic test of the query layer
```
