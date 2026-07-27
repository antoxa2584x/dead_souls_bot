import type { Bot, Context } from 'grammy';
import { config } from '../config.js';
import { forgetUser, rosterCoverage, trackingSince } from '../db/queries.js';
import { humanSince } from '../time.js';
import { LOCALES, dictFor, isSupportedLang, t } from '../i18n/index.js';
import { chatLang, updateLang } from '../settings.js';
import { requireGroup } from './guards.js';

export function registerMiscCommands(bot: Bot<Context>): void {
  bot.command(['help', 'start'], async (ctx) => {
    await ctx.reply(t(ctx.chat.id).misc.help, { parse_mode: 'HTML' });
  });

  bot.command('status', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const roster = rosterCoverage(chatId);

    let total: number | string = '?';
    try {
      total = await ctx.api.getChatMemberCount(chatId);
    } catch {
      /* ignore — display a placeholder instead */
    }

    const me = await ctx.api.getMe();

    await ctx.reply(
      [
        d.misc.statusChatId(chatId),
        d.misc.statusSince(humanSince(trackingSince(chatId), d.ago)),
        d.misc.statusMembers(roster.tracked, roster.confirmed, total),
        d.misc.statusTimezone(config.timezone),
        d.misc.statusLang(d.name),
        me.can_read_all_group_messages ? d.misc.statusPrivacyOff : d.misc.statusPrivacyOn,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  // Text shortcut for the language setting; /settings has the full menu.
  bot.command('lang', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const arg = ctx.match.trim().toLowerCase();

    if (!arg) {
      await ctx.reply(d.misc.langUsage(dictFor(chatLang(chatId)).name), { parse_mode: 'HTML' });
      return;
    }
    if (!isSupportedLang(arg)) {
      await ctx.reply(d.misc.langUnknown(arg), { parse_mode: 'HTML' });
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;
    if (!config.adminUserIds.includes(userId)) {
      const member = await ctx.api.getChatMember(chatId, userId).catch(() => null);
      const admin = member?.status === 'creator' || member?.status === 'administrator';
      if (!admin) {
        await ctx.reply(d.misc.langDenied);
        return;
      }
    }

    updateLang(chatId, arg);
    await ctx.reply(t(chatId).misc.langChanged(LOCALES[arg]!.name), { parse_mode: 'HTML' });
  });

  bot.command('forget', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const requester = ctx.from?.id;
    if (!requester) return;

    const replied = ctx.message?.reply_to_message?.from;
    const targetId = replied?.id ?? requester;

    // You may always erase yourself; erasing someone else needs an admin.
    if (targetId !== requester && !config.adminUserIds.includes(requester)) {
      await ctx.reply(d.misc.forgetDenied);
      return;
    }

    forgetUser(chatId, targetId);
    await ctx.reply(
      targetId === requester ? d.misc.forgetSelf : d.misc.forgetOther(targetId),
    );
  });
}
