import { describe, expect, it } from 'vitest';
import { profileLanguage } from './profile-language';

describe('profileLanguage', () => {
  it('uses the saved locale', () => {
    expect(profileLanguage('ru', ['en-US'])).toBe('ru');
    expect(profileLanguage('en', ['ru-RU'])).toBe('en');
  });

  it('follows the system while the locale is not set', () => {
    expect(profileLanguage(null, ['ru-RU', 'en'])).toBe('ru');
    expect(profileLanguage(null, ['de-DE'])).toBe('en');
  });
});
