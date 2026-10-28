import { afterEach, describe, expect, it, vi } from 'vitest';
import { listEvents, listSelectedCalendars, videoUrl } from './calendar';
import calendarList from './fixtures/calendar-list.json';
import eventsPage1 from './fixtures/events-page-1.json';
import eventsPage2 from './fixtures/events-page-2.json';
import { fakeFetch, queryOf } from './test-fetch';

const TOKEN = 'ya29.access-token-secret';
const CALENDAR = 'author@example.com';
// Yesterday + today + tomorrow in Europe/Warsaw around 28 October 2026.
const RANGE = { start: '2026-10-26T23:00:00.000Z', end: '2026-10-29T23:00:00.000Z' };
const EID = 'https://www.google.com/calendar/event?eid=';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSelectedCalendars', () => {
  it('keeps only calendars with selected: true, preferring the user’s own title', async () => {
    const fetch = fakeFetch({ status: 200, body: calendarList });

    expect(await listSelectedCalendars(TOKEN, { fetch })).toEqual({
      ok: true,
      value: [
        { id: 'author@example.com', title: 'author@example.com', primary: true },
        { id: 'c_3f1b6a0e9d2c4f5a8b7e@group.calendar.google.com', title: 'Семья', primary: false },
        {
          id: 'en.polish#holiday@group.v.calendar.google.com',
          title: 'Holidays in Poland',
          primary: false,
        },
      ],
    });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url.startsWith('https://www.googleapis.com/calendar/v3/users/me/calendarList?')).toBe(
      true,
    );
    expect(init.headers?.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('follows nextPageToken', async () => {
    const fetch = fakeFetch(
      {
        status: 200,
        body: { ...calendarList, items: calendarList.items.slice(0, 1), nextPageToken: 'page-2' },
      },
      { status: 200, body: { ...calendarList, items: calendarList.items.slice(1, 2) } },
    );
    const result = await listSelectedCalendars(TOKEN, { fetch });
    expect(result.ok && result.value.map((c) => c.title)).toEqual(['author@example.com', 'Семья']);
    expect(queryOf(fetch.mock.calls[1]![0]).pageToken).toBe('page-2');
  });

  it('passes Google errors through as error', async () => {
    const fetch = fakeFetch({
      status: 401,
      body: {
        error: {
          code: 401,
          message: 'Request had invalid authentication credentials.',
          status: 'UNAUTHENTICATED',
        },
      },
    });
    expect(await listSelectedCalendars(TOKEN, { fetch })).toEqual({
      ok: false,
      error: { kind: 'error', status: 401, message: 'Calendar API 401 UNAUTHENTICATED' },
    });
  });
});

