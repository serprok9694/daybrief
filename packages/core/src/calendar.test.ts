import { describe, expect, it } from 'vitest';
import { freeWindows, nextEvent, type CalendarEvent } from './calendar';

const WARSAW = 'Europe/Warsaw';
const utc = (iso: string) => new Date(iso);

let seq = 0;
const timed = (start: string, end: string): CalendarEvent => ({
  id: `e${++seq}`,
  calendarId: 'primary',
  title: 'Event',
  allDay: false,
  start,
  end,
  videoUrl: null,
  htmlLink: null,
});
const allDay = (start: string, end: string): CalendarEvent => ({
  ...timed(start, end),
  allDay: true,
});
const window = (start: string, end: string) => ({ start, end });

// 28 October 2026 in Warsaw is CET (+01): 09:00 local = 08:00Z, 21:00 local = 20:00Z.
const DAY = [
  timed('2026-10-28T09:00:00.000Z', '2026-10-28T10:00:00.000Z'), // 10:00–11:00
  timed('2026-10-28T10:30:00.000Z', '2026-10-28T11:00:00.000Z'), // 11:30–12:00
  timed('2026-10-28T13:00:00.000Z', '2026-10-28T15:00:00.000Z'), // 14:00–16:00
];

describe('freeWindows', () => {
  it('whole working day when there are no events', () => {
    expect(freeWindows([], utc('2026-10-28T06:00:00Z'), WARSAW)).toEqual([
      window('2026-10-28T08:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
  });

  it('keeps gaps of an hour or more, drops shorter ones', () => {
    expect(freeWindows(DAY, utc('2026-10-28T06:00:00Z'), WARSAW)).toEqual([
      window('2026-10-28T08:00:00.000Z', '2026-10-28T09:00:00.000Z'), // exactly 1 h
      // 11:00–11:30 is too short
      window('2026-10-28T11:00:00.000Z', '2026-10-28T13:00:00.000Z'),
      window('2026-10-28T15:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
  });

  it('"now" inside an event: starts when the event ends', () => {
    expect(freeWindows(DAY, utc('2026-10-28T13:30:00Z'), WARSAW)).toEqual([
      window('2026-10-28T15:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
  });

  it('"now" in a gap: the window starts now and must still be an hour long', () => {
    expect(freeWindows(DAY, utc('2026-10-28T11:45:00Z'), WARSAW)).toEqual([
      window('2026-10-28T11:45:00.000Z', '2026-10-28T13:00:00.000Z'),
      window('2026-10-28T15:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
    expect(freeWindows(DAY, utc('2026-10-28T12:15:00Z'), WARSAW)).toEqual([
      window('2026-10-28T15:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
  });

  it('"now" after 21:00: nothing left', () => {
    expect(freeWindows([], utc('2026-10-28T20:30:00Z'), WARSAW)).toEqual([]);
  });

  it('less than an hour before 21:00: nothing left', () => {
    expect(freeWindows([], utc('2026-10-28T19:30:00Z'), WARSAW)).toEqual([]);
  });

  it('merges overlapping events and clips to working hours', () => {
    const events = [
      // From last night (23:00) until 10:00: crosses midnight into today.
      timed('2026-10-27T22:00:00.000Z', '2026-10-28T09:00:00.000Z'),
      timed('2026-10-28T12:00:00.000Z', '2026-10-28T14:00:00.000Z'),
      timed('2026-10-28T13:00:00.000Z', '2026-10-28T13:30:00.000Z'), // inside the previous one
      timed('2026-10-28T13:45:00.000Z', '2026-10-28T15:00:00.000Z'), // overlaps it
      timed('2026-10-28T19:30:00.000Z', '2026-10-28T23:00:00.000Z'), // runs past 21:00
    ];
    expect(freeWindows(events, utc('2026-10-28T06:00:00Z'), WARSAW)).toEqual([
      window('2026-10-28T09:00:00.000Z', '2026-10-28T12:00:00.000Z'),
      window('2026-10-28T15:00:00.000Z', '2026-10-28T19:30:00.000Z'),
    ]);
  });

  it('all-day events do not block time', () => {
    const events = [allDay('2026-10-28', '2026-10-29')];
    expect(freeWindows(events, utc('2026-10-28T06:00:00Z'), WARSAW)).toEqual([
      window('2026-10-28T08:00:00.000Z', '2026-10-28T20:00:00.000Z'),
    ]);
  });

  it('UTC', () => {
    const events = [timed('2026-10-28T12:00:00.000Z', '2026-10-28T13:00:00.000Z')];
    expect(freeWindows(events, utc('2026-10-28T08:00:00Z'), 'UTC')).toEqual([
      window('2026-10-28T09:00:00.000Z', '2026-10-28T12:00:00.000Z'),
      window('2026-10-28T13:00:00.000Z', '2026-10-28T21:00:00.000Z'),
    ]);
  });

  it('spring forward day: bounds follow the new offset (CEST, +02)', () => {
    expect(freeWindows([], utc('2026-03-29T05:00:00Z'), WARSAW)).toEqual([
      window('2026-03-29T07:00:00.000Z', '2026-03-29T19:00:00.000Z'),
    ]);
  });

  it('fall back day: bounds follow the new offset (CET, +01)', () => {
    expect(freeWindows([], utc('2026-10-25T05:00:00Z'), WARSAW)).toEqual([
      window('2026-10-25T08:00:00.000Z', '2026-10-25T20:00:00.000Z'),
    ]);
  });
});

describe('nextEvent', () => {
  const now = utc('2026-10-28T11:30:00Z');

  it('first timed event that starts after now, whatever the input order', () => {
    const later = timed('2026-10-28T15:00:00.000Z', '2026-10-28T16:00:00.000Z');
    const sooner = timed('2026-10-28T13:00:00.000Z', '2026-10-28T14:00:00.000Z');
    const past = timed('2026-10-28T09:00:00.000Z', '2026-10-28T10:00:00.000Z');
    const ongoing = timed('2026-10-28T11:00:00.000Z', '2026-10-28T12:00:00.000Z');
    const wholeDay = allDay('2026-10-29', '2026-10-30');
    expect(nextEvent([later, past, wholeDay, ongoing, sooner], now)).toBe(sooner);
  });

  it('null when nothing is left', () => {
    expect(
      nextEvent([timed('2026-10-28T09:00:00.000Z', '2026-10-28T10:00:00.000Z')], now),
    ).toBeNull();
    expect(nextEvent([], now)).toBeNull();
  });
});
