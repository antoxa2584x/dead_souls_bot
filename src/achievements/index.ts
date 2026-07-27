import {
  allActiveDays,
  allKindCounts,
  bestDayCount,
  dayBookends,
  daysAtTop,
  maxReactionsOnMessage,
  rawPlayerStats,
  recordUnlocks,
  totalReactionsGiven,
  totalReactionsReceived,
  unlockedAchievements,
} from '../db/queries.js';
import { dayKey, daysBetween, nowSeconds, previousDay } from '../time.js';
import { ACHIEVEMENTS, PLATINUM_ID } from './definitions.js';
import {
  TIER_SCORE,
  type AchievementDef,
  type AchievementProgress,
  type PlayerStats,
  type Tier,
} from './types.js';

export * from './types.js';
export { ACHIEVEMENTS, ACHIEVEMENT_IDS, PLATINUM_ID } from './definitions.js';

/** The platinum has no threshold — it lands when everything else has. */
const PLATINUM_DEF: AchievementDef = {
  id: PLATINUM_ID,
  tier: 'platinum',
  target: ACHIEVEMENTS.length,
  value: () => 0, // never evaluated directly; see evaluate()
};

export const TOTAL_SCORE =
  ACHIEVEMENTS.reduce((sum, a) => sum + TIER_SCORE[a.tier], 0) + TIER_SCORE.platinum;

/**
 * Quadratic curve, tuned so a full 1500G lands exactly on the top level rather
 * than partway toward an unreachable one. Unlocking everything = LEVEL 11.
 */
const LEVEL_STEP = 15;

/** Gamerscore needed to reach a trophy level. */
export function scoreForLevel(level: number): number {
  return LEVEL_STEP * (level - 1) ** 2;
}

export function levelForScore(score: number): number {
  return Math.floor(Math.sqrt(score / LEVEL_STEP)) + 1;
}

export const MAX_LEVEL = levelForScore(TOTAL_SCORE);

/** Longest run of consecutive active days, and the longest gap between them. */
function streaksFrom(days: string[], today: string): {
  longest: number;
  current: number;
  longestSilence: number;
} {
  if (days.length === 0) return { longest: 0, current: 0, longestSilence: 0 };

  let longest = 1;
  let run = 1;
  let longestSilence = 0;

  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1]!, days[i]!);
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      // A gap of N days means N-1 silent days between the two active ones.
      longestSilence = Math.max(longestSilence, gap - 1);
      run = 1;
    }
  }

  // The streak only counts as current if it reaches today or yesterday.
  const last = days[days.length - 1]!;
  const yesterday = previousDay(today);
  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1]!, days[i]!) === 1) current += 1;
      else break;
    }
  }

  return { longest, current, longestSilence };
}

export function playerStats(chatId: number, userId: number): PlayerStats {
  const raw = rawPlayerStats(chatId, userId);
  const days = allActiveDays(chatId, userId);
  const today = dayKey(nowSeconds());
  const { longest, current, longestSilence } = streaksFrom(days, today);
  const bookends = dayBookends(chatId, userId);

  return {
    messages: raw.msgs,
    activeDays: raw.active_days,
    currentStreak: current,
    longestStreak: longest,
    bestDay: bestDayCount(chatId, userId),
    daysAtTop: daysAtTop(chatId, userId),
    nightMessages: raw.night ?? 0,
    earlyMessages: raw.early ?? 0,
    replies: raw.replies ?? 0,
    edits: raw.edited ?? 0,
    longestMessage: raw.longest_msg ?? 0,
    reactionsGiven: totalReactionsGiven(chatId, userId),
    reactionsReceived: totalReactionsReceived(chatId, userId),
    bestReactedMessage: maxReactionsOnMessage(chatId, userId),
    firstOfDay: bookends.firsts,
    lastOfDay: bookends.lasts,
    longestSilenceDays: longestSilence,
    daysSinceFirstMessage: raw.first_ts ? daysBetween(dayKey(raw.first_ts), today) : 0,
    kinds: allKindCounts(chatId, userId),
  };
}

export interface Scorecard {
  progress: AchievementProgress[];
  unlocked: AchievementProgress[];
  locked: AchievementProgress[];
  score: number;
  level: number;
  scoreIntoLevel: number;
  scoreForNextLevel: number;
  atMaxLevel: boolean;
  counts: Record<Tier, number>;
}

/**
 * Evaluates the whole catalogue against a player. Pure — it reads unlock
 * timestamps but never writes them; see `syncUnlocks` for that.
 */
export function evaluate(chatId: number, userId: number, stats?: PlayerStats): Scorecard {
  const s = stats ?? playerStats(chatId, userId);
  const unlockedAt = unlockedAchievements(chatId, userId);

  const progress: AchievementProgress[] = ACHIEVEMENTS.map((def) => {
    const value = def.value(s);
    const unlocked = value >= def.target;
    return {
      def,
      value,
      target: def.target,
      unlocked,
      unlockedAt: unlockedAt.get(def.id) ?? null,
      ratio: Math.min(1, def.target === 0 ? 1 : value / def.target),
    };
  });

  const baseUnlocked = progress.filter((p) => p.unlocked).length;
  const platinumEarned = baseUnlocked === ACHIEVEMENTS.length;
  progress.push({
    def: PLATINUM_DEF,
    value: baseUnlocked,
    target: ACHIEVEMENTS.length,
    unlocked: platinumEarned,
    unlockedAt: unlockedAt.get(PLATINUM_ID) ?? null,
    ratio: baseUnlocked / ACHIEVEMENTS.length,
  });

  const unlocked = progress.filter((p) => p.unlocked);
  const score = unlocked.reduce((sum, p) => sum + TIER_SCORE[p.def.tier], 0);
  const level = levelForScore(score);

  const counts: Record<Tier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const p of unlocked) counts[p.def.tier] += 1;

  return {
    progress,
    unlocked,
    locked: progress.filter((p) => !p.unlocked),
    score,
    level,
    scoreIntoLevel: score - scoreForLevel(level),
    scoreForNextLevel: scoreForLevel(level + 1) - scoreForLevel(level),
    atMaxLevel: level >= MAX_LEVEL,
    counts,
  };
}

/**
 * Persists any achievements newly satisfied since the last check and returns
 * them, so the caller can announce them. Returns [] when nothing is new.
 */
export function syncUnlocks(
  chatId: number,
  userId: number,
  card?: Scorecard,
): AchievementProgress[] {
  const scorecard = card ?? evaluate(chatId, userId);
  const fresh = scorecard.unlocked.filter((p) => p.unlockedAt === null);
  if (fresh.length === 0) return [];

  const ts = nowSeconds();
  recordUnlocks(
    chatId,
    userId,
    fresh.map((p) => p.def.id),
    ts,
  );
  for (const p of fresh) p.unlockedAt = ts;
  return fresh;
}
