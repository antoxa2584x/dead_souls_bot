import { config } from '../config.js';
import { chatLang } from '../settings.js';
import { en } from './en.js';
import { uk, type Dict } from './uk.js';

export type { Dict } from './uk.js';

export const LOCALES: Record<string, Dict> = { uk, en };
export const LANG_CODES = Object.keys(LOCALES);

export function isSupportedLang(code: string): boolean {
  return code in LOCALES;
}

export function dictFor(code: string | undefined): Dict {
  return (code && LOCALES[code]) || LOCALES[config.defaultLang] || uk;
}

/** The dictionary for a chat, falling back to DEFAULT_LANG. */
export function t(chatId: number | undefined): Dict {
  return dictFor(chatLang(chatId));
}
