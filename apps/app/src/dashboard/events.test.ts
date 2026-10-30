import type { AllDayCalendarEvent, CalendarEvent, TimedCalendarEvent } from '@daybrief/core';
import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  duration,
  eventsState,
  formatTime,
  isStale,
  msToNextMinute,
  startsIn,
  updatedAgo,
  videoService,
  type TimelineRow,
} from './events';

const tz = 'Europe/Warsaw';
// 2026-10-30 is CET (UTC+1): 09:00 local = 08:00Z.
const at = (hhmm: string) => new Date(`2026-10-30T${hhmm}:00+01:00`);

const timed = (id: string, from: string, to: string): TimedCalendarEvent => ({
  id,
  calendarId: 'primary',
  title: id,
  videoUrl: null,
  htmlLink: null,
  allDay: false,
  start: at(from).toISOString(),
  end: at(to).toISOString(),
});

const allDay = (id: string): AllDayCalendarEvent => ({
  id,
  calendarId: 'primary',
  title: id,
  videoUrl: null,
  htmlLink: null,
  allDay: true,
  start: '2026-10-30',
  end: '2026-10-31',
});

/** Rows as short strings: "a", "a*" (next), "a." (last), "free 14:00-16:00", "allDay x". */
function shape(rows: TimelineRow[]): string[] {
  const hm = (iso: string) => formatTime(iso, 'en', tz);
  return rows.map((r) => {
    if (r.kind === 'free') return `free ${hm(r.start)}-${hm(r.end)}`;
    if (r.kind === 'allDay') return `allDay ${r.event.id}`;
    return `${r.event.id}${r.next ? '*' : ''}${r.last ? '.' : ''}`;
  });
}

