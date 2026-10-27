import { describe, expect, it } from 'vitest';
import { avatarTone, initials } from './initials';

describe('initials', () => {
  it.each([
    ['Anna Kowalska', 'AK'],
    ['Anna Maria Kowalska', 'AK'],
    ['Vera', 'V'],
    ['  sergei  ', 'S'],
    ['Анна Тихонова', 'АТ'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('avatarTone', () => {
  it('is stable for a name and within 1..4', () => {
    for (const name of ['Anna Kowalska', 'Vera', 'Max', 'Анна']) {
      const tone = avatarTone(name);
      expect(tone).toBe(avatarTone(name));
      expect([1, 2, 3, 4]).toContain(tone);
    }
  });
});
