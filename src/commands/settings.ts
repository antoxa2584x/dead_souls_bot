import { InlineKeyboard, type Bot, type Context } from 'grammy';
import { config } from '../config.js';
import { LOCALES, dictFor, t, type Dict } from '../i18n/index.js';
import {
  chatAnnounceAch,
  chatDeadAfterDays,
  chatLang,
  updateAnnounceAch,
  updateDeadAfterDays,
  updateLang,
} from '../settings.js';
import { requireGroup } from './guards.js';

const DAY_CHOICES = [7, 14, 30, 60, 90] as const;

/**
 * Buttons are visible to everyone in the group, so every callback re-checks
 * permission rather than trusting that only an admin could have opened the menu.
 */
async function isAdmin(ctx: Context, chatId: number, userId: number): Promise<boolean> {
  if (config.adminUserIds.includes(userId)) return true;
  try {
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.status === 'creator' || member.status === 'administrator';
  } catch {
    return false;
  }
}

function rootMenu(chatId: number, d: Dict): { text: string; keyboard: InlineKeyboard } {
  const lang = dictFor(chatLang(chatId));
  const days = chatDeadAfterDays(chatId);

  return {
    text: `${d.settings.title}\n\n<i>${d.settings.subtitle}</i>`,
    keyboard: new InlineKeyboard()
      .text(d.settings.langButton(lang.name), 'cfg:lang')
      .row()
      .text(d.settings.daysButton(days), 'cfg:days')
      .row()
      .text(d.settings.achButton(chatAnnounceAch(chatId)), 'cfg:toggleach')
      .row()
      .text(d.settings.close, 'cfg:close'),
  };
}

function langMenu(chatId: number, d: Dict): { text: string; keyboard: InlineKeyboard } {
  const current = chatLang(chatId);
  const keyboard = new InlineKeyboard();

  for (const [code, locale] of Object.entries(LOCALES)) {
    const mark = code === current ? d.settings.current : '';
    keyboard.text(`${mark}${locale.name}`, `cfg:setlang:${code}`).row();
  }
  keyboard.text(d.settings.back, 'cfg:root');

  return { text: d.settings.langTitle, keyboard };
}

function daysMenu(chatId: number, d: Dict): { text: string; keyboard: InlineKeyboard } {
  const current = chatDeadAfterDays(chatId);
  const keyboard = new InlineKeyboard();

  DAY_CHOICES.forEach((n, i) => {
    const mark = n === current ? d.settings.current : '';
    keyboard.text(`${mark}${d.settings.daysOption(n)}`, `cfg:setdays:${n}`);
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row().text(d.settings.back, 'cfg:root');

  return {
    text: `${d.settings.daysTitle}\n\n<i>${d.settings.daysHint}</i>`,
    keyboard,
  };
}

export function registerSettingsCommand(bot: Bot<Context>): void {
  bot.command(['settings', 'admin'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const userId = ctx.from?.id;
    if (!userId || !(await isAdmin(ctx, chatId, userId))) {
      await ctx.reply(d.settings.denied);
      return;
    }

    const { text, keyboard } = rootMenu(chatId, d);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  bot.callbackQuery(/^cfg:/, async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from.id;
    if (chatId === undefined) return;

    let d = t(chatId);

    if (!(await isAdmin(ctx, chatId, userId))) {
      await ctx.answerCallbackQuery({ text: d.settings.denied, show_alert: true });
      return;
    }

    const parts = ctx.callbackQuery.data.split(':');
    const action = parts[1];
    const value = parts[2];
    let toast: string | undefined;

    if (action === 'close') {
      await ctx.editMessageText(d.settings.closed, { parse_mode: 'HTML' });
      await ctx.answerCallbackQuery();
      return;
    }

    if (action === 'setlang' && value && value in LOCALES) {
      updateLang(chatId, value);
      d = t(chatId); // the menu below must render in the newly chosen language
      toast = d.settings.saved;
    } else if (action === 'toggleach') {
      updateAnnounceAch(chatId, !chatAnnounceAch(chatId));
      toast = d.settings.saved;
    } else if (action === 'setdays' && value) {
      const n = Number(value);
      if (Number.isInteger(n) && n > 0) {
        updateDeadAfterDays(chatId, n);
        toast = d.settings.saved;
      }
    }

    // Sub-menus stay open after a change so several tweaks can be made in a row.
    const view =
      action === 'lang' || action === 'setlang'
        ? langMenu(chatId, d)
        : action === 'days' || action === 'setdays'
          ? daysMenu(chatId, d)
          : rootMenu(chatId, d);

    try {
      await ctx.editMessageText(view.text, {
        parse_mode: 'HTML',
        reply_markup: view.keyboard,
      });
    } catch {
      // Telegram rejects an edit that would not change anything; harmless.
    }
    await ctx.answerCallbackQuery(toast ? { text: toast } : undefined);
  });
}
