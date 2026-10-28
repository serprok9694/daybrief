/**
 * Wall-clock arithmetic in IANA time zones on top of `Intl.DateTimeFormat` only, so the
 * same code runs in Node (API) and in Hermes / browsers (Expo app) without a tz database
 * in the bundle.
 */

/** A half-open interval [start, end) of instants, as RFC 3339 UTC strings. */
export type TimeRange = { start: string; end: string };

/** Calendar date and wall-clock time in some time zone. Months are 1-based. */
export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall clock of `instant` in `timeZone`. Throws a RangeError for an unknown zone. */
export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    // Some engines print midnight as 24 even with h23.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function wallClockMs(w: WallClock): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

/** UTC offset of `timeZone` at `instantMs`, in ms (Warsaw in winter: +3_600_000). */
function offsetMs(instantMs: number, timeZone: string): number {
  const whole = instantMs - (((instantMs % 1000) + 1000) % 1000);
  return wallClockMs(wallClock(new Date(whole), timeZone)) - whole;
}

/**
 * The instant at which the clock in `timeZone` shows `local` (seconds default to 0).
 * Like Temporal's "compatible" disambiguation: an ambiguous time (clocks go back) maps to
 * the earlier instant, a skipped time (clocks go forward) is moved forward by the gap.
 * Assumes at most one offset change within ±24 h, true for every real zone.
 */
export function zonedTimeToInstant(
  local: Omit<WallClock, 'second'> & { second?: number },
  timeZone: string,
): Date {
  const localMs = wallClockMs({ ...local, second: local.second ?? 0 });
  const before = offsetMs(localMs - DAY_MS, timeZone);
  const after = offsetMs(localMs + DAY_MS, timeZone);
  const candidates = [...new Set([before, after])]
    .map((offset) => localMs - offset)
    .filter((t) => wallClockMs(wallClock(new Date(t), timeZone)) === localMs)
    .sort((a, b) => a - b);
  return new Date(candidates[0] ?? localMs - before);
}

/**
 * Local calendar day of `now` in `timeZone`, shifted by `dayOffset` days (-1 = yesterday),
 * as [00:00, next day's 00:00). A day is 23 or 25 hours long when the clocks change.
 */
export function dayRange(timeZone: string, now: Date, dayOffset = 0): TimeRange {
  const today = wallClock(now, timeZone);
  const midnight = (days: number) => {
    // Date.UTC normalises day overflow (e.g. 32 October → 1 November).
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
    return zonedTimeToInstant(
      {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: 0,
        minute: 0,
      },
      timeZone,
    ).toISOString();
  };
  return { start: midnight(dayOffset), end: midnight(dayOffset + 1) };
}

/** Today in the user's time zone (`profiles.timezone`), see {@link dayRange}. */
export function todayRange(timeZone: string, now: Date): TimeRange {
  return dayRange(timeZone, now, 0);
}
