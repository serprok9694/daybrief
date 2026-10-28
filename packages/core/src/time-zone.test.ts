import { describe, expect, it } from 'vitest';
import { dayRange, todayRange, wallClock, zonedTimeToInstant } from './time-zone';

const WARSAW = 'Europe/Warsaw';
const utc = (iso: string) => new Date(iso);
const hours = (range: { start: string; end: string }) =>
  (Date.parse(range.end) - Date.parse(range.start)) / 3_600_000;

// 2026 in Europe/Warsaw: CET (+01) → CEST (+02) on 29 March at 02:00,
// back to CET on 25 October at 03:00.

describe('todayRange', () => {
  it('Europe/Warsaw in winter time', () => {
    expect(todayRange(WARSAW, utc('2026-10-28T12:00:00Z'))).toEqual({
      start: '2026-10-27T23:00:00.000Z',
      end: '2026-10-28T23:00:00.000Z',
    });
  });

  it('Europe/Warsaw in summer time', () => {
    expect(todayRange(WARSAW, utc('2026-07-01T10:00:00Z'))).toEqual({
      start: '2026-06-30T22:00:00.000Z',
      end: '2026-07-01T22:00:00.000Z',
    });
  });

  it('UTC', () => {
    expect(todayRange('UTC', utc('2026-10-28T23:30:00Z'))).toEqual({
      start: '2026-10-28T00:00:00.000Z',
      end: '2026-10-29T00:00:00.000Z',
    });
  });

  it('uses the local date, not the UTC one', () => {
    // 23:30 UTC is already 00:30 on the 29th in Warsaw.
    expect(todayRange(WARSAW, utc('2026-10-28T23:30:00Z')).start).toBe('2026-10-28T23:00:00.000Z');
  });

  it('spring forward: the day is 23 hours long', () => {
    const range = todayRange(WARSAW, utc('2026-03-29T10:00:00Z'));
    expect(range).toEqual({ start: '2026-03-28T23:00:00.000Z', end: '2026-03-29T22:00:00.000Z' });
    expect(hours(range)).toBe(23);
  });

  it('fall back: the day is 25 hours long', () => {
    const range = todayRange(WARSAW, utc('2026-10-25T10:00:00Z'));
    expect(range).toEqual({ start: '2026-10-24T22:00:00.000Z', end: '2026-10-25T23:00:00.000Z' });
    expect(hours(range)).toBe(25);
  });

  it('throws on an unknown time zone', () => {
    expect(() => todayRange('Mars/Olympus', utc('2026-10-28T12:00:00Z'))).toThrow(RangeError);
  });
});

describe('dayRange', () => {
  it('yesterday and tomorrow around the autumn change', () => {
    const now = utc('2026-10-25T10:00:00Z');
    expect(dayRange(WARSAW, now, -1)).toEqual({
      start: '2026-10-23T22:00:00.000Z',
      end: '2026-10-24T22:00:00.000Z',
    });
    expect(dayRange(WARSAW, now, 1)).toEqual({
      start: '2026-10-25T23:00:00.000Z',
      end: '2026-10-26T23:00:00.000Z',
    });
  });

  it('crosses month and year boundaries', () => {
    expect(dayRange('UTC', utc('2026-12-31T12:00:00Z'), 1)).toEqual({
      start: '2027-01-01T00:00:00.000Z',
      end: '2027-01-02T00:00:00.000Z',
    });
  });
});

describe('zonedTimeToInstant', () => {
  it('skipped time moves forward by the gap', () => {
    // 02:30 doesn't exist on 29 March; 01:30Z reads 03:30 CEST.
    const t = zonedTimeToInstant({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, WARSAW);
    expect(t.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('ambiguous time picks the earlier instant', () => {
    // 02:30 happens twice on 25 October: first in CEST (+02).
    const t = zonedTimeToInstant({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, WARSAW);
    expect(t.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('round-trips with wallClock', () => {
    const t = utc('2026-10-28T08:15:00Z');
    expect(wallClock(t, WARSAW)).toEqual({
      year: 2026,
      month: 10,
      day: 28,
      hour: 9,
      minute: 15,
      second: 0,
    });
    expect(zonedTimeToInstant(wallClock(t, WARSAW), WARSAW)).toEqual(t);
  });

  it('midnight is hour 0', () => {
    expect(wallClock(utc('2026-10-28T23:00:00Z'), WARSAW).hour).toBe(0);
  });
});
