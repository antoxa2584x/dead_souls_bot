/**
 * Renders the achievement UI to the terminal against synthetic data, so the
 * layout can be checked without a bot token. Run: npm run preview [uk|en]
 */
import { rmSync } from 'node:fs';

const DB = './data/preview.db';
process.env.BOT_TOKEN ??= '0:preview';
process.env.DB_PATH = DB;
process.env.TZ_NAME ??= 'Europe/Kyiv';

for (const suffix of ['', '-wal', '-shm']) rmSync(`${DB}${suffix}`, { force: true });

const q = await import('../src/db/queries.js');
const { nowSeconds } = await import('../src/time.js');
const { dictFor } = await import('../src/i18n/index.js');
const ach = await import('../src/achievements/index.js');
const { TIER_ICON, TIER_SCORE, TOTAL_SCORE } = ach;

const lang = process.argv[2] === 'en' ? 'en' : 'uk';
const d = dictFor(lang);

const CHAT = -100999;
const now = nowSeconds();
const DAY = 86400;

q.upsertUser({ id: 1, first_name: 'Alice', username: 'alice', is_bot: false }, now);
q.setMemberStatus(CHAT, 1, 'member', now - 200 * DAY);

let msgId = 1;
// A busy 120-day history, with photos, stickers and late nights mixed in.
for (let dayAgo = 119; dayAgo >= 0; dayAgo--) {
  const count = 6 + (dayAgo % 5);
  for (let i = 0; i < count; i++) {
    const kinds = ['text', 'text', 'text', 'photo', 'sticker', 'voice'];
    q.insertMessage({
      chatId: CHAT,
      msgId: msgId++,
      userId: 1,
      senderChatId: null,
      ts: now - dayAgo * DAY + (i % 6) * 3600 + (i % 3) * 600,
      kind: kinds[i % kinds.length]!,
      charLen: i === 0 ? 1200 : 40 + i,
      replyToUserId: i % 3 === 0 ? 2 : null,
      threadId: null,
      isForward: false,
    });
  }
}
for (let i = 0; i < 140; i++) q.replaceReactions(CHAT, i + 1, 100 + i, ['👍'], now - i * 3600);

const card = ach.evaluate(CHAT, 1);
const stats = ach.playerStats(CHAT, 1);

const strip = (s: string) => s.replace(/<[^>]+>/g, '');
const rule = () => console.log('─'.repeat(46));

console.log(`\n### /achievements  (${lang})`);
rule();
console.log(strip(d.ach.ui.header('@alice', card.level)));
console.log(d.ach.ui.gamerscore(card.score, TOTAL_SCORE));
console.log(
  card.atMaxLevel
    ? d.ach.ui.maxLevel
    : d.ach.ui.levelBar(card.scoreIntoLevel, card.scoreForNextLevel),
);
console.log(
  d.ach.ui.completion(
    card.unlocked.length,
    card.progress.length,
    Math.round((card.unlocked.length / card.progress.length) * 100),
  ),
);
console.log(
  d.ach.ui.tally(card.counts.bronze, card.counts.silver, card.counts.gold, card.counts.platinum),
);

console.log(`\n${d.ach.ui.unlockedSection}`);
for (const p of card.unlocked
  .slice()
  .sort((a, b) => TIER_SCORE[b.def.tier] - TIER_SCORE[a.def.tier])
  .slice(0, 12)) {
  console.log(`${TIER_ICON[p.def.tier]} ${d.ach.list[p.def.id]!.name} · ${TIER_SCORE[p.def.tier]}`);
}

console.log(`\n${d.ach.ui.nextSection}`);
const { bar } = await import('../src/format.js');
for (const p of card.locked
  .filter((x) => x.def.id !== 'completionist')
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 3)) {
  const meta = p.def.secret ? { name: d.ach.ui.secretName, desc: d.ach.ui.secretDesc } : d.ach.list[p.def.id]!;
  console.log(`${TIER_ICON[p.def.tier]} ${meta.name} · ${TIER_SCORE[p.def.tier]}`);
  console.log(`   ${meta.desc}`);
  console.log(`   ${bar(p.value, p.target)} ${p.value}/${p.target} · ${Math.round(p.ratio * 100)}%`);
}

console.log(`\n### unlock toast`);
rule();
const sample = card.unlocked.find((p) => p.def.tier === 'gold') ?? card.unlocked[0]!;
console.log(strip(d.ach.ui.toastTitle));
console.log('');
console.log(`${TIER_ICON[sample.def.tier]} ${d.ach.list[sample.def.id]!.name} · ${TIER_SCORE[sample.def.tier]}`);
console.log(d.ach.list[sample.def.id]!.desc);
console.log('');
console.log(`@alice — ${d.ach.ui.toastScore(card.score, TOTAL_SCORE)}`);
console.log(strip(d.ach.ui.levelUp(card.level)));

console.log(`\n### underlying stats`);
rule();
console.log(
  `messages=${stats.messages} streak=${stats.longestStreak} bestDay=${stats.bestDay} ` +
    `night=${stats.nightMessages} photos=${stats.kinds['photo'] ?? 0} ` +
    `stickers=${stats.kinds['sticker'] ?? 0} replies=${stats.replies} ` +
    `reactionsIn=${stats.reactionsReceived}`,
);
console.log('');

for (const suffix of ['', '-wal', '-shm']) rmSync(`${DB}${suffix}`, { force: true });
