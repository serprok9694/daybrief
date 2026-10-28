import { zonedTimeToInstant, wallClock, type TimeRange } from './time-zone';

type CalendarEventBase = {
  /** Google event id, unique within the calendar (recurring instances have their own). */
  id: string;
  calendarId: string;
  /** Empty when the event has no title; the UI shows a placeholder. */
  title: string;
  /** Meet / Zoom / Teams link, see M1 decisions ("Ссылки"). */
  videoUrl: string | null;
  /** The event in the Google Calendar web UI. */
  htmlLink: string | null;
};

/** Event with a start and end time; `start`/`end` are RFC 3339 UTC instants. */
export type TimedCalendarEvent = CalendarEventBase & { allDay: false; start: string; end: string };

/** All-day event; `start`/`end` are `YYYY-MM-DD` dates, `end` exclusive (as in Google). */
export type AllDayCalendarEvent = CalendarEventBase & { allDay: true; start: string; end: string };

/**
 * A calendar event as the dashboard shows it. Only what the widget needs: no
 * descriptions, attendees or attachments (PRD 6.4).
 */
export type CalendarEvent = TimedCalendarEvent | AllDayCalendarEvent;

/** What `GET /events/today` returns. */
export type TodayEvents = {
  events: CalendarEvent[];
  /** When the last successful sync finished (RFC 3339), null if never. */
  syncedAt: string | null;
  /** Error of the last sync attempt, null if it succeeded. */
  error: string | null;
};

/** Working hours that free windows are looked for in, local time. */
export const WORKDAY_START_HOUR = 9;
export const WORKDAY_END_HOUR = 21;
/** Shortest gap that counts as a free window. */
export const MIN_FREE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Gaps of at least an hour between timed events within today's 09:00–21:00 in
 * `timeZone`, starting no earlier than `now`. All-day events don't block time.
 */
export function freeWindows(events: CalendarEvent[], now: Date, timeZone: string): TimeRange[] {
  const today = wallClock(now, timeZone);
  const at = (hour: number) =>
    zonedTimeToInstant(
      { year: today.year, month: today.month, day: today.day, hour, minute: 0 },
      timeZone,
    ).getTime();
  const dayEnd = at(WORKDAY_END_HOUR);
  let cursor = Math.max(at(WORKDAY_START_HOUR), now.getTime());

  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => [Date.parse(e.start), Date.parse(e.end)] as const)
    .filter(([start, end]) => end > cursor && start < dayEnd)
    .sort((a, b) => a[0] - b[0]);

  const windows: TimeRange[] = [];
  const push = (start: number, end: number) => {
    if (end - start >= MIN_FREE_WINDOW_MS) {
      windows.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
  };
  for (const [start, end] of busy) {
    if (start > cursor) push(cursor, Math.min(start, dayEnd));
    cursor = Math.max(cursor, end);
    if (cursor >= dayEnd) return windows;
  }
  push(cursor, dayEnd);
  return windows;
}

/** The first timed event that starts after `now` (ties keep input order). */
export function nextEvent(events: CalendarEvent[], now: Date): TimedCalendarEvent | null {
  let next: TimedCalendarEvent | null = null;
  for (const e of events) {
    if (e.allDay || Date.parse(e.start) <= now.getTime()) continue;
    if (!next || Date.parse(e.start) < Date.parse(next.start)) next = e;
  }
  return next;
}
