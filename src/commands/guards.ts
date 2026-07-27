import type { CommandContext, Context } from 'grammy';
import { isChatAllowed } from '../config.js';

/**
 * Every statistic is per-group. In a DM there is nothing to report, so tell
 * the user rather than silently doing nothing.
 */
export async function requireGroup(ctx: CommandContext<Context>): Promise<number | null> {
  const chat = ctx.chat;
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    await ctx.reply('Add me to your group and run this there — I only track group activity.');
    return null;
  }
  if (!isChatAllowed(chat.id)) {
    await ctx.reply('I am not configured to track this chat.');
    return null;
  }
  return chat.id;
}
