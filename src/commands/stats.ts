import type { Bot, Context } from 'grammy';
import {
  chatTotals,
  dailySeries,
  leaderboard,
  rosterCoverage,
  trackingSince,
  type LeaderRow,
} from '../db/queries.js';
import { clip, codeBlock, displayName, padEnd, padStart, sparkline } from '../format.js';
import { humanSince } from '../time.js';
import { t, type Dict } from '../i18n/index.js';
import { parseRange, rangeDays } from './range.js';
import { requireGroup } from './guards.js';

const NAME_WIDTH = 16;

function leaderboardTable(rows: LeaderRow[], days: number | null, limit: number, d: Dict): string[] {
  const lastCol = days ? d.table.perDay : d.table.days;
  const numW = 3;
  const msgW = Math.max(6, d.table.msgs.length + 1);
  const lastW = Math.max(7, lastCol.length + 1);

  const header =
    padEnd(d.table.num, numW) +
    padEnd(d.table.who, NAME_WIDTH) +
    padStart(d.table.msgs, msgW) +
    padStart(lastCol, lastW);
  const lines = [header, '─'.repeat(header.length)];

  rows.slice(0, limit).forEach((row, i) => {
    const perDay = days ? (row.msgs / days).toFixed(1) : String(row.active_days);
    lines.push(
      padEnd(`${i + 1}`, numW) +
        padEnd(clip(displayName(row), NAME_WIDTH - 1), NAME_WIDTH) +
        padStart(String(row.msgs), msgW) +
        padStart(perDay, lastW),
    );
  });
  return lines;
}

export function registerStatsCommands(bot: Bot<Context>): void {
  bot.command('stats', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const range = parseRange(ctx.match, d);
    const totals = chatTotals(chatId, range.sinceDay);

    if (totals.msgs === 0) {
      await ctx.reply(d.stats.empty(range.label, humanSince(trackingSince(chatId), d.ago)));
      return;
    }

    const rows = leaderboard(chatId, range.sinceDay);
    const series = dailySeries(chatId, rangeDays(range, 21), null);
    const avgLen = totals.chars ? Math.round(totals.chars / totals.msgs) : 0;
    const roster = rosterCoverage(chatId);

    const body = [
      d.stats.title(range.label),
      '',
      d.stats.summary(totals.msgs, totals.posters) + (avgLen ? d.stats.avgChars(avgLen) : ''),
      `${d.stats.daily(series.length)}: <code>${sparkline(series)}</code>`,
      '',
      codeBlock(leaderboardTable(rows, range.days, 10, d)),
    ];

    if (rows.length > 10) body.push(d.stats.andMore(rows.length - 10, ctx.match || 'week'));
    body.push(
      '',
      d.stats.tracking(
        roster.tracked,
        roster.confirmed,
        humanSince(trackingSince(chatId), d.ago),
      ),
    );

    await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('top', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const range = parseRange(ctx.match, d);
    const rows = leaderboard(chatId, range.sinceDay);

    if (rows.length === 0) {
      await ctx.reply(d.stats.topEmpty(range.label));
      return;
    }

    await ctx.reply(
      [d.stats.topTitle(range.label), '', codeBlock(leaderboardTable(rows, range.days, 25, d))].join(
        '\n',
      ),
      { parse_mode: 'HTML' },
    );
  });
}
