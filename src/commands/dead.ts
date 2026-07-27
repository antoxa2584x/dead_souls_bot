import type { Bot, Context } from 'grammy';
import { config } from '../config.js';
import { deadSouls, rosterCoverage, trackingSince, type DeadRow } from '../db/queries.js';
import { clip, codeBlock, displayName, padEnd, padStart } from '../format.js';
import { dayKeyDaysAgo, humanSince, nowSeconds } from '../time.js';
import { requireGroup } from './guards.js';

const NAME_WIDTH = 18;

function section(title: string, rows: DeadRow[]): string[] {
  if (rows.length === 0) return [];
  const lines = [`${title} (${rows.length})`];
  for (const row of rows) {
    const when = row.last_msg_ts ? humanSince(row.last_msg_ts) : 'never';
    lines.push(
      `  ${padEnd(clip(displayName(row), NAME_WIDTH - 1), NAME_WIDTH)}${padStart(when, 12)}`,
    );
  }
  return lines;
}

export function registerDeadCommand(bot: Bot<Context>): void {
  bot.command(['dead', 'deadsouls'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const arg = Number(ctx.match.trim());
    const days = Number.isInteger(arg) && arg > 0 ? arg : config.deadAfterDays;
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
      await ctx.reply(
        `👻 Nobody has been quiet for ${days}+ days. Everyone I track has posted recently.`,
      );
      return;
    }

    // Someone who reacts but never types is reading; that is a different kind
    // of quiet from someone who has vanished entirely.
    const lurkers = rows.filter((r) => r.recent_reactions > 0);
    const silent = rows.filter((r) => r.recent_reactions === 0 && r.total_msgs > 0);
    const never = rows.filter((r) => r.recent_reactions === 0 && r.total_msgs === 0);

    const body = [
      `👻 <b>Quiet for ${days}+ days</b>`,
      '',
      codeBlock([
        ...section('Never posted', never),
        ...(never.length ? [''] : []),
        ...section('Silent', silent),
        ...(silent.length ? [''] : []),
        ...section('Lurking (reacts, does not post)', lurkers),
      ]),
    ];

    const caveats: string[] = [];
    if (actualMembers !== null && roster.tracked < actualMembers - 1) {
      caveats.push(
        `I know ${roster.tracked} of ${actualMembers} members. ` +
          `Members who joined before me and have never posted or reacted are invisible ` +
          `to the Bot API, so this list is a lower bound.`,
      );
    }
    caveats.push(`Watching since ${humanSince(trackingSince(chatId))}.`);
    body.push('', `<i>${caveats.join(' ')}</i>`);

    await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
  });
}
