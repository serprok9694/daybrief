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

describe('events strings', () => {
  it('formats durations in hours and minutes', () => {
    const en = i18n.getFixedT('en');
    const ru = i18n.getFixedT('ru');
    expect(en('events.duration', { hours: 0, minutes: 30 })).toBe('30\u00A0min');
    expect(en('events.duration', { hours: 1, minutes: 0 })).toBe('1\u00A0h');
    expect(en('events.duration', { hours: 1, minutes: 30 })).toBe('1\u00A0h 30\u00A0min');
    expect(ru('events.duration', { hours: 2, minutes: 15 })).toBe('2\u00A0ч 15\u00A0мин');
    expect(ru('events.duration', { hours: 3, minutes: 0 })).toBe('3\u00A0ч');
  });

  it('counts down to the next event', () => {
    const en = i18n.getFixedT('en');
    const ru = i18n.getFixedT('ru');
    expect(en('events.startsIn', { minutes: 18 })).toBe('in 18 min');
    expect(en('events.startsInHours', { hours: 2, minutes: 0 })).toBe('in 2 h');
    expect(ru('events.startsInHours', { hours: 1, minutes: 5 })).toBe('через 1 ч 5 мин');
  });

  // Non-breaking spaces: a narrow header wraps after "Updated", not inside "2 min ago".
  it('says how long ago data was updated', () => {
    const en = i18n.getFixedT('en');
    const ru = i18n.getFixedT('ru');
    expect(en('common.updatedAgo', { minutes: 0 })).toBe('Updated just now');
    expect(en('common.updatedAgo', { minutes: 2 })).toBe('Updated 2\u00A0min\u00A0ago');
    expect(ru('common.updatedAgo', { minutes: 0 })).toBe('Обновлено только что');
    expect(ru('common.updatedHoursAgo', { hours: 3 })).toBe('Обновлено 3\u00A0ч\u00A0назад');
    expect(en('common.updatedDaysAgo', { days: 1 })).toBe('Updated 1\u00A0day\u00A0ago');
    expect(ru('common.updatedDaysAgo', { days: 2 })).toBe('Обновлено 2\u00A0дня\u00A0назад');
    expect(ru('common.updatedDaysAgo', { days: 5 })).toBe('Обновлено 5\u00A0дней\u00A0назад');
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
