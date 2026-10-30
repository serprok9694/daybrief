// Pure logic of the events widget: which rows to show, and the numbers behind its labels.
import {
  freeWindows,
  nextEvent,
  type AllDayCalendarEvent,
  type CalendarEvent,
  type GoogleConnectionStatus,
  type TimedCalendarEvent,
  type TodayEvents,
} from '@daybrief/core';

/** Events shown before "Show N more". */
export const VISIBLE_EVENTS = 5;
/** Data older than this is re-read when the tab becomes visible again. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

export type TimelineRow =
  | { kind: 'allDay'; event: AllDayCalendarEvent }
  | { kind: 'event'; event: TimedCalendarEvent; next: boolean; last: boolean }
  | { kind: 'free'; start: string; end: string };

export interface Timeline {
  rows: TimelineRow[];
  /** Events behind "Show N more"; 0 when expanded or when everything fits. */
  hidden: number;
}

const ended = (e: TimedCalendarEvent, now: Date) => Date.parse(e.end) <= now.getTime();

/**
 * Rows of the widget: all-day events on top, then timed events by start with free windows
 * (≥ 1 h, see `freeWindows`) between them, the next event marked. Collapsed, at most
 * `VISIBLE_EVENTS` events are shown; events that have already ended give way first, so
 * the next one stays in view.
 */
export function buildTimeline(
  events: CalendarEvent[],
  now: Date,
  timeZone: string,
  expanded = false,
): Timeline {
  const allDay = events.filter((e): e is AllDayCalendarEvent => e.allDay);
  const timed = events
    .filter((e): e is TimedCalendarEvent => !e.allDay)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  let shownTimed = timed;
  let shownAllDay = allDay;
  if (!expanded) {
    let skip = 0;
    while (
      allDay.length + timed.length - skip > VISIBLE_EVENTS &&
      skip < timed.length &&
      ended(timed[skip]!, now)
    ) {
      skip++;
    }
    shownAllDay = allDay.slice(0, VISIBLE_EVENTS);
    shownTimed = timed.slice(skip, skip + VISIBLE_EVENTS - shownAllDay.length);
  }
  const hidden = allDay.length + timed.length - shownAllDay.length - shownTimed.length;

  const next = nextEvent(timed, now);
  const lastShown = shownTimed.at(-1);
  // Past the last shown event, windows are only shown when no event hides after it.
  const moreAfter = lastShown !== undefined && lastShown !== timed.at(-1);
  const windows = freeWindows(events, now, timeZone).filter(
    (w) => !moreAfter || Date.parse(w.end) <= Date.parse(lastShown.start),
  );

  const rows: TimelineRow[] = shownAllDay.map((event) => ({ kind: 'allDay', event }));
  let w = 0;
  for (const event of shownTimed) {
    while (w < windows.length && Date.parse(windows[w]!.end) <= Date.parse(event.start)) {
      rows.push({ kind: 'free', ...windows[w++]! });
    }
    rows.push({ kind: 'event', event, next: event === next, last: event === lastShown });
  }
  for (; w < windows.length; w++) rows.push({ kind: 'free', ...windows[w]! });
  return { rows, hidden };
}

/** Length of a timed event in whole hours and the remaining minutes. */
export function duration(event: TimedCalendarEvent): { hours: number; minutes: number } {
  const total = Math.max(
    0,
    Math.round((Date.parse(event.end) - Date.parse(event.start)) / MINUTE_MS),
  );
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/**
 * Time until `start` for the "in N min" chip, rounded up to the minute so an event that
 * starts in 20 s still reads "in 1 min".
 */
export function startsIn(start: string, now: Date): { hours: number; minutes: number } {
  const total = Math.max(0, Math.ceil((Date.parse(start) - now.getTime()) / MINUTE_MS));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export type UpdatedAgo =
  | { unit: 'minutes'; minutes: number }
  | { unit: 'hours'; hours: number }
  | { unit: 'days'; days: number };

/** "Updated N min ago" from `syncedAt`; minutes under an hour, hours under a day, then days. */
export function updatedAgo(syncedAt: string | null, now: Date): UpdatedAgo | null {
  if (!syncedAt) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(syncedAt)) / MINUTE_MS));
  if (minutes < 60) return { unit: 'minutes', minutes };
  if (minutes < 24 * 60) return { unit: 'hours', hours: Math.floor(minutes / 60) };
  return { unit: 'days', days: Math.floor(minutes / (24 * 60)) };
}

export function isStale(loadedAt: number, now: number): boolean {
  return now - loadedAt > STALE_AFTER_MS;
}

/** Milliseconds to the start of the next minute, so "in N min" ticks with the clock. */
export function msToNextMinute(now: number): number {
  return MINUTE_MS - (now % MINUTE_MS);
}

/** Outcome of `POST /sync/calendar`. */
export type SyncOutcome = 'synced' | 'throttled' | 'revoked' | 'error' | 'not_connected';

export type EventsState =
  | { status: 'loading' }
  /** `syncFailed`: the last sync failed, the events are from the cache ("Couldn't refresh"). */
  | { status: 'ready'; data: TodayEvents; syncFailed: boolean }
  /** The request failed, or the sync failed with nothing cached: "Couldn't refresh" + "Try again". */
  | { status: 'error' }
  /** The Calendar connection is revoked or missing: reconnect in settings. */
  | { status: 'reconnect' };

/**
 * The widget state from today's events and the connection status or sync outcome. A failing
 * connection (`error`) is usually a temporary Google failure that the background sync
 * retries, so cached events stay on screen; only a revoked or missing one asks to reconnect.
 */
export function eventsState(
  data: TodayEvents,
  status: GoogleConnectionStatus | SyncOutcome | null,
): EventsState {
  if (status === 'revoked' || status === 'none' || status === 'not_connected') {
    return { status: 'reconnect' };
  }
  if (status === 'error') {
    return data.events.length > 0
      ? { status: 'ready', data, syncFailed: true }
      : { status: 'error' };
  }
  return { status: 'ready', data, syncFailed: false };
}

/** Event time in the user's zone, 24-hour like the design in both languages: "09:30". */
export function formatTime(iso: string, language: string, timeZone: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

/** Name on the video chip from the call link; null for other providers ("Video call"). */
export function videoService(url: string): 'Meet' | 'Zoom' | 'Teams' | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is('meet.google.com')) return 'Meet';
  if (is('zoom.us') || is('zoom.com')) return 'Zoom';
  if (is('teams.microsoft.com') || is('teams.live.com')) return 'Teams';
  return null;
}