describe('listEvents', () => {
  it('maps both pages into dashboard events', async () => {
    const fetch = fakeFetch({ status: 200, body: eventsPage1 }, { status: 200, body: eventsPage2 });

    const result = await listEvents(TOKEN, CALENDAR, RANGE, { fetch });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          // Meet via hangoutLink; description, attendees and attachments are dropped.
          id: '4hqb3vldm2f9r8j6p0ktcs1n5a',
          calendarId: CALENDAR,
          title: 'Design review',
          allDay: false,
          start: '2026-10-28T09:00:00.000Z',
          end: '2026-10-28T10:00:00.000Z',
          videoUrl: 'https://meet.google.com/abc-defg-hij',
          htmlLink: `${EID}NGhxYjN2bGRtMmY5cjhqNnAwa3RjczFuNWEgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        {
          // All day: dates stay dates, end exclusive.
          id: '0ob7s9e2ubk4k1fnl5p1a7m3qd',
          calendarId: CALENDAR,
          title: "Mum's birthday",
          allDay: true,
          start: '2026-10-28',
          end: '2026-10-29',
          videoUrl: null,
          htmlLink: `${EID}MG9iN3M5ZTJ1Ymk0azFmbmw1cDFhN20zcWQgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        {
          // Instance of a recurring event (singleEvents=true); Meet via conferenceData only.
          id: '7cbh8rpc10lrc0ckih9tafss99_20261028T090000Z',
          calendarId: CALENDAR,
          title: 'Standup',
          allDay: false,
          start: '2026-10-28T09:00:00.000Z',
          end: '2026-10-28T09:15:00.000Z',
          videoUrl: 'https://meet.google.com/xyz-abcd-efg',
          htmlLink: `${EID}N2NiaDhycGMxMGxyYzBja2loOXRhZnNzOTlfMjAyNjEwMjhUMDkwMDAwWiBhdXRob3JAZXhhbXBsZS5jb20`,
        },
        // "Quarterly planning" is gone: declined by the user.
        {
          // Crosses midnight.
          id: '2f8h1j4k7l0m3n6p9q2r5s8t1u',
          calendarId: CALENDAR,
          title: 'Night release',
          allDay: false,
          start: '2026-10-28T22:00:00.000Z',
          end: '2026-10-29T00:30:00.000Z',
          videoUrl: null,
          htmlLink: `${EID}MmY4aDFqNGs3bDBtM242cDlxMnI1czh0MXUgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        // Page 2. The cancelled instance is gone.
        {
          // Zoom in location, trailing comma not part of the link.
          id: '9a1b2c3d4e5f6g7h8i9j0k1l2m',
          calendarId: CALENDAR,
          title: 'Client call',
          allDay: false,
          start: '2026-10-28T15:30:00.000Z',
          end: '2026-10-28T16:00:00.000Z',
          videoUrl: 'https://us02web.zoom.us/j/81234567890?pwd=aBcDeFgHiJkLmNoPqRsT.1',
          htmlLink: `${EID}OWExYjJjM2Q0ZTVmNmc3aDhpOWowazFsMm0gYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        {
          // Zoom add-on in conferenceData; tentative is shown.
          id: '3x5z7b9d1f3h5j7l9n1p3r5t7v',
          calendarId: CALENDAR,
          title: 'Partner sync',
          allDay: false,
          start: '2026-10-28T17:00:00.000Z',
          end: '2026-10-28T17:30:00.000Z',
          videoUrl: 'https://zoom.us/j/99887766554?pwd=XyZ',
          htmlLink: `${EID}M3g1ejdiOWQxZjNoNWo3bDluMXAzcjV0N3YgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        {
          // Teams in location.
          id: '8c0e2g4i6k8m0o2q4s6u8w0y2a',
          calendarId: CALENDAR,
          title: 'Vendor demo',
          allDay: false,
          start: '2026-10-28T18:00:00.000Z',
          end: '2026-10-28T18:45:00.000Z',
          videoUrl:
            'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d',
          htmlLink: `${EID}OGMwZTJnNGk2azhtMG8ycTRzNnU4dzB5MmEgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
        // The working-location marker is gone.
        {
          id: '6g8j0l2n4p6r8t0v2x4z6b8d0f',
          calendarId: CALENDAR,
          title: '',
          allDay: false,
          start: '2026-10-28T19:00:00.000Z',
          end: '2026-10-28T19:30:00.000Z',
          videoUrl: null,
          htmlLink: `${EID}Nmc4ajBsMm40cDZyOHQwdjJ4NHo2YjhkMGYgYXV0aG9yQGV4YW1wbGUuY29t`,
        },
      ],
    });
  });

  it('asks for expanded instances in the range, page by page, with a minimal field mask', async () => {
    const fetch = fakeFetch({ status: 200, body: eventsPage1 }, { status: 200, body: eventsPage2 });
    const holidays = 'en.polish#holiday@group.v.calendar.google.com';

    await listEvents(TOKEN, holidays, RANGE, { fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
    const [first, init] = fetch.mock.calls[0]!;
    expect(first.split('?')[0]).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/en.polish%23holiday%40group.v.calendar.google.com/events',
    );
    expect(init).toEqual({
      method: 'GET',
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
    });
    const query = queryOf(first);
    expect(query).toMatchObject({
      timeMin: RANGE.start,
      timeMax: RANGE.end,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    expect(query.pageToken).toBeUndefined();
    expect(query.fields).not.toMatch(/description|attachments|email/);
    expect(queryOf(fetch.mock.calls[1]![0]).pageToken).toBe(eventsPage1.nextPageToken);
  });

  it('an error on a later page fails the whole list', async () => {
    const fetch = fakeFetch(
      { status: 200, body: eventsPage1 },
      {
        status: 403,
        body: { error: { code: 403, message: 'Rate Limit Exceeded', status: 'PERMISSION_DENIED' } },
      },
    );
    expect(await listEvents(TOKEN, CALENDAR, RANGE, { fetch })).toEqual({
      ok: false,
      error: { kind: 'error', status: 403, message: 'Calendar API 403 PERMISSION_DENIED' },
    });
  });

  it('stops on a runaway pagination loop', async () => {
    const page = {
      status: 200,
      body: { kind: 'calendar#events', items: [], nextPageToken: 'again' },
    };
    const fetch = fakeFetch(...Array.from({ length: 30 }, () => page));
    const result = await listEvents(TOKEN, CALENDAR, RANGE, { fetch });
    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(20);
  });

  it('network failure and broken JSON are errors without the token', async () => {
    for (const response of [
      new TypeError(`fetch failed ${TOKEN}`),
      { status: 502, body: '<html>Bad Gateway</html>' },
    ]) {
      const result = await listEvents(TOKEN, CALENDAR, RANGE, { fetch: fakeFetch(response) });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('access-token-secret');
    }
  });

  it('uses only the fetch it is given', async () => {
    const globalFetch = vi.fn(() => {
      throw new Error('global fetch must not be used');
    });
    vi.stubGlobal('fetch', globalFetch);
    const fetch = fakeFetch({ status: 200, body: eventsPage2 });
    expect((await listEvents(TOKEN, CALENDAR, RANGE, { fetch })).ok).toBe(true);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe('videoUrl', () => {
  it('ignores links that are not video calls', () => {
    expect(videoUrl({ location: 'Office, see https://maps.google.com/?q=Warsaw' })).toBeNull();
    expect(videoUrl({ location: 'Room 4.12' })).toBeNull();
    expect(videoUrl({})).toBeNull();
  });

  it('takes the first video link in location', () => {
    expect(
      videoUrl({ location: 'https://example.com/agenda (https://meet.google.com/abc-defg-hij)' }),
    ).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('skips phone entry points', () => {
    expect(
      videoUrl({
        conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+48-22-123-45-67' }] },
      }),
    ).toBeNull();
  });
});
