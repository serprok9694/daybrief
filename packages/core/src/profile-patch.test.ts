import { describe, expect, it } from 'vitest';
import { isTimeZone, parseProfilePatch } from './profile-patch';

describe('parseProfilePatch', () => {
  it('accepts each settings field', () => {
    expect(parseProfilePatch({ locale: 'ru' })).toEqual({ locale: 'ru' });
    expect(parseProfilePatch({ locale: null })).toEqual({ locale: null });
    expect(parseProfilePatch({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(parseProfilePatch({ scene: 'night' })).toEqual({ scene: 'night' });
    expect(parseProfilePatch({ timezone: 'Europe/Berlin' })).toEqual({
      timezone: 'Europe/Berlin',
    });
  });

  it('accepts several fields at once', () => {
    expect(parseProfilePatch({ theme: 'light', scene: 'auto' })).toEqual({
      theme: 'light',
      scene: 'auto',
    });
  });

  it.each([
    null,
    undefined,
    'dark',
    [],
    {},
    { theme: 'sepia' },
    { locale: 'de' },
    { scene: null },
    { theme: null },
    { timezone: null },
    { timezone: 'Mars/Olympus' },
    { timezone: 42 },
    { displayName: 'Mallory' },
    { userId: 'other-user' },
    { theme: 'dark', isAdmin: true },
  ])('rejects %j', (value) => {
    expect(parseProfilePatch(value)).toBeNull();
  });
});

describe('isTimeZone', () => {
  it('knows IANA zones', () => {
    expect(isTimeZone('Europe/Moscow')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('')).toBe(false);
    expect(isTimeZone('Not/AZone')).toBe(false);
  });
});
