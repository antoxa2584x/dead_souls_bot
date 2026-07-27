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
import { t, type Dict } from '../i18n/index.js';
import { mentionArg, parseRange, periodArg, rangeDays, resolveTarget } from './range.js';
import { requireGroup } from './guards.js';

function kindLabel(kind: string, d: Dict): string {
  return d.kinds[kind] ?? kind;
}

/** Align the fact table to its longest label, which differs per language. */
function factTable(rows: Array<[string, string]>): string[] {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, value]) => padEnd(label, width) + value);
}

export function registerProfileCommands(bot: Bot<Context>): void {
  bot.command(['me', 'user'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const target = resolveTarget(ctx);
    if ('error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const { person, self } = target;
    const range = parseRange(periodArg(ctx.match), d);
    const totals = userTotals(chatId, person.user_id, range.sinceDay);
    const name = escapeHtml(displayName(person));

    if (totals.msgs === 0) {
      const ever = lastMessage(chatId, person.user_id);
      await ctx.reply(
        ever
          ? d.profile.nothingInRange(name, range.label, humanSince(ever.ts, d.ago))
          : d.profile.neverPosted(name),
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

    const facts = factTable([
      [
        d.profile.labels.messages,
        `${totals.msgs}${rank ? d.profile.rank(rank, board.length) : ''}`,
      ],
      [d.profile.labels.perWeek, perWeek],
      [
        d.profile.labels.activeDays,
        `${totals.active_days}${range.days ? d.profile.activeDaysOf(range.days) : ''}`,
      ],
      [d.profile.labels.streak, d.profile.streakValue(streak)],
      [d.profile.labels.avgLength, d.profile.avgLengthValue(avgLen)],
      [d.profile.labels.peakHour, `${String(peakHour).padStart(2, '0')}:00`],
      [d.profile.labels.reactions, d.profile.reactionsValue(given, received)],
    ]);

    const kindLine = kinds
      .slice(0, 5)
      .map((k) => `${kindLabel(k.kind, d)} ${k.n}`)
      .join(' · ');

    await ctx.reply(
      [
        d.profile.title(name, range.label),
        '',
        codeBlock(facts),
        `${d.profile.daily}: <code>${sparkline(series)}</code>`,
        `${d.profile.types}: ${escapeHtml(kindLine)}`,
        '',
        d.profile.lastMessage(humanSince(last.ts, d.ago), kindLabel(last.kind, d)),
        self ? '' : d.profile.tip,
      ]
        .filter(Boolean)
        .join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('last', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const target = resolveTarget(ctx);
    if ('error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const last = lastMessage(chatId, target.person.user_id);
    const name = escapeHtml(displayName(target.person));

    await ctx.reply(
      last
        ? d.profile.lastPosted(name, humanSince(last.ts, d.ago), kindLabel(last.kind, d))
        : d.profile.notPosted(name),
      { parse_mode: 'HTML' },
    );
  });

  bot.command('when', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const wantsUser = Boolean(mentionArg(ctx.match) || ctx.message?.reply_to_message);
    const target = wantsUser ? resolveTarget(ctx) : null;
    if (target && 'error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const range = parseRange(periodArg(ctx.match), d);
    const userId = target ? target.person.user_id : null;
    const hours = hourHistogram(chatId, range.sinceDay, userId);
    const max = Math.max(...hours);

    if (max === 0) {
      await ctx.reply(d.profile.whenEmpty(range.label));
      return;
    }

    const lines: string[] = [];
    for (let h = 0; h < 24; h++) {
      const count = hours[h] ?? 0;
      const width = Math.round((count / max) * 24);
      lines.push(
        `${String(h).padStart(2, '0')} ${padEnd('█'.repeat(width), 24)} ${padStart(String(count), 5)}`,
      );
    }

    const who = target ? escapeHtml(displayName(target.person)) : d.common.theGroup;
    await ctx.reply([d.profile.whenTitle(who, range.label), '', codeBlock(lines)].join('\n'), {
      parse_mode: 'HTML',
    });
  });
}
