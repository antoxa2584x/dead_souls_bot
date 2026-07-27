import type { PersonRow } from './db/queries.js';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function displayName(p: Partial<PersonRow> & { user_id?: number }): string {
  if (p.username) return `@${p.username}`;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  return p.user_id ? `user ${p.user_id}` : 'unknown';
}

/** Truncate to `max` display columns so monospace tables stay aligned. */
export function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

export function padStart(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

const BLOCKS = ['', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** Sparkline over a series of counts. */
export function sparkline(values: number[]): string {
  const max = Math.max(...values, 0);
  if (max === 0) return '·'.repeat(values.length);
  return values
    .map((v) => {
      if (v === 0) return '·';
      const idx = Math.max(1, Math.round((v / max) * (BLOCKS.length - 1)));
      return BLOCKS[idx];
    })
    .join('');
}

/**
 * Horizontal bar of fixed width, proportional to `value / max`.
 *
 * A bar only fills completely when the value actually reaches the target —
 * otherwise rounding makes 96% look finished. The same applies at the bottom:
 * any progress at all shows at least one block.
 */
export function bar(value: number, max: number, width = 12): string {
  if (max <= 0) return '█'.repeat(width);
  if (value >= max) return '█'.repeat(width);

  let filled = Math.round((value / max) * width);
  if (filled >= width) filled = width - 1;
  if (filled === 0 && value > 0) filled = 1;

  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Wrap pre-aligned text in a Telegram <pre> block. */
export function codeBlock(lines: string[]): string {
  return `<pre>${escapeHtml(lines.join('\n'))}</pre>`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
