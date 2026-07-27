import type { CommandContext, Context } from 'grammy';
import { dayKey, dayKeyDaysAgo, nowSeconds } from '../time.js';
import { findUserByUsername, getUser, type PersonRow } from '../db/queries.js';

export interface Range {
  label: string;
  sinceDay: string;
  /** null means "everything on record". */
  days: number | null;
}

const ALL_TIME = '0000-00-00';

/** Accepts: week | month | year | all | <N> (days). Defaults to a week. */
export function parseRange(arg: string | undefined): Range {
  const token = (arg ?? '').trim().toLowerCase();

  if (token === 'all' || token === 'ever') {
    return { label: 'all time', sinceDay: ALL_TIME, days: null };
  }
  if (token === 'day' || token === 'today') {
    return { label: 'today', sinceDay: dayKey(nowSeconds()), days: 1 };
  }
  if (token === 'month') return { label: 'last 30 days', sinceDay: dayKeyDaysAgo(29), days: 30 };
  if (token === 'year') return { label: 'last 365 days', sinceDay: dayKeyDaysAgo(364), days: 365 };

  const n = Number(token);
  if (Number.isInteger(n) && n > 0 && n <= 3650) {
    return { label: `last ${n} days`, sinceDay: dayKeyDaysAgo(n - 1), days: n };
  }

  return { label: 'last 7 days', sinceDay: dayKeyDaysAgo(6), days: 7 };
}

/** The list of calendar days covered by a range, oldest first. */
export function rangeDays(range: Range, cap = 60): string[] {
  const count = Math.min(range.days ?? cap, cap);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(dayKeyDaysAgo(i));
  return out;
}

/**
 * Resolve who a command is about: the replied-to author, an @username we have
 * already seen, or the caller.
 */
export function resolveTarget(
  ctx: CommandContext<Context>,
): { person: PersonRow; self: boolean } | { error: string } {
  const replied = ctx.message?.reply_to_message?.from;
  if (replied && !replied.is_bot) {
    return {
      person: getUser(replied.id) ?? {
        user_id: replied.id,
        username: replied.username ?? null,
        first_name: replied.first_name ?? null,
        last_name: replied.last_name ?? null,
      },
      self: replied.id === ctx.from?.id,
    };
  }

  const mention = ctx.match.trim().split(/\s+/).find((t) => t.startsWith('@'));
  if (mention) {
    const person = findUserByUsername(mention);
    if (!person) {
      return {
        error:
          `I have not seen ${mention} post in this chat yet, so there is nothing to report. ` +
          `Reply to one of their messages instead if the username changed.`,
      };
    }
    return { person, self: person.user_id === ctx.from?.id };
  }

  const from = ctx.from;
  if (!from) return { error: 'Could not work out who you are.' };
  return {
    person: getUser(from.id) ?? {
      user_id: from.id,
      username: from.username ?? null,
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
    },
    self: true,
  };
}
