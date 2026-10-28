import { describe, expect, it } from 'vitest';
import { avatarUrl, displayName, firstName, formatToday, greetingKey, gridColumns } from './format';

describe('greetingKey', () => {
  it('maps each part of day to its greeting', () => {
    expect(greetingKey('morning')).toBe('greeting.morning');
    expect(greetingKey('day')).toBe('greeting.day');
    expect(greetingKey('evening')).toBe('greeting.evening');
    expect(greetingKey('night')).toBe('greeting.night');
  });
});

describe('formatToday', () => {
  const date = new Date(2026, 9, 27, 9, 0);

  it('formats in English', () => {
    expect(formatToday(date, 'en')).toBe('Tuesday, October 27');
  });

  it('formats in Russian with the genitive month', () => {
    expect(formatToday(date, 'ru')).toBe('вторник, 27 октября');
  });
});

describe('displayName', () => {
  it('prefers the profile name', () => {
    expect(displayName('Sergei', { full_name: 'Sergei Prokofiev' }, 's@example.com')).toBe(
      'Sergei',
    );
  });

  it('falls back to the Google name, then the email', () => {
    expect(displayName(null, { full_name: 'Anna Kowalska' }, 'a@example.com')).toBe(
      'Anna Kowalska',
    );
    expect(displayName('  ', { name: 'Anna' }, 'a@example.com')).toBe('Anna');
    expect(displayName(null, {}, 'marek.nowak@example.com')).toBe('marek.nowak');
    expect(displayName(null, undefined, undefined)).toBe('');
  });

  it('ignores non-string metadata', () => {
    expect(displayName(null, { full_name: 42 }, 'x@example.com')).toBe('x');
  });
});

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('Sergei Prokofiev')).toBe('Sergei');
    expect(firstName('  Сергей  ')).toBe('Сергей');
    expect(firstName('')).toBe('');
  });
});

describe('avatarUrl', () => {
  it('reads avatar_url or picture', () => {
    expect(avatarUrl({ avatar_url: 'https://lh3.googleusercontent.com/a/x' })).toBe(
      'https://lh3.googleusercontent.com/a/x',
    );
    expect(avatarUrl({ picture: 'https://lh3.googleusercontent.com/a/y' })).toBe(
      'https://lh3.googleusercontent.com/a/y',
    );
  });

  it('returns undefined without an https photo', () => {
    expect(avatarUrl(undefined)).toBeUndefined();
    expect(avatarUrl({ avatar_url: '' })).toBeUndefined();
    expect(avatarUrl({ avatar_url: 'javascript:alert(1)' })).toBeUndefined();
  });
});

describe('gridColumns', () => {
  it('fits three columns on the desktop sheet', () => {
    // 1440 page − 2 × 40 padding − 2 × 44 sheet padding − 2 × 1 border.
    const { columns, itemWidth } = gridColumns(1270, 340, 20);
    expect(columns).toBe(3);
    expect(itemWidth).toBeCloseTo((1270 - 40) / 3);
  });

  it('drops to two columns, then one', () => {
    expect(gridColumns(900, 340, 20).columns).toBe(2);
    expect(gridColumns(699, 340, 20).columns).toBe(1);
  });

  it('keeps one full-width column when narrower than the minimum', () => {
    expect(gridColumns(332, 340, 14)).toEqual({ columns: 1, itemWidth: 332 });
  });

  it('handles an unmeasured container', () => {
    expect(gridColumns(0, 340, 20)).toEqual({ columns: 1, itemWidth: 0 });
  });
});
