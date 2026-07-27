import type { Bot, Context } from 'grammy';
import { activePlayers, getUser } from '../db/queries.js';
import {
  TIER_ICON,
  TIER_SCORE,
  TOTAL_SCORE,
  evaluate,
  syncUnlocks,
  type AchievementProgress,
  type Scorecard,
} from '../achievements/index.js';
import { bar, clip, codeBlock, displayName, escapeHtml, padEnd, padStart } from '../format.js';
import { t, type Dict } from '../i18n/index.js';
import { resolveTarget } from './range.js';
import { requireGroup } from './guards.js';

/** Scoring every member is a handful of queries each, so bound the hall. */
const HALL_SIZE = 15;
const HALL_CANDIDATES = 40;

function label(p: AchievementProgress, d: Dict): { name: string; desc: string } {
  const entry = d.ach.list[p.def.id];
  if (p.def.secret && !p.unlocked) {
    return { name: d.ach.ui.secretName, desc: d.ach.ui.secretDesc };
  }
  return entry ?? { name: p.def.id, desc: '' };
}

function unlockedLine(p: AchievementProgress, d: Dict): string {
  const { name } = label(p, d);
  return `${TIER_ICON[p.def.tier]} <b>${escapeHtml(name)}</b> · ${TIER_SCORE[p.def.tier]}`;
}

function progressLine(p: AchievementProgress, d: Dict): string {
  const { name, desc } = label(p, d);
  const pct = Math.round(p.ratio * 100);
  return (
    `${TIER_ICON[p.def.tier]} <b>${escapeHtml(name)}</b> · ${TIER_SCORE[p.def.tier]}\n` +
    `<i>${escapeHtml(desc)}</i>\n` +
    `<code>${bar(p.value, p.target, 10)}</code> ${p.value}/${p.target} · ${pct}%`
  );
}

function panel(name: string, card: Scorecard, d: Dict): string {
  const total = card.progress.length;
  const pct = Math.round((card.unlocked.length / total) * 100);

  return [
    d.ach.ui.header(name, card.level),
    codeBlock([
      d.ach.ui.gamerscore(card.score, TOTAL_SCORE),
      card.atMaxLevel
        ? d.ach.ui.maxLevel
        : d.ach.ui.levelBar(card.scoreIntoLevel, card.scoreForNextLevel),
      d.ach.ui.completion(card.unlocked.length, total, pct),
    ]),
    d.ach.ui.tally(card.counts.bronze, card.counts.silver, card.counts.gold, card.counts.platinum),
  ].join('\n');
}

export function registerAchievementCommands(bot: Bot<Context>): void {
  bot.command(['achievements', 'ach', 'trophies'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const target = resolveTarget(ctx);
    if ('error' in target) {
      await ctx.reply(target.error);
      return;
    }

    const card = evaluate(chatId, target.person.user_id);
    // Viewing your own card backfills any unlocks earned before announcements
    // were on, so the list never disagrees with what has actually been reached.
    syncUnlocks(chatId, target.person.user_id, card);

    const name = escapeHtml(displayName(target.person));
    const body = [panel(name, card, d)];

    if (card.unlocked.length === 0 && card.score === 0) {
      body.push('', d.ach.ui.nothingYet);
      await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
      return;
    }

    if (card.unlocked.length > 0) {
      const shown = card.unlocked
        .slice()
        .sort((a, b) => TIER_SCORE[b.def.tier] - TIER_SCORE[a.def.tier])
        .slice(0, 12);
      body.push('', d.ach.ui.unlockedSection, ...shown.map((p) => unlockedLine(p, d)));
      if (card.unlocked.length > shown.length) {
        body.push(`<i>${d.ach.ui.andMore(card.unlocked.length - shown.length)}</i>`);
      }
    }

    const next = card.locked
      .filter((p) => p.def.id !== 'completionist')
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3);
    if (next.length > 0) {
      body.push('', d.ach.ui.nextSection, ...next.map((p) => progressLine(p, d)));
    }

    await ctx.reply(body.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command(['hall', 'halloffame'], async (ctx) => {
    const chatId = await requireGroup(ctx);
    if (chatId === null) return;

    const d = t(chatId);
    const players = activePlayers(chatId, HALL_CANDIDATES);
    if (players.length === 0) {
      await ctx.reply(d.ach.ui.hallEmpty);
      return;
    }

    const scored = players
      .map((userId) => {
        const card = evaluate(chatId, userId);
        return { userId, card };
      })
      .filter((row) => row.card.score > 0)
      .sort((a, b) => b.card.score - a.card.score)
      .slice(0, HALL_SIZE);

    if (scored.length === 0) {
      await ctx.reply(d.ach.ui.hallEmpty);
      return;
    }

    const lines = [d.ach.ui.hallRow, '─'.repeat(d.ach.ui.hallRow.length)];
    scored.forEach((row, i) => {
      const person = getUser(row.userId) ?? { user_id: row.userId };
      lines.push(
        padEnd(`${i + 1}`, 3) +
          padEnd(clip(displayName(person), 16), 17) +
          padStart(String(row.card.level), 4) +
          padStart(String(row.card.score), 8),
      );
    });

    await ctx.reply([d.ach.ui.hallTitle, '', codeBlock(lines)].join('\n'), {
      parse_mode: 'HTML',
    });
  });
}
