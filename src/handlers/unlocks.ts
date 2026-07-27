import type { Bot, Context } from 'grammy';
import { isChatAllowed } from '../config.js';
import {
  TIER_ICON,
  TIER_SCORE,
  TOTAL_SCORE,
  evaluate,
  levelForScore,
  syncUnlocks,
  type AchievementProgress,
} from '../achievements/index.js';
import { escapeHtml } from '../format.js';
import { t, type Dict } from '../i18n/index.js';
import { chatAnnounceAch } from '../settings.js';

/**
 * Evaluating the catalogue is ~10 indexed queries, cheap but not free, so a
 * chatty member does not trigger it on every single message.
 */
const CHECK_INTERVAL_MS = 60_000;
const lastChecked = new Map<string, number>();

function throttled(chatId: number, userId: number, now: number): boolean {
  const key = `${chatId}:${userId}`;
  const previous = lastChecked.get(key) ?? 0;
  if (now - previous < CHECK_INTERVAL_MS) return true;
  lastChecked.set(key, now);
  return false;
}

function toast(
  name: string,
  fresh: AchievementProgress[],
  score: number,
  previousLevel: number,
  level: number,
  d: Dict,
): string {
  const platinum = fresh.some((p) => p.def.tier === 'platinum');
  const lines = [platinum ? d.ach.ui.platinumTitle : d.ach.ui.toastTitle, ''];

  for (const p of fresh) {
    const entry = d.ach.list[p.def.id] ?? { name: p.def.id, desc: '' };
    lines.push(
      `${TIER_ICON[p.def.tier]} <b>${escapeHtml(entry.name)}</b> · ${TIER_SCORE[p.def.tier]}`,
      `<i>${escapeHtml(entry.desc)}</i>`,
    );
  }

  lines.push('', `${name} — ${d.ach.ui.toastScore(score, TOTAL_SCORE)}`);
  if (level > previousLevel) lines.push(d.ach.ui.levelUp(level));

  return lines.join('\n');
}

/**
 * Must be registered AFTER the recorder, so the message that triggered the
 * unlock is already in the database when the catalogue is evaluated.
 */
export function registerUnlockAnnouncer(bot: Bot<Context>): void {
  bot.on('message', async (ctx, next) => {
    try {
      const msg = ctx.message;
      const from = msg.from;
      const chatId = msg.chat.id;

      const eligible =
        from !== undefined &&
        !from.is_bot &&
        msg.sender_chat === undefined &&
        (msg.chat.type === 'group' || msg.chat.type === 'supergroup') &&
        isChatAllowed(chatId) &&
        chatAnnounceAch(chatId) &&
        !throttled(chatId, from.id, Date.now());

      if (eligible) {
        const card = evaluate(chatId, from.id);
        const fresh = syncUnlocks(chatId, from.id, card);

        if (fresh.length > 0) {
          const earned = fresh.reduce((sum, p) => sum + TIER_SCORE[p.def.tier], 0);
          const previousLevel = levelForScore(card.score - earned);
          const name = `<b>${escapeHtml(
            from.username ? `@${from.username}` : from.first_name,
          )}</b>`;

          await ctx.reply(
            toast(name, fresh, card.score, previousLevel, card.level, t(chatId)),
            { parse_mode: 'HTML', reply_parameters: { message_id: msg.message_id } },
          );
        }
      }
    } catch (err) {
      // An achievement toast must never break message recording.
      console.error('failed to announce achievements:', err);
    }
    await next();
  });
}
