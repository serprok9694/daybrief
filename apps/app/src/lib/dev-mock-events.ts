// Loaded only through lib/dev-mock-data.ts in development. See lib/dev-mock.ts.
import {
  wallClock,
  type CalendarEvent,
  type GoogleConnectionStatus,
  type TodayEvents,
} from '@daybrief/core';
import type { EventsSource } from './events-source';

export const eventScenarios = [
  'day',
  'empty',
  'error',
  'revoked',
  'many',
  'allday',
  'loading',
] as const;
export type EventScenario = (typeof eventScenarios)[number];

const MIN = 60 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Sample = {
  title: [en: string, ru: string];
  /** Minutes from the mock's "now" (rounded down to 5 min). */
  from: number;
  to: number;
  video?: 'meet' | 'zoom';
};

// "day" is the design's sample: a past event, the next one in ~18 min, a free window, more.
// Compact, so the free window still falls before 21:00 in the evening.
const daySamples: Sample[] = [
  { title: ['Lunch with Marek', 'Обед с Мареком'], from: -120, to: -60 },
  { title: ['Design review with Anna', 'Дизайн-ревью с Анной'], from: 20, to: 80, video: 'meet' },
  { title: ['Sprint planning', 'Планирование спринта'], from: 155, to: 245, video: 'zoom' },
  { title: ['1:1 with Anna', '1:1 с Анной'], from: 245, to: 275, video: 'meet' },
];

const manySamples: Sample[] = [
  { title: ['Standup', 'Стендап'], from: -200, to: -185, video: 'meet' },
  { title: ['Hiring sync', 'Синк по найму'], from: -120, to: -90, video: 'zoom' },
  { title: ['Design review with Anna', 'Дизайн-ревью с Анной'], from: 20, to: 80, video: 'meet' },
  { title: ['Lunch with Marek', 'Обед с Мареком'], from: 90, to: 150 },
  { title: ['Roadmap review', 'Ревью роадмапа'], from: 150, to: 210, video: 'meet' },
  { title: ['Sprint planning', 'Планирование спринта'], from: 210, to: 300, video: 'zoom' },
  { title: ['1:1 with Anna', '1:1 с Анной'], from: 300, to: 330, video: 'meet' },
  { title: ['Gym', 'Спортзал'], from: 360, to: 420 },
];

const allDayTitles: [en: string, ru: string][] = [
  ['Marek’s birthday', 'День рождения Марека'],
  ['Working from Kraków', 'Работаю из Кракова'],
];

const videoUrls = {
  meet: 'https://meet.google.com/abc-defg-hij',
  zoom: 'https://zoom.us/j/1234567890',
};

const pad = (n: number) => String(n).padStart(2, '0');

function localDate(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

function eventsFor(scenario: EventScenario, ru: boolean, timeZone: string): CalendarEvent[] {
  const now = Date.now();
  const base = Math.floor(now / (5 * MIN)) * 5 * MIN;
  const timed = (samples: Sample[]): CalendarEvent[] =>
    samples.map((s, i) => ({
      id: `mock-${i}`,
      calendarId: 'primary',
      title: s.title[ru ? 1 : 0],
      videoUrl: s.video ? videoUrls[s.video] : null,
      htmlLink: 'https://calendar.google.com/calendar/r/day',
      allDay: false,
      start: new Date(base + s.from * MIN).toISOString(),
      end: new Date(base + s.to * MIN).toISOString(),
    }));

  switch (scenario) {
    case 'empty':
      return [];
    case 'many':
      return timed(manySamples);
    case 'allday': {
      const today = localDate(new Date(now), timeZone);
      const tomorrow = localDate(new Date(now + 24 * 60 * MIN), timeZone);
      const allDay: CalendarEvent[] = allDayTitles.map((title, i) => ({
        id: `mock-all-${i}`,
        calendarId: 'primary',
        title: title[ru ? 1 : 0],
        videoUrl: null,
        htmlLink: 'https://calendar.google.com/calendar/r/day',
        allDay: true,
        start: today,
        end: tomorrow,
      }));
      return [...allDay, ...timed(daySamples.slice(0, 3))];
    }
    default:
      return timed(daySamples);
  }
}

/**
 * Events widget data for the dev mock, picked with `?events=`: `day` (default), `empty`,
 * `error` (requests fail), `revoked` (connection revoked), `many` (8 events), `allday`,
 * `loading` (never answers). Times are relative to now, so the next event is always ahead.
 */
export function createEventsMock(
  scenario: EventScenario,
  ru: boolean,
  connection: GoogleConnectionStatus,
): EventsSource {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let syncedAt = new Date(Date.now() - 2 * MIN).toISOString();
  const data = (): TodayEvents => ({
    events: eventsFor(scenario, ru, timeZone),
    syncedAt,
    error: null,
  });
  const answer = async <T>(ms: number, value: () => T): Promise<T> => {
    if (scenario === 'loading') return new Promise<T>(() => {});
    await sleep(ms);
    if (scenario === 'error') throw new Error('Mock: the events request failed');
    return value();
  };

  return {
    today: () => answer(500, data),
    sync: () =>
      answer(900, () => {
        if (connection === 'revoked' || connection === 'error') {
          return { ...data(), sync: connection };
        }
        syncedAt = new Date().toISOString();
        return { ...data(), sync: 'synced' as const };
      }),
    connection: () => answer(200, () => connection),
  };
}
