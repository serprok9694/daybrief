export const supportedLanguages = ['en', 'ru'] as const;
export type Language = (typeof supportedLanguages)[number];
export const fallbackLanguage: Language = 'en';

export function isLanguage(value: string): value is Language {
  return (supportedLanguages as readonly string[]).includes(value);
}

/**
 * Picks the first supported language from a list of BCP 47 locales in order of preference
 * ("ru-RU" → "ru"). Falls back to en when none is supported.
 */
export function resolveLanguage(locales: readonly string[]): Language {
  for (const locale of locales) {
    const base = locale.toLowerCase().split(/[-_]/)[0] ?? '';
    if (isLanguage(base)) return base;
  }
  return fallbackLanguage;
}

/** The system's preferred locales: navigator.languages on web, the Intl default locale on native. */
export function systemLocales(): string[] {
  // Typed by hand: packages compile without the DOM lib, and React Native's navigator has no languages.
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } })
    .navigator;
  if (nav?.languages?.length) return [...nav.languages];
  if (nav?.language) return [nav.language];
  return [Intl.DateTimeFormat().resolvedOptions().locale];
}
