import type { Bot, Context } from 'grammy';
import { isChatAllowed } from '../config.js';
import { setMemberStatus, upsertUser } from '../db/queries.js';

/**
 * `chat_member` is the authoritative source for who is in the chat. It only
 * arrives if the bot is an administrator AND 'chat_member' is listed in
 * allowed_updates — it is excluded by default. See index.ts.
 */
export function registerMemberHandlers(bot: Bot<Context>): void {
  bot.on('chat_member', async (ctx, next) => {
    try {
      const update = ctx.chatMember;
      if (isChatAllowed(update.chat.id)) {
        const member = update.new_chat_member;
        upsertUser(member.user, update.date);
        if (!member.user.is_bot) {
          setMemberStatus(update.chat.id, member.user.id, member.status, update.date);
        }
      }
    } catch (err) {
      console.error('failed to record membership change:', err);
    }
    await next();
  });

  // The bot's own status changing — useful for knowing when tracking began.
  bot.on('my_chat_member', async (ctx, next) => {
    const update = ctx.myChatMember;
    console.log(
      `[my_chat_member] chat ${update.chat.id} (${update.chat.title ?? update.chat.type}): ` +
        `${update.old_chat_member.status} -> ${update.new_chat_member.status}`,
    );
    await next();
  });
}
