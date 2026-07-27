import { Bot, GrammyError, HttpError } from 'grammy';
import type { LanguageCode } from 'grammy/types';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { LOCALES, dictFor, type Dict } from './i18n/index.js';
import { registerMessageHandlers } from './handlers/messages.js';
import { registerMemberHandlers } from './handlers/members.js';
import { registerReactionHandlers } from './handlers/reactions.js';
import { registerStatsCommands } from './commands/stats.js';
import { registerProfileCommands } from './commands/profile.js';
import { registerDeadCommand } from './commands/dead.js';
import { registerSettingsCommand } from './commands/settings.js';
import { registerMiscCommands } from './commands/misc.js';

/**
 * `chat_member` and `message_reaction` are NOT delivered by default — they must
 * be requested explicitly and the bot must be a group administrator. Without
 * them the roster never fills in and /dead cannot tell lurkers from leavers.
 */
const ALLOWED_UPDATES = [
  'message',
  'edited_message',
  'chat_member',
  'my_chat_member',
  'message_reaction',
  'callback_query',
] as const;

migrate();

const bot = new Bot(config.botToken);

// Recording runs first and calls next(), so commands still reach their handlers.
registerMessageHandlers(bot);
registerMemberHandlers(bot);
registerReactionHandlers(bot);

registerStatsCommands(bot);
registerProfileCommands(bot);
registerDeadCommand(bot);
registerSettingsCommand(bot);
registerMiscCommands(bot);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`error while handling update ${ctx.update.update_id}:`);
  if (err.error instanceof GrammyError) {
    console.error('telegram api:', err.error.description);
  } else if (err.error instanceof HttpError) {
    console.error('network:', err.error);
  } else {
    console.error(err.error);
  }
});

function commandList(d: Dict) {
  return [
    { command: 'stats', description: d.commands.stats },
    { command: 'top', description: d.commands.top },
    { command: 'me', description: d.commands.me },
    { command: 'last', description: d.commands.last },
    { command: 'when', description: d.commands.when },
    { command: 'dead', description: d.commands.dead },
    { command: 'settings', description: d.commands.settings },
    { command: 'status', description: d.commands.status },
    { command: 'help', description: d.commands.help },
  ];
}

async function publishCommands(): Promise<void> {
  // The list without a language_code is the fallback for every client.
  await bot.api.setMyCommands(commandList(dictFor(config.defaultLang)));

  for (const [code, locale] of Object.entries(LOCALES)) {
    await bot.api.setMyCommands(commandList(locale), {
      language_code: code as LanguageCode,
    });
  }
}

async function main(): Promise<void> {
  const me = await bot.api.getMe();
  await publishCommands();

  console.log(`starting as @${me.username} (id ${me.id})`);
  if (!me.can_read_all_group_messages) {
    console.warn(
      '⚠️  Privacy mode is ENABLED. This bot will only receive commands and replies.\n' +
        '    Fix: @BotFather → /setprivacy → Disable, then REMOVE and RE-ADD the bot\n' +
        '    to the group. Promoting it to admin also grants full message access.',
    );
  }
  console.log(
    `lang=${config.defaultLang} timezone=${config.timezone} db=${config.dbPath}`,
  );

  await bot.start({
    allowed_updates: [...ALLOWED_UPDATES],
    onStart: () => console.log('polling for updates'),
  });
}

function shutdown(signal: string): void {
  console.log(`\n${signal} received, stopping`);
  void bot.stop().finally(() => {
    closeDb();
    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
