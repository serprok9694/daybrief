import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { fallbackLanguage, resolveLanguage, systemLocales, type Language } from './languages';
import { en } from './locales/en';
import { ru } from './locales/ru';

export const resources = {
  en: { translation: en },
  ru: { translation: ru },
} as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}

/**
 * The app's i18next instance. Starts in the system language (first visit); once the profile
 * is loaded, the app calls setLanguage(profile.locale).
 */
export const i18n = i18next.createInstance();

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveLanguage(systemLocales()),
    fallbackLng: fallbackLanguage,
    // Resources are bundled, so init synchronously: the first render already has strings.
    initAsync: false,
    interpolation: { escapeValue: false },
  });

export function getLanguage(): Language {
  return resolveLanguage([i18n.resolvedLanguage ?? i18n.language]);
}

/** Switches the UI language in place; components using useTranslation re-render. */
export async function setLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
}
