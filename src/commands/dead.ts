import type { Bot, Context } from 'grammy';
import { deadSouls, rosterCoverage, trackingSince, type DeadRow } from '../db/queries.js';
import { clip, codeBlock, displayName, padEnd, padStart } from '../format.js';
import { dayKeyDaysAgo, humanSince, nowSeconds } from '../time.js';
import { t, type Dict } from '../i18n/index.js';
import { chatDeadAfterDays } from '../settings.js';
import { requireGroup } from './guards.js';

const NAME_WIDTH = 18;

function section(title: string, rows: DeadRow[], d: Dict): string[] {
  if (rows.length === 0) return [];
  const lines = [`${title} (${rows.length})`];
  for (const row of rows) {
    const when = row.last_msg_ts ? humanSince(row.last_msg_ts, d.ago) : d.common.never;
    lines.push(
      `  ${padEnd(clip(displayName(row), NAME_WIDTH - 1), NAME_WIDTH)}${padStart(when, 14)}`,
    );
  }
  return lines;
}

export function registerDeadCommand(bot: Bot<Context>): void {
  bot.command(['dead', 'deadsouls'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const arg = Number(ctx.match.trim());
    const days = Number.isInteger(arg) && arg > 0 ? arg : chatDeadAfterDays(chatId);
    const cutoffTs = nowSeconds() - days * 86400;

    const rows = deadSouls(chatId, cutoffTs, dayKeyDaysAgo(days - 1));
    const roster = rosterCoverage(chatId);

    let actualMembers: number | null = null;
    try {
      actualMembers = await ctx.api.getChatMemberCount(chatId);
    } catch {
      // Not fatal — the count is only used for the coverage caveat.
    }

    if (rows.length === 0) {
      await ctx.reply(d.dead.none(days));
      return;
    }

    // Someone who reacts but never types is reading; that is a different kind
    // of quiet from someone who has vanished entirely.
    const lurkers = rows.filter((r) => r.recent_reactions > 0);
    const silent = rows.filter((r) => r.recent_reactions === 0 && r.total_msgs > 0);
    const never = rows.filter((r) => r.recent_reactions === 0 && r.total_msgs === 0);

    const body = [
      d.dead.title(days),
      '',
      codeBlock([
        ...section(d.dead.neverPosted, never, d),
        ...(never.length ? [''] : []),
        ...section(d.dead.silent, silent, d),
        ...(silent.length ? [''] : []),
        ...section(d.dead.lurking, lurkers, d),
      ]),
    ];

    const caveats: string[] = [];
    if (actualMembers !== null && roster.tracked < actualMembers - 1) {
      caveats.push(d.dead.coverage(roster.tracked, actualMembers));
    }
    caveats.push(d.dead.since(humanSince(trackingSince(chatId), d.ago)));
    body.push('', `<i>${caveats.join(' ')}</i>`);

    await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
  });
}
