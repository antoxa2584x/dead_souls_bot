import type { Bot, Context } from 'grammy';
import { config } from '../config.js';
import { forgetUser, rosterCoverage, trackingSince } from '../db/queries.js';
import { humanSince } from '../time.js';
import { requireGroup } from './guards.js';

const HELP = `<b>Dead Souls</b> — activity statistics for this group.

<b>/stats</b> [period] — group overview and top posters
<b>/top</b> [period] — full leaderboard
<b>/me</b> [@user] [period] — detailed profile (reply to someone to target them)
<b>/last</b> [@user] — when someone last posted
<b>/when</b> [@user] [period] — hour-of-day activity
<b>/dead</b> [days] — members who have gone quiet

<i>period</i> = <code>week</code> (default), <code>month</code>, <code>year</code>, <code>all</code>, or a number of days.

I record message metadata only — never message text.`;

export function registerMiscCommands(bot: Bot<Context>): void {
  bot.command(['help', 'start'], async (ctx) => {
    await ctx.reply(HELP, { parse_mode: 'HTML' });
  });

  bot.command('status', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const roster = rosterCoverage(chatId);
    let total: number | string = '?';
    try {
      total = await ctx.api.getChatMemberCount(chatId);
    } catch {
      /* ignore */
    }

    const me = await ctx.api.getMe();
    const privacyOff = me.can_read_all_group_messages === true;

    await ctx.reply(
      [
        `Chat id: <code>${chatId}</code>`,
        `Watching since: ${humanSince(trackingSince(chatId))}`,
        `Members known: ${roster.tracked} (${roster.confirmed} confirmed) of ${total}`,
        `Timezone: <code>${config.timezone}</code>`,
        `Privacy mode: ${privacyOff ? '✅ disabled (sees all messages)' : '⚠️ ENABLED — I only see commands. Disable it in @BotFather, then remove and re-add me.'}`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('forget', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const requester = ctx.from?.id;
    if (!requester) return;

    const replied = ctx.message?.reply_to_message?.from;
    const targetId = replied?.id ?? requester;

    // You may always erase yourself; erasing someone else needs an admin.
    if (targetId !== requester && !config.adminUserIds.includes(requester)) {
      await ctx.reply('Only a configured admin can erase another member’s data.');
      return;
    }

    forgetUser(chatId, targetId);
    await ctx.reply(
      targetId === requester
        ? 'Erased everything I had recorded about you in this chat.'
        : `Erased everything recorded about user ${targetId} in this chat.`,
    );
  });
}
