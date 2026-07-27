import type { Dict } from './uk.js';
import { enPlural } from './plural.js';

const day = (n: number) => enPlural(n, 'day', 'days');
const msg = (n: number) => enPlural(n, 'message', 'messages');
const person = (n: number) => enPlural(n, 'person', 'people');
const member = (n: number) => enPlural(n, 'member', 'members');

/** Typed against the Ukrainian dictionary, so a missing key fails the build. */
export const en: Dict = {
  code: 'en',
  name: 'English',

  range: {
    allTime: 'all time',
    today: 'today',
    lastDays: (n: number) => `last ${n} ${day(n)}`,
  },

  ago: {
    justNow: 'just now',
    minutes: (m: number) => `${m}m ago`,
    hoursMinutes: (h: number, m: number) => `${h}h ${m}m ago`,
    daysHours: (d: number, h: number) => `${d}d ${h}h ago`,
    monthsDays: (mo: number, d: number) => `${mo}mo ${d}d ago`,
  },

  guard: {
    groupOnly: 'Add me to your group and run this there — I only track group activity.',
    notTracked: 'I am not configured to track this chat.',
  },

  common: {
    never: 'never',
    theGroup: 'the group',
    unknownUser: 'unknown',
    messagesCount: (n: number) => `${n} ${msg(n)}`,
    peopleCount: (n: number) => `${n} ${person(n)}`,
  },

  table: {
    num: '#',
    who: 'who',
    msgs: 'msgs',
    perDay: '/day',
    days: 'days',
  },

  stats: {
    title: (range: string) => `📊 <b>Group activity — ${range}</b>`,
    summary: (msgs: number, people: number) =>
      `<b>${msgs}</b> ${msg(msgs)} from <b>${people}</b> ${person(people)}`,
    avgChars: (n: number) => ` · avg ${n} chars`,
    daily: (n: number) => `Daily (last ${n}${day(n) === 'day' ? 'd' : 'd'})`,
    andMore: (n: number, period: string) => `<i>…and ${n} more — /top ${period}</i>`,
    tracking: (tracked: number, confirmed: number, since: string) =>
      `<i>Tracking ${tracked} ${member(tracked)} (${confirmed} confirmed) since ${since}.</i>`,
    empty: (range: string, since: string) =>
      `No messages recorded for ${range}. I have been watching since ${since}.`,
    topTitle: (range: string) => `🏆 <b>Most active — ${range}</b>`,
    topEmpty: (range: string) => `Nobody posted in ${range}.`,
  },

  profile: {
    title: (name: string, range: string) => `👤 <b>${name}</b> — ${range}`,
    nothingInRange: (name: string, range: string, last: string) =>
      `<b>${name}</b> posted nothing in ${range}. Last message: ${last}.`,
    neverPosted: (name: string) => `<b>${name}</b> has never posted while I have been watching.`,
    labels: {
      messages: 'Messages',
      perWeek: 'Per week',
      activeDays: 'Active days',
      streak: 'Current streak',
      avgLength: 'Avg length',
      peakHour: 'Busiest hour',
      reactions: 'Reactions',
    },
    rank: (rank: number, total: number) => `  (#${rank} of ${total})`,
    activeDaysOf: (n: number) => ` of ${n}`,
    streakValue: (n: number) => `${n} ${day(n)}`,
    avgLengthValue: (n: number) => `${n} chars`,
    reactionsValue: (given: number, received: number) =>
      `${given} given · ${received} received`,
    daily: 'Daily',
    types: 'Types',
    lastMessage: (when: string, kind: string) => `Last message ${when} (${kind}).`,
    tip: '<i>Tip: reply to someone and run /me to see their stats.</i>',
    lastPosted: (name: string, when: string, kind: string) =>
      `<b>${name}</b> last posted <b>${when}</b> — a ${kind}.`,
    notPosted: (name: string) => `<b>${name}</b> has not posted since I started watching.`,
    whenTitle: (who: string, range: string) => `🕒 <b>When ${who} posts — ${range}</b>`,
    whenEmpty: (range: string) => `No messages in ${range}.`,
    userNotSeen: (mention: string) =>
      `I have not seen ${mention} post in this chat yet, so there is nothing to report. ` +
      `Reply to one of their messages instead if the username changed.`,
    unknownWho: 'Could not work out who you are.',
  },

  dead: {
    none: (days: number) =>
      `👻 Nobody has been quiet for ${days}+ ${day(days)}. Everyone I track has posted recently.`,
    title: (days: number) => `👻 <b>Quiet for ${days}+ ${day(days)}</b>`,
    neverPosted: 'Never posted',
    silent: 'Silent',
    lurking: 'Lurking (reacts, does not post)',
    coverage: (known: number, total: number) =>
      `I know ${known} of ${total} ${member(total)}. ` +
      `Members who joined before me and have never posted or reacted are invisible ` +
      `to the Bot API, so this list is a lower bound.`,
    since: (when: string) => `Watching since ${when}.`,
  },

  misc: {
    help: `<b>Dead Souls</b> — activity statistics for this group.

<b>/stats</b> [period] — group overview and top posters
<b>/top</b> [period] — full leaderboard
<b>/me</b> [@user] [period] — detailed profile (reply to someone to target them)
<b>/last</b> [@user] — when someone last posted
<b>/when</b> [@user] [period] — hour-of-day activity
<b>/dead</b> [days] — members who have gone quiet
<b>/settings</b> — settings menu (language, quiet threshold)
<b>/status</b> — what the bot can currently see

<i>period</i> = <code>week</code> (default), <code>month</code>, <code>year</code>, <code>all</code>, or a number of days.

I record message metadata only — never message text.`,
    statusChatId: (id: number) => `Chat id: <code>${id}</code>`,
    statusSince: (when: string) => `Watching since: ${when}`,
    statusMembers: (tracked: number, confirmed: number, total: number | string) =>
      `Members known: ${tracked} (${confirmed} confirmed) of ${total}`,
    statusTimezone: (tz: string) => `Timezone: <code>${tz}</code>`,
    statusLang: (name: string) => `Language: ${name}`,
    statusPrivacyOff: 'Privacy mode: ✅ disabled (sees all messages)',
    statusPrivacyOn:
      'Privacy mode: ⚠️ ENABLED — I only see commands. ' +
      'Disable it in @BotFather, then remove and re-add me.',
    forgetSelf: 'Erased everything I had recorded about you in this chat.',
    forgetOther: (id: number) => `Erased everything recorded about user ${id} in this chat.`,
    forgetDenied: 'Only a configured admin can erase another member’s data.',
    langUsage: (current: string) =>
      `Current language: <b>${current}</b>\nChange it: <code>/lang uk</code> or <code>/lang en</code>`,
    langChanged: (name: string) => `Language switched to <b>${name}</b>.`,
    langDenied: 'Only a group administrator can change the language.',
    langUnknown: (code: string) =>
      `Unknown language “${code}”. Available: <code>uk</code>, <code>en</code>.`,
  },

  settings: {
    title: '⚙️ <b>Settings</b>',
    subtitle: 'These apply to this group only.',
    langButton: (name: string) => `🌐 Language: ${name}`,
    daysButton: (n: number) => `👻 Quiet threshold: ${n} ${day(n)}`,
    close: '✖️ Close',
    back: '‹ Back',
    langTitle: '🌐 <b>Choose a language</b>',
    daysTitle: '👻 <b>Quiet threshold</b>',
    daysHint: 'How many days without a message before someone appears in /dead.',
    daysOption: (n: number) => `${n} ${day(n)}`,
    saved: '✅ Saved',
    denied: 'Only a group administrator can change settings.',
    closed: '⚙️ Settings closed.',
    current: '✓ ',
  },

  kinds: {
    text: 'text',
    photo: 'photo',
    video: 'video',
    sticker: 'sticker',
    voice: 'voice message',
    video_note: 'video note',
    audio: 'audio',
    document: 'document',
    animation: 'GIF',
    poll: 'poll',
    dice: 'dice',
    contact: 'contact',
    venue: 'venue',
    location: 'location',
    game: 'game',
    story: 'story',
    paid_media: 'paid media',
    command: 'command',
    other: 'other',
  },

  commands: {
    stats: 'Group activity overview',
    top: 'Leaderboard of most active members',
    me: 'Your stats (or reply to someone for theirs)',
    last: 'When someone last posted',
    when: 'Hour-of-day activity chart',
    dead: 'Members who have gone quiet',
    settings: 'Bot settings',
    status: 'What the bot can currently see',
    help: 'Show all commands',
  },
};
