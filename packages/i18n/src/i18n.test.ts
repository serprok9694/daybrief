import { describe, expect, it } from 'vitest';
import { i18n, resources, setLanguage } from './i18n';
import { resolveLanguage, supportedLanguages } from './languages';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('dictionaries', () => {
  it('have the same keys in every language', () => {
    const en = keys(resources.en.translation).sort();
    for (const lng of supportedLanguages) {
      expect(keys(resources[lng].translation).sort()).toEqual(en);
    }
  });

  it('have no empty strings', () => {
    for (const lng of supportedLanguages) {
      for (const key of keys(resources[lng].translation)) {
        expect(i18n.getFixedT(lng)(key as 'common.refresh'), `${lng}:${key}`).not.toBe('');
      }
    }
  });
});

describe('ICU plurals', () => {
  it('declines overdueBy in ru', () => {
    const t = i18n.getFixedT('ru');
    expect(t('tasks.overdueBy', { days: 1 })).toBe('Просрочено · 1 день');
    expect(t('tasks.overdueBy', { days: 2 })).toBe('Просрочено · 2 дня');
    expect(t('tasks.overdueBy', { days: 5 })).toBe('Просрочено · 5 дней');
    expect(t('tasks.overdueBy', { days: 21 })).toBe('Просрочено · 21 день');
  });

  it('declines overdueBy in en', () => {
    const t = i18n.getFixedT('en');
    expect(t('tasks.overdueBy', { days: 1 })).toBe('Overdue · 1 day');
    expect(t('tasks.overdueBy', { days: 5 })).toBe('Overdue · 5 days');
  });

  it('interpolates simple placeholders', () => {
    expect(i18n.getFixedT('en')('greeting.morning', { name: 'Sergei' })).toBe(
      'Good morning, Sergei',
    );
  });
});

describe('setLanguage', () => {
  it('switches the active language without re-init', async () => {
    await setLanguage('ru');
    expect(i18n.t('settings.theme.dark')).toBe('Тёмная');
    await setLanguage('en');
    expect(i18n.t('settings.theme.dark')).toBe('Dark');
  });
});

describe('resolveLanguage', () => {
  it('picks the first supported base language', () => {
    expect(resolveLanguage(['ru-RU', 'en-US'])).toBe('ru');
    expect(resolveLanguage(['de-DE', 'en_GB'])).toBe('en');
    expect(resolveLanguage(['RU'])).toBe('ru');
  });

  it('falls back to en', () => {
    expect(resolveLanguage(['de-DE', 'fr'])).toBe('en');
    expect(resolveLanguage([])).toBe('en');
  });
});

describe('typed keys', () => {
  it('rejects unknown keys at compile time', () => {
    // These lines exist for tsc: if a key stops being an error, @ts-expect-error fails typecheck.
    // @ts-expect-error unknown key
    i18n.t('tasks.nope');
    // @ts-expect-error unknown namespace-like prefix
    i18n.t('nothing.here');
    expect(i18n.t('tasks.title')).toBeTypeOf('string');
  });
});
