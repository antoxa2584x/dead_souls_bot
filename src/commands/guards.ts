import type { CommandContext, Context } from 'grammy';
import { isChatAllowed } from '../config.js';
import { t } from '../i18n/index.js';

/**
 * Every statistic is per-group. In a DM there is nothing to report, so tell
 * the user rather than silently doing nothing.
 */
export async function requireGroup(ctx: CommandContext<Context>): Promise<number | null> {
  const chat = ctx.chat;
  const d = t(chat.type === 'group' || chat.type === 'supergroup' ? chat.id : undefined);

  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    await ctx.reply(d.guard.groupOnly);
    return null;
  }
  if (!isChatAllowed(chat.id)) {
    await ctx.reply(d.guard.notTracked);
    return null;
  }
  return chat.id;
}
