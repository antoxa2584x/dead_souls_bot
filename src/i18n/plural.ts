/**
 * Ukrainian has three plural forms, picked by the last digit(s):
 *   1 повідомлення · 2-4 повідомлення · 5+ повідомлень
 * The 11-14 range is the exception that breaks the simple last-digit rule.
 */
export function ukPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function enPlural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
