// UI translations. The merchant's language ("I speak in") drives every screen string.
// Keys are the exact English strings used in the code; a missing translation falls back to English, so the app
// never shows a blank. Placeholders are written {name} and filled by `t('Hi {name}', { name })`.
// Translations live in src/i18n/<group>.ts, one group per part of the app, merged here.
import { useKhata } from '@/store/useKhata';
import type { LangCode } from '@/lib/types';
import { saathi } from '@/i18n/saathi';
import { khata } from '@/i18n/khata';
import { more } from '@/i18n/more';
import { shared } from '@/i18n/shared';

export type Dict = Partial<Record<LangCode, Record<string, string>>>;
const GROUPS: Dict[] = [shared, saathi, khata, more];

export function translate(lang: LangCode, text: string, vars?: Record<string, string | number>): string {
  let out = text;
  if (lang !== 'en-IN') {
    for (const g of GROUPS) {
      const hit = g[lang]?.[text];
      if (hit) { out = hit; break; }
    }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** In components: `const t = useT(); t('Remind now')`. Re-renders when the merchant changes language. */
export function useT() {
  const lang = useKhata((s) => s.lang);
  return (text: string, vars?: Record<string, string | number>) => translate(lang, text, vars);
}

/** Outside React (toasts in the store, helpers): uses the current language at call time. */
export function tNow(text: string, vars?: Record<string, string | number>): string {
  return translate(useKhata.getState().lang, text, vars);
}

/** Locale for dates and numbers that should follow the UI language. */
export const LOCALE: Record<LangCode, string> = { 'en-IN': 'en-IN', 'hi-IN': 'hi-IN', 'kn-IN': 'kn-IN', 'ta-IN': 'ta-IN', 'te-IN': 'te-IN' };
