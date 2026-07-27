import type { Bot, Context } from 'grammy';
import type { Message } from 'grammy/types';
import { isChatAllowed } from '../config.js';
import { inferMember, insertMessage, markEdited, setMemberStatus, upsertUser } from '../db/queries.js';

/** Service events arrive as `message` updates but are not user activity. */
const SERVICE_FIELDS = [
  'new_chat_members',
  'left_chat_member',
  'new_chat_title',
  'new_chat_photo',
  'delete_chat_photo',
  'group_chat_created',
  'supergroup_chat_created',
  'channel_chat_created',
  'message_auto_delete_timer_changed',
  'migrate_to_chat_id',
  'migrate_from_chat_id',
  'pinned_message',
  'successful_payment',
  'refunded_payment',
  'users_shared',
  'chat_shared',
  'write_access_allowed',
  'proximity_alert_triggered',
  'boost_added',
  'chat_background_set',
  'forum_topic_created',
  'forum_topic_edited',
  'forum_topic_closed',
  'forum_topic_reopened',
  'general_forum_topic_hidden',
  'general_forum_topic_unhidden',
  'giveaway_created',
  'giveaway_completed',
  'video_chat_scheduled',
  'video_chat_started',
  'video_chat_ended',
  'video_chat_participants_invited',
  'web_app_data',
] as const;

function isServiceMessage(msg: Message): boolean {
  return SERVICE_FIELDS.some((field) => field in msg && msg[field] !== undefined);
}

function classify(msg: Message): string {
  if (msg.text) {
    const entity = msg.entities?.[0];
    if (entity?.type === 'bot_command' && entity.offset === 0) return 'command';
    return 'text';
  }
  if (msg.photo) return 'photo';
  if (msg.animation) return 'animation'; // must precede document/video
  if (msg.sticker) return 'sticker';
  if (msg.video_note) return 'video_note';
  if (msg.video) return 'video';
  if (msg.voice) return 'voice';
  if (msg.audio) return 'audio';
  if (msg.document) return 'document';
  if (msg.poll) return 'poll';
  if (msg.dice) return 'dice';
  if (msg.contact) return 'contact';
  if (msg.venue) return 'venue';
  if (msg.location) return 'location';
  if (msg.game) return 'game';
  if (msg.story) return 'story';
  if (msg.paid_media) return 'paid_media';
  return 'other';
}

function record(msg: Message): void {
  const chatId = msg.chat.id;
  if (!isChatAllowed(chatId)) return;
  if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;

  const ts = msg.date;

  // Membership changes ride in on service messages in small groups, where
  // `chat_member` updates may not fire.
  if (msg.new_chat_members) {
    for (const member of msg.new_chat_members) {
      upsertUser(member, ts);
      setMemberStatus(chatId, member.id, 'member', ts);
    }
    return;
  }
  if (msg.left_chat_member) {
    upsertUser(msg.left_chat_member, ts);
    setMemberStatus(chatId, msg.left_chat_member.id, 'left', ts);
    return;
  }
  if (isServiceMessage(msg)) return;

  // Anonymous admins and channel-linked posts have no real author.
  const authorIsChat = msg.sender_chat !== undefined;
  const from = msg.from;

  if (!authorIsChat && from) {
    upsertUser(from, ts);
    if (!from.is_bot) inferMember(chatId, from.id, ts);
  }

  insertMessage({
    chatId,
    msgId: msg.message_id,
    userId: authorIsChat ? null : (from?.id ?? null),
    senderChatId: msg.sender_chat?.id ?? null,
    ts,
    kind: classify(msg),
    charLen: (msg.text ?? msg.caption ?? '').length,
    replyToUserId: msg.reply_to_message?.from?.id ?? null,
    threadId: msg.message_thread_id ?? null,
    isForward: msg.forward_origin !== undefined,
  });
}

export function registerMessageHandlers(bot: Bot<Context>): void {
  // Runs before the command handlers and passes control on via next().
  bot.on('message', async (ctx, next) => {
    try {
      record(ctx.message);
    } catch (err) {
      console.error('failed to record message:', err);
    }
    await next();
  });

  bot.on('edited_message', async (ctx, next) => {
    try {
      const msg = ctx.editedMessage;
      if (isChatAllowed(msg.chat.id)) {
        markEdited(msg.chat.id, msg.message_id, msg.edit_date ?? msg.date);
      }
    } catch (err) {
      console.error('failed to record edit:', err);
    }
    await next();
  });
}
