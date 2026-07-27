import type { Bot, Context } from 'grammy';
import type { ReactionType } from 'grammy/types';
import { isChatAllowed } from '../config.js';
import { replaceReactions, upsertUser } from '../db/queries.js';

function toKey(reaction: ReactionType): string {
  return reaction.type === 'emoji'
    ? reaction.emoji
    : reaction.type === 'custom_emoji'
      ? `custom:${reaction.custom_emoji_id}`
      : reaction.type;
}

/**
 * Reactions are the signal that separates a lurker from a genuinely absent
 * member: someone with zero messages but plenty of reactions is still reading.
 * Requires bot admin + 'message_reaction' in allowed_updates.
 */
export function registerReactionHandlers(bot: Bot<Context>): void {
  bot.on('message_reaction', async (ctx, next) => {
    try {
      const update = ctx.messageReaction;
      const user = update.user;
      // Anonymous reactions arrive without a user; nothing to attribute.
      if (user && isChatAllowed(update.chat.id) && !user.is_bot) {
        upsertUser(user, update.date);
        replaceReactions(
          update.chat.id,
          update.message_id,
          user.id,
          update.new_reaction.map(toKey),
          update.date,
        );
      }
    } catch (err) {
      console.error('failed to record reaction:', err);
    }
    await next();
  });
}
