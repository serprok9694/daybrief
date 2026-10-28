import type { CalendarEvent } from '@daybrief/core';
import { describe, expect, it } from 'vitest';
import { eventFromRow, eventToRow } from './events';

const timed: CalendarEvent = {
  id: 'e1',
  calendarId: 'primary',
  title: 'Standup',
  allDay: false,
  start: '2026-10-28T08:00:00.000Z',
  end: '2026-10-28T08:15:00.000Z',
  videoUrl: 'https://meet.google.com/abc',
  htmlLink: 'https://calendar.google.com/e1',
};
const allDay: CalendarEvent = {
  id: 'e2',
  calendarId: 'primary',
  title: 'Trip',
  allDay: true,
  start: '2026-10-28',
  end: '2026-10-30',
  videoUrl: null,
  htmlLink: null,
};

describe('calendar event rows', () => {
  it('store timed events as instants and all-day events as dates', () => {
    expect(eventToRow(timed)).toMatchObject({
      start_at: timed.start,
      end_at: timed.end,
      start_date: null,
      end_date: null,
    });
    expect(eventToRow(allDay)).toMatchObject({
      start_at: null,
      end_at: null,
      start_date: '2026-10-28',
      end_date: '2026-10-30',
    });
  });

  it('round-trip, normalising PostgREST offsets to Z', () => {
    expect(eventFromRow(eventToRow(allDay))).toEqual(allDay);
    expect(
      eventFromRow({
        ...eventToRow(timed),
        start_at: '2026-10-28T08:00:00+00:00',
        end_at: '2026-10-28T08:15:00+00:00',
      }),
    ).toEqual(timed);
  });
});
