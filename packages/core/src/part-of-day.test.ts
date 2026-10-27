import { describe, expect, it } from 'vitest';
import { partOfDay } from './part-of-day';

const at = (hour: number, minute = 0) => new Date(2026, 9, 27, hour, minute);

describe('partOfDay', () => {
  it.each([
    [5, 'morning'],
    [10, 'morning'],
    [11, 'day'],
    [16, 'day'],
    [17, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [0, 'night'],
    [4, 'night'],
  ] as const)('%i:00 is %s', (hour, expected) => {
    expect(partOfDay(at(hour))).toBe(expected);
  });

  it('switches exactly on the boundary minute', () => {
    expect(partOfDay(at(10, 59))).toBe('morning');
    expect(partOfDay(at(4, 59))).toBe('night');
  });
});
