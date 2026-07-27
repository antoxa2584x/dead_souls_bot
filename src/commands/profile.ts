import type { Bot, Context } from 'grammy';
import {
  currentStreak,
  dailySeries,
  hourHistogram,
  kindBreakdown,
  lastMessage,
  leaderboard,
  reactionsGiven,
  reactionsReceived,
  userTotals,
  weeklyCounts,
} from '../db/queries.js';
import { codeBlock, displayName, escapeHtml, padEnd, padStart, sparkline } from '../format.js';
import { dayKey, humanSince, nowSeconds } from '../time.js';
import { parseRange, rangeDays, resolveTarget } from './range.js';
import { requireGroup } from './guards.js';

export function registerProfileCommands(bot: Bot<Context>): void {
  bot.command(['me', 'user'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const target = resolveTarget(ctx);
    if ('error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const { person, self } = target;
    // Strip any @mention so "/me @bob month" still parses the period.
    const periodArg = ctx.match
      .trim()
      .split(/\s+/)
      .find((t) => t && !t.startsWith('@'));
    const range = parseRange(periodArg);

    const totals = userTotals(chatId, person.user_id, range.sinceDay);
    const name = escapeHtml(displayName(person));

    if (totals.msgs === 0) {
      const ever = lastMessage(chatId, person.user_id);
      await ctx.reply(
        ever
          ? `<b>${name}</b> posted nothing in ${range.label}. ` +
              `Last message: ${humanSince(ever.ts)}.`
          : `<b>${name}</b> has never posted while I have been watching.`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const last = lastMessage(chatId, person.user_id)!;
    const streak = currentStreak(chatId, person.user_id, dayKey(nowSeconds()));
    const weeks = weeklyCounts(chatId, range.sinceDay, person.user_id, 6);
    const perWeek = range.days
      ? (totals.msgs / (range.days / 7)).toFixed(1)
      : (totals.msgs / Math.max(1, weeks.length)).toFixed(1);

    const hours = hourHistogram(chatId, range.sinceDay, person.user_id);
    const peakHour = hours.indexOf(Math.max(...hours));
    const kinds = kindBreakdown(chatId, person.user_id, range.sinceDay);
    const given = reactionsGiven(chatId, person.user_id, range.sinceDay);
    const received = reactionsReceived(chatId, person.user_id, range.sinceDay);

    const board = leaderboard(chatId, range.sinceDay);
    const rank = board.findIndex((r) => r.user_id === person.user_id) + 1;

    const avgLen = totals.chars ? Math.round(totals.chars / totals.msgs) : 0;
    const series = dailySeries(chatId, rangeDays(range, 21), person.user_id);

    const facts = [
      `${padEnd('Messages', 14)}${totals.msgs}${rank ? `  (#${rank} of ${board.length})` : ''}`,
      `${padEnd('Per week', 14)}${perWeek}`,
      `${padEnd('Active days', 14)}${totals.active_days}${range.days ? ` of ${range.days}` : ''}`,
      `${padEnd('Current streak', 14)}${streak} day${streak === 1 ? '' : 's'}`,
      `${padEnd('Avg length', 14)}${avgLen} chars`,
      `${padEnd('Busiest hour', 14)}${String(peakHour).padStart(2, '0')}:00`,
      `${padEnd('Reactions', 14)}${given} given · ${received} received`,
    ];

    const kindLine = kinds
      .slice(0, 5)
      .map((k) => `${k.kind} ${k.n}`)
      .join(' · ');

    await ctx.reply(
      [
        `👤 <b>${name}</b> — ${range.label}`,
        '',
        codeBlock(facts),
        `Daily: <code>${sparkline(series)}</code>`,
        `Types: ${escapeHtml(kindLine)}`,
        '',
        `Last message ${humanSince(last.ts)} (${last.kind}).`,
        self ? '' : '<i>Tip: reply to someone and run /me to see their stats.</i>',
      ]
        .filter(Boolean)
        .join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('last', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const target = resolveTarget(ctx);
    if ('error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const last = lastMessage(chatId, target.person.user_id);
    const name = escapeHtml(displayName(target.person));

    await ctx.reply(
      last
        ? `<b>${name}</b> last posted <b>${humanSince(last.ts)}</b> — a ${last.kind}.`
        : `<b>${name}</b> has not posted since I started watching.`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('when', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const mention = ctx.match.trim().split(/\s+/).find((t) => t.startsWith('@'));
    const target = mention || ctx.message?.reply_to_message ? resolveTarget(ctx) : null;
    if (target && 'error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const periodArg = ctx.match
      .trim()
      .split(/\s+/)
      .find((t) => t && !t.startsWith('@'));
    const range = parseRange(periodArg);
    const userId = target ? target.person.user_id : null;

    const hours = hourHistogram(chatId, range.sinceDay, userId);
    const max = Math.max(...hours);
    if (max === 0) {
      await ctx.reply(`No messages in ${range.label}.`);
      return;
    }

    const lines: string[] = [];
    for (let h = 0; h < 24; h++) {
      const count = hours[h] ?? 0;
      const width = Math.round((count / max) * 24);
      lines.push(
        `${String(h).padStart(2, '0')} ${padEnd('█'.repeat(width), 24)} ${padStart(
          String(count),
          5,
        )}`,
      );
    }

    const who = target ? escapeHtml(displayName(target.person)) : 'the group';
    await ctx.reply(
      [`🕒 <b>When ${who} posts — ${range.label}</b>`, '', codeBlock(lines)].join('\n'),
      { parse_mode: 'HTML' },
    );
  });
}
