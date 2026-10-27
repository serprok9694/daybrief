export { i18n, resources, getLanguage, setLanguage } from './i18n';
export {
  supportedLanguages,
  fallbackLanguage,
  isLanguage,
  resolveLanguage,
  systemLocales,
  type Language,
} from './languages';
export { I18nProvider } from './provider';
export { useTranslation } from 'react-i18next';
export type { Dictionary } from './locales/en';
