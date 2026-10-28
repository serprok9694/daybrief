import { todayRange, wallClock, type CalendarEvent, type Tables } from '@daybrief/core';

export type CalendarEventRow = Omit<Tables<'calendar_events'>, 'user_id' | 'synced_at'>;

export const CALENDAR_EVENT_COLUMNS =
  'calendar_id, event_id, title, all_day, start_at, end_at, start_date, end_date, video_url, html_link' as const;

/** The row `save_calendar_sync` inserts for an event. */
export function eventToRow(event: CalendarEvent): CalendarEventRow {
  return {
    calendar_id: event.calendarId,
    event_id: event.id,
    title: event.title,
    all_day: event.allDay,
    start_at: event.allDay ? null : event.start,
    end_at: event.allDay ? null : event.end,
    start_date: event.allDay ? event.start : null,
    end_date: event.allDay ? event.end : null,
    video_url: event.videoUrl,
    html_link: event.htmlLink,
  };
}

export function eventFromRow(row: CalendarEventRow): CalendarEvent {
  const base = {
    id: row.event_id,
    calendarId: row.calendar_id,
    title: row.title,
    videoUrl: row.video_url,
    htmlLink: row.html_link,
  };
  // The calendar_events_time_shape check guarantees which pair is set.
  if (row.all_day) return { ...base, allDay: true, start: row.start_date!, end: row.end_date! };
  return {
    ...base,
    allDay: false,
    // PostgREST returns `+00:00` offsets; the API speaks `Z`.
    start: new Date(row.start_at!).toISOString(),
    end: new Date(row.end_at!).toISOString(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Events that overlap today in `timeZone`: all-day events first (by title), then timed
 * events by start. All-day dates are compared as local dates, not instants.
 */
export function eventsForToday(
  events: CalendarEvent[],
  timeZone: string,
  now: Date,
): CalendarEvent[] {
  const range = todayRange(timeZone, now);
  const { year, month, day } = wallClock(now, timeZone);
  const today = `${year}-${pad(month)}-${pad(day)}`;
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  return events
    .filter((e) =>
      e.allDay
        ? e.start <= today && today < e.end
        : Date.parse(e.start) < end && Date.parse(e.end) > start,
    )
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.allDay) return a.title.localeCompare(b.title);
      return Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title);
    });
}
