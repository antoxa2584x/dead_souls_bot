import { config } from './config.js';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: config.timezone,
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Local calendar day for a unix timestamp, as YYYY-MM-DD. */
export function dayKey(tsSeconds: number): string {
  return dayFmt.format(new Date(tsSeconds * 1000));
}

/** Local hour of day (0-23) for a unix timestamp. */
export function hourOf(tsSeconds: number): number {
  return Number(hourFmt.format(new Date(tsSeconds * 1000)));
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** YYYY-MM-DD for `n` days before today, in the configured timezone. */
export function dayKeyDaysAgo(n: number): string {
  return dayKey(nowSeconds() - n * 86400);
}

/** Human-readable gap, e.g. "3d 4h ago" or "just now". */
export function humanSince(tsSeconds: number): string {
  const delta = Math.max(0, nowSeconds() - tsSeconds);
  if (delta < 60) return 'just now';
  const minutes = Math.floor(delta / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d ago`;
}
