import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { registerMessageHandlers } from './handlers/messages.js';
import { registerMemberHandlers } from './handlers/members.js';
import { registerReactionHandlers } from './handlers/reactions.js';
import { registerStatsCommands } from './commands/stats.js';
import { registerProfileCommands } from './commands/profile.js';
import { registerDeadCommand } from './commands/dead.js';
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
] as const;

const bot = new Bot(config.botToken);

// Recording runs first and calls next(), so commands still reach their handlers.
registerMessageHandlers(bot);
registerMemberHandlers(bot);
registerReactionHandlers(bot);

registerStatsCommands(bot);
registerProfileCommands(bot);
registerDeadCommand(bot);
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

async function main(): Promise<void> {
  const me = await bot.api.getMe();

  await bot.api.setMyCommands([
    { command: 'stats', description: 'Group activity overview' },
    { command: 'top', description: 'Leaderboard of most active members' },
    { command: 'me', description: 'Your stats (or reply to someone for theirs)' },
    { command: 'last', description: 'When someone last posted' },
    { command: 'when', description: 'Hour-of-day activity chart' },
    { command: 'dead', description: 'Members who have gone quiet' },
    { command: 'status', description: 'What the bot can currently see' },
    { command: 'help', description: 'Show all commands' },
  ]);

  console.log(`starting as @${me.username} (id ${me.id})`);
  if (!me.can_read_all_group_messages) {
    console.warn(
      '⚠️  Privacy mode is ENABLED. This bot will only receive commands and replies.\n' +
        '    Fix: @BotFather → /setprivacy → Disable, then REMOVE and RE-ADD the bot\n' +
        '    to the group. Promoting it to admin also grants full message access.',
    );
  }
  console.log(`timezone=${config.timezone} db=${config.dbPath}`);

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
