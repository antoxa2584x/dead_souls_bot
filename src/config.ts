import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function idList(name: string): number[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

const timezone = process.env.TZ_NAME ?? 'UTC';

// Fail at startup rather than on the first message.
try {
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
} catch {
  throw new Error(`TZ_NAME is not a valid IANA timezone: ${timezone}`);
}

export const config = {
  botToken: required('BOT_TOKEN'),
  dbPath: process.env.DB_PATH ?? './data/dead_souls.db',
  timezone,
  deadAfterDays: Number(process.env.DEAD_AFTER_DAYS ?? 14),
  allowedChatIds: idList('ALLOWED_CHAT_IDS'),
  adminUserIds: idList('ADMIN_USER_IDS'),
};

export function isChatAllowed(chatId: number): boolean {
  return config.allowedChatIds.length === 0 || config.allowedChatIds.includes(chatId);
}