describe('buildTimeline', () => {
  const day: CalendarEvent[] = [
    timed('review', '10:00', '11:00'),
    timed('lunch', '12:30', '13:30'),
    timed('sprint', '16:00', '17:30'),
    timed('one-on-one', '17:30', '18:00'),
  ];

  it('marks the next event and puts free windows between events', () => {
    const { rows, hidden } = buildTimeline(day, at('09:42'), tz);
    expect(shape(rows)).toEqual([
      'review*',
      'free 11:00-12:30',
      'lunch',
      'free 13:30-16:00',
      'sprint',
      'one-on-one.',
      'free 18:00-21:00',
    ]);
    expect(hidden).toBe(0);
  });

  it('starts free windows no earlier than now', () => {
    const { rows } = buildTimeline(day, at('14:30'), tz);
    expect(shape(rows)).toEqual([
      'review',
      'lunch',
      'free 14:30-16:00',
      'sprint*',
      'one-on-one.',
      'free 18:00-21:00',
    ]);
  });

  it('sorts timed events by start', () => {
    const { rows } = buildTimeline([...day].reverse(), at('08:00'), tz);
    expect(shape(rows).filter((r) => !r.startsWith('free'))).toEqual([
      'review*',
      'lunch',
      'sprint',
      'one-on-one.',
    ]);
  });

  it('shows all-day events on top', () => {
    const { rows } = buildTimeline(
      [timed('review', '10:00', '11:00'), allDay('birthday')],
      at('09:00'),
      tz,
    );
    expect(shape(rows)).toEqual([
      'allDay birthday',
      'free 09:00-10:00',
      'review*.',
      'free 11:00-21:00',
    ]);
  });

  it('has no next event once the last one has started', () => {
    const { rows } = buildTimeline(day, at('17:45'), tz);
    expect(rows.some((r) => r.kind === 'event' && r.next)).toBe(false);
  });

  const many: CalendarEvent[] = [
    timed('e1', '08:00', '08:30'),
    timed('e2', '09:00', '09:30'),
    timed('e3', '10:00', '10:30'),
    timed('e4', '11:00', '11:30'),
    timed('e5', '12:00', '12:30'),
    timed('e6', '13:00', '13:30'),
    timed('e7', '14:00', '14:30'),
  ];

  it('collapses to five events behind "Show N more"', () => {
    const { rows, hidden } = buildTimeline(many, at('07:00'), tz);
    expect(shape(rows)).toEqual(['e1*', 'e2', 'e3', 'e4', 'e5.']);
    expect(hidden).toBe(2);
  });

  it('drops ended events first so the next one stays in view', () => {
    const { rows, hidden } = buildTimeline(many, at('13:10'), tz);
    expect(shape(rows)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7*.', 'free 14:30-21:00']);
    expect(hidden).toBe(2);
  });

  it('counts all-day events in the five', () => {
    const { rows, hidden } = buildTimeline([allDay('a'), allDay('b'), ...many], at('07:00'), tz);
    expect(shape(rows)).toEqual(['allDay a', 'allDay b', 'e1*', 'e2', 'e3.']);
    expect(hidden).toBe(4);
  });

  it('shows everything when expanded', () => {
    const { rows, hidden } = buildTimeline(many, at('13:10'), tz, true);
    expect(shape(rows)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7*.', 'free 14:30-21:00']);
    expect(hidden).toBe(0);
  });

  it('keeps free windows before the last shown event when more are hidden', () => {
    const events = [
      timed('e1', '09:00', '09:30'),
      timed('e2', '09:30', '10:00'),
      timed('e3', '10:00', '10:30'),
      timed('e4', '10:30', '11:00'),
      timed('e5', '12:00', '12:30'),
      timed('e6', '15:00', '15:30'),
    ];
    const { rows, hidden } = buildTimeline(events, at('08:00'), tz);
    expect(shape(rows)).toEqual(['e1*', 'e2', 'e3', 'e4', 'free 11:00-12:00', 'e5.']);
    expect(hidden).toBe(1);
  });

  it('gives a whole free day when there are only all-day events', () => {
    const { rows } = buildTimeline([allDay('holiday')], at('08:00'), tz);
    expect(shape(rows)).toEqual(['allDay holiday', 'free 09:00-21:00']);
  });
});

describe('duration', () => {
  it('splits into hours and minutes', () => {
    expect(duration(timed('a', '10:00', '11:00'))).toEqual({ hours: 1, minutes: 0 });
    expect(duration(timed('a', '16:00', '17:30'))).toEqual({ hours: 1, minutes: 30 });
    expect(duration(timed('a', '17:30', '18:00'))).toEqual({ hours: 0, minutes: 30 });
  });
});

describe('startsIn', () => {
  it('rounds up to the minute', () => {
    expect(startsIn(at('10:00').toISOString(), at('09:42'))).toEqual({ hours: 0, minutes: 18 });
    expect(startsIn(at('10:00').toISOString(), new Date(at('10:00').getTime() - 20_000))).toEqual({
      hours: 0,
      minutes: 1,
    });
  });

  it('switches to hours past 60 minutes', () => {
    expect(startsIn(at('11:15').toISOString(), at('10:00'))).toEqual({ hours: 1, minutes: 15 });
  });
});

describe('updatedAgo', () => {
  const now = at('12:00');
  it('is null before the first sync', () => {
    expect(updatedAgo(null, now)).toBeNull();
  });
  it('counts minutes, then hours, then days', () => {
    expect(updatedAgo(at('11:58').toISOString(), now)).toEqual({ unit: 'minutes', minutes: 2 });
    expect(updatedAgo(at('12:00').toISOString(), now)).toEqual({ unit: 'minutes', minutes: 0 });
    expect(updatedAgo(at('09:30').toISOString(), now)).toEqual({ unit: 'hours', hours: 2 });
    expect(updatedAgo('2026-10-27T10:00:00Z', now)).toEqual({ unit: 'days', days: 3 });
  });
  it('treats a clock slightly behind the server as just now', () => {
    expect(updatedAgo(at('12:01').toISOString(), now)).toEqual({ unit: 'minutes', minutes: 0 });
  });
});

describe('isStale', () => {
  it('is stale after five minutes', () => {
    expect(isStale(0, 5 * 60_000)).toBe(false);
    expect(isStale(0, 5 * 60_000 + 1)).toBe(true);
  });
});

describe('msToNextMinute', () => {
  it('waits for the next minute boundary', () => {
    expect(msToNextMinute(at('10:00').getTime() + 15_000)).toBe(45_000);
    expect(msToNextMinute(at('10:00').getTime())).toBe(60_000);
  });
});

describe('eventsState', () => {
  const cached = { events: [timed('a', '10:00', '11:00')], syncedAt: null, error: null };
  const empty = { events: [], syncedAt: null, error: null };

  it('asks to reconnect when the connection is revoked or missing', () => {
    for (const s of ['revoked', 'none', 'not_connected'] as const) {
      expect(eventsState(cached, s)).toEqual({ status: 'reconnect' });
    }
  });

  it('keeps cached events when the connection is failing', () => {
    expect(eventsState(cached, 'error')).toEqual({
      status: 'ready',
      data: cached,
      syncFailed: true,
    });
  });

  it('shows the error state when the connection is failing and nothing is cached', () => {
    expect(eventsState(empty, 'error')).toEqual({ status: 'error' });
  });

  it('shows the events otherwise, also without a known status', () => {
    for (const s of ['active', 'synced', 'throttled', null] as const) {
      expect(eventsState(cached, s)).toEqual({ status: 'ready', data: cached, syncFailed: false });
    }
    expect(eventsState(empty, 'active')).toEqual({
      status: 'ready',
      data: empty,
      syncFailed: false,
    });
  });
});

describe('formatTime', () => {
  it('uses 24-hour time in the given zone', () => {
    expect(formatTime('2026-10-30T13:05:00Z', 'en', tz)).toBe('14:05');
    expect(formatTime('2026-10-30T08:00:00Z', 'ru', tz)).toBe('09:00');
    expect(formatTime('2026-10-30T08:00:00Z', 'en', 'UTC')).toBe('08:00');
  });
});

describe('videoService', () => {
  it('names Meet, Zoom and Teams links', () => {
    expect(videoService('https://meet.google.com/abc-defg-hij')).toBe('Meet');
    expect(videoService('https://us02web.zoom.us/j/123')).toBe('Zoom');
    expect(videoService('https://teams.microsoft.com/l/meetup-join/x')).toBe('Teams');
  });
  it('is null for other or broken links', () => {
    expect(videoService('https://whereby.com/room')).toBeNull();
    expect(videoService('https://notzoom.us/j/1')).toBeNull();
    expect(videoService('not a url')).toBeNull();
  });
});
