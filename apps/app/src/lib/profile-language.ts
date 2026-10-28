import type { Locale } from '@daybrief/core';
import { resolveLanguage, type Language } from '@daybrief/i18n';

/** UI language for a profile: its locale, or the system language while the locale is null. */
export function profileLanguage(locale: Locale | null, systemLocales: readonly string[]): Language {
  return locale ?? resolveLanguage(systemLocales);
}
