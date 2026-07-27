import type { Bot, Context } from 'grammy';
import {
  chatTotals,
  dailySeries,
  leaderboard,
  rosterCoverage,
  trackingSince,
} from '../db/queries.js';
import { clip, codeBlock, displayName, padEnd, padStart, sparkline } from '../format.js';
import { humanSince } from '../time.js';
import { parseRange, rangeDays } from './range.js';
import { requireGroup } from './guards.js';

const NAME_WIDTH = 16;

function leaderboardTable(
  rows: Array<{
    user_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    msgs: number;
    active_days: number;
  }>,
  days: number | null,
  limit: number,
): string[] {
  const header = `${padEnd('#', 3)}${padEnd('who', NAME_WIDTH)}${padStart('msgs', 6)}${padStart(
    days ? '/day' : 'days',
    7,
  )}`;
  const lines = [header, '─'.repeat(header.length)];

  rows.slice(0, limit).forEach((row, i) => {
    const perDay = days ? (row.msgs / days).toFixed(1) : String(row.active_days);
    lines.push(
      padEnd(`${i + 1}`, 3) +
        padEnd(clip(displayName(row), NAME_WIDTH - 1), NAME_WIDTH) +
        padStart(String(row.msgs), 6) +
        padStart(perDay, 7),
    );
  });
  return lines;
}

export function registerStatsCommands(bot: Bot<Context>): void {
  bot.command('stats', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const range = parseRange(ctx.match);
    const totals = chatTotals(chatId, range.sinceDay);

    if (totals.msgs === 0) {
      await ctx.reply(
        `No messages recorded for ${range.label}. ` +
          `I have been watching since ${humanSince(trackingSince(chatId))}.`,
      );
      return;
    }

    const rows = leaderboard(chatId, range.sinceDay);
    const days = rangeDays(range, 21);
    const series = dailySeries(chatId, days, null);
    const avgLen = totals.chars ? Math.round(totals.chars / totals.msgs) : 0;
    const roster = rosterCoverage(chatId);

    const body = [
      `📊 <b>Group activity — ${range.label}</b>`,
      '',
      `<b>${totals.msgs}</b> messages from <b>${totals.posters}</b> people` +
        `${avgLen ? ` · avg ${avgLen} chars` : ''}`,
      `Daily (last ${series.length}d): <code>${sparkline(series)}</code>`,
      '',
      codeBlock(leaderboardTable(rows, range.days, 10)),
    ];

    if (rows.length > 10) body.push(`<i>…and ${rows.length - 10} more — /top ${ctx.match || 'week'}</i>`);
    body.push(
      '',
      `<i>Tracking ${roster.tracked} members (${roster.confirmed} confirmed) ` +
        `since ${humanSince(trackingSince(chatId))}.</i>`,
    );

    await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('top', async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const range = parseRange(ctx.match);
    const rows = leaderboard(chatId, range.sinceDay);

    if (rows.length === 0) {
      await ctx.reply(`Nobody posted in ${range.label}.`);
      return;
    }

    await ctx.reply(
      [
        `🏆 <b>Most active — ${range.label}</b>`,
        '',
        codeBlock(leaderboardTable(rows, range.days, 25)),
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });
}
