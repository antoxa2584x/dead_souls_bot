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

/** The YYYY-MM-DD immediately before `day`. */
export function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD keys. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000);
}

/** Localised "time ago" strings; supplied by the caller's dictionary. */
export interface AgoStrings {
  justNow: string;
  minutes: (m: number) => string;
  hoursMinutes: (h: number, m: number) => string;
  daysHours: (d: number, h: number) => string;
  monthsDays: (mo: number, d: number) => string;
}

/** Human-readable gap, e.g. "3d 4h ago" / "3 дні 4 год тому". */
export function humanSince(tsSeconds: number, ago: AgoStrings): string {
  const delta = Math.max(0, nowSeconds() - tsSeconds);
  if (delta < 60) return ago.justNow;
  const minutes = Math.floor(delta / 60);
  if (minutes < 60) return ago.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ago.hoursMinutes(hours, minutes % 60);
  const days = Math.floor(hours / 24);
  if (days < 30) return ago.daysHours(days, hours % 24);
  const months = Math.floor(days / 30);
  return ago.monthsDays(months, days % 30);
}
