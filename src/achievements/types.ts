/** PS3-style trophy tiers, scored in Xbox-360-style gamerscore. */
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const TIER_ICON: Record<Tier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '🏆',
};

export const TIER_SCORE: Record<Tier, number> = {
  bronze: 15,
  silver: 30,
  gold: 100,
  // 360G for the platinum, because of course.
  platinum: 360,
};

/** Everything an achievement can be measured against, computed once per user. */
export interface PlayerStats {
  messages: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: number;
  daysAtTop: number;
  nightMessages: number;
  earlyMessages: number;
  replies: number;
  edits: number;
  longestMessage: number;
  reactionsGiven: number;
  reactionsReceived: number;
  bestReactedMessage: number;
  firstOfDay: number;
  lastOfDay: number;
  longestSilenceDays: number;
  daysSinceFirstMessage: number;
  kinds: Record<string, number>;
}

export interface AchievementDef {
  id: string;
  tier: Tier;
  /** Where the player currently stands. */
  value: (s: PlayerStats) => number;
  /** The value at which it unlocks. */
  target: number;
  /** Hidden until unlocked, like a secret trophy. */
  secret?: boolean;
}

export interface AchievementProgress {
  def: AchievementDef;
  value: number;
  target: number;
  unlocked: boolean;
  unlockedAt: number | null;
  /** 0..1 */
  ratio: number;
}
