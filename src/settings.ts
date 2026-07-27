import { config } from './config.js';
import {
  getChatSettings,
  setChatLang,
  setDeadAfterDays,
  type ChatSettings,
} from './db/queries.js';

/**
 * Per-chat overrides, read on every command but written rarely, so they are
 * cached in memory. `null` in a column means "use the .env default".
 */
const cache = new Map<number, ChatSettings>();

function load(chatId: number): ChatSettings {
  let row = cache.get(chatId);
  if (row === undefined) {
    row = getChatSettings(chatId) ?? { lang: null, dead_after_days: null };
    cache.set(chatId, row);
  }
  return row;
}

export function chatLang(chatId: number | undefined): string {
  if (chatId === undefined) return config.defaultLang;
  return load(chatId).lang ?? config.defaultLang;
}

export function chatDeadAfterDays(chatId: number): number {
  return load(chatId).dead_after_days ?? config.deadAfterDays;
}

export function updateLang(chatId: number, lang: string): void {
  setChatLang(chatId, lang);
  cache.set(chatId, { ...load(chatId), lang });
}

export function updateDeadAfterDays(chatId: number, days: number): void {
  setDeadAfterDays(chatId, days);
  cache.set(chatId, { ...load(chatId), dead_after_days: days });
}
