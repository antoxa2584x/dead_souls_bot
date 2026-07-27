import type { AchievementDef } from './types.js';

const kind = (name: string) => (s: { kinds: Record<string, number> }) => s.kinds[name] ?? 0;

/**
 * The catalogue. Thresholds live here rather than in the database so they can
 * be retuned without a migration — only unlock timestamps are persisted.
 *
 * PLATINUM is handled separately in index.ts: like a PS3 platinum it is earned
 * by unlocking everything else, so it has no threshold of its own.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Streaks ──────────────────────────────────────────────────────────
  { id: 'getting_started', tier: 'bronze', target: 3, value: (s) => s.longestStreak },
  { id: 'regular', tier: 'bronze', target: 7, value: (s) => s.longestStreak },
  { id: 'dedicated', tier: 'silver', target: 30, value: (s) => s.longestStreak },
  { id: 'no_days_off', tier: 'gold', target: 100, value: (s) => s.longestStreak },
  { id: 'unbroken', tier: 'gold', target: 365, value: (s) => s.longestStreak },

  // ── Volume ───────────────────────────────────────────────────────────
  { id: 'first_hundred', tier: 'bronze', target: 100, value: (s) => s.messages },
  { id: 'thousand_club', tier: 'silver', target: 1000, value: (s) => s.messages },
  { id: 'ten_thousand', tier: 'gold', target: 10_000, value: (s) => s.messages },
  { id: 'busy_day', tier: 'bronze', target: 50, value: (s) => s.bestDay },
  { id: 'personal_best', tier: 'silver', target: 100, value: (s) => s.bestDay },

  // ── Leaderboard ──────────────────────────────────────────────────────
  { id: 'top_of_board', tier: 'bronze', target: 1, value: (s) => s.daysAtTop },
  { id: 'dominance', tier: 'gold', target: 30, value: (s) => s.daysAtTop },

  // ── Body clock ───────────────────────────────────────────────────────
  { id: 'night_shift', tier: 'silver', target: 100, value: (s) => s.nightMessages },
  { id: 'early_riser', tier: 'silver', target: 100, value: (s) => s.earlyMessages },
  { id: 'nocturnal', tier: 'gold', target: 500, value: (s) => s.nightMessages },

  // ── Content ──────────────────────────────────────────────────────────
  { id: 'shutterbug', tier: 'bronze', target: 100, value: kind('photo') },
  { id: 'cinematographer', tier: 'bronze', target: 50, value: kind('video') },
  { id: 'gif_librarian', tier: 'bronze', target: 100, value: kind('animation') },
  { id: 'wall_of_text', tier: 'bronze', target: 1000, value: (s) => s.longestMessage },
  { id: 'sticker_collection', tier: 'silver', target: 250, value: kind('sticker') },
  { id: 'on_air', tier: 'silver', target: 100, value: kind('voice') },

  // ── Social ───────────────────────────────────────────────────────────
  { id: 'went_viral', tier: 'bronze', target: 10, value: (s) => s.bestReactedMessage },
  { id: 'conversationalist', tier: 'silver', target: 500, value: (s) => s.replies },
  { id: 'crowd_pleaser', tier: 'silver', target: 100, value: (s) => s.reactionsReceived },
  { id: 'supportive', tier: 'silver', target: 250, value: (s) => s.reactionsGiven },

  // ── Habits & oddities ────────────────────────────────────────────────
  { id: 'second_thoughts', tier: 'bronze', target: 100, value: (s) => s.edits },
  {
    id: 'back_from_the_dead',
    tier: 'bronze',
    target: 30,
    value: (s) => s.longestSilenceDays,
    secret: true,
  },
  { id: 'first_light', tier: 'silver', target: 50, value: (s) => s.firstOfDay },
  { id: 'last_word', tier: 'silver', target: 50, value: (s) => s.lastOfDay },
  { id: 'old_guard', tier: 'gold', target: 365, value: (s) => s.daysSinceFirstMessage },
];

export const PLATINUM_ID = 'completionist';

export const ACHIEVEMENT_IDS = [...ACHIEVEMENTS.map((a) => a.id), PLATINUM_ID];
