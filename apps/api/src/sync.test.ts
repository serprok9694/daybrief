import type { CalendarEvent, TodayEvents } from '@daybrief/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoutes } from './routes';
import { syncAllCalendars, syncCalendar, syncWindow } from './sync';
import {
  ACCESS_TOKEN,
  CLIENT_SECRET,
  fakeWorld,
  REFRESH_TOKEN,
  SYNC_SECRET,
  tokenOk,
} from './test-deps';

let world: ReturnType<typeof fakeWorld>;
let routes: ReturnType<typeof createRoutes>;
let logs: string[];

beforeEach(() => {
  world = fakeWorld();
  routes = createRoutes(world.deps);
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  }
});
afterEach(() => vi.restoreAllMocks());

const event = (
  id: string,
  start: Record<string, string>,
  end: Record<string, string>,
  extra = {},
) => ({
  id,
  status: 'confirmed',
  summary: id,
  start,
  end,
  htmlLink: `https://g.co/${id}`,
  ...extra,
});

/** A Warsaw user with two selected calendars (one unselected) and a few events. */
function googleDay() {
  world.state.google.calendarList = {
    status: 200,
    body: {
      items: [
        { id: 'primary@example.com', summary: 'Me', primary: true, selected: true },
        { id: 'pl#holiday@group.v.calendar.google.com', summary: 'Holidays', selected: true },
        { id: 'hidden@example.com', summary: 'Hidden' },
      ],
    },
  };
  world.state.google.events = {
    'primary@example.com': {
      status: 200,
      body: {
        items: [
          event(
            'standup',
            { dateTime: '2026-10-28T09:00:00+01:00' },
            { dateTime: '2026-10-28T09:15:00+01:00' },
            { hangoutLink: 'https://meet.google.com/abc-defg-hij' },
          ),
          event(
            'declined',
            { dateTime: '2026-10-28T12:00:00+01:00' },
            { dateTime: '2026-10-28T13:00:00+01:00' },
            { attendees: [{ self: true, responseStatus: 'declined' }] },
          ),
        ],
      },
    },
    'pl#holiday@group.v.calendar.google.com': {
      status: 200,
      body: { items: [event('holiday', { date: '2026-10-28' }, { date: '2026-10-29' })] },
    },
  };
}

const standup: CalendarEvent = {
  id: 'standup',
  calendarId: 'primary@example.com',
  title: 'standup',
  allDay: false,
  start: '2026-10-28T08:00:00.000Z',
  end: '2026-10-28T08:15:00.000Z',
  videoUrl: 'https://meet.google.com/abc-defg-hij',
  htmlLink: 'https://g.co/standup',
};
const holiday: CalendarEvent = {
  id: 'holiday',
  calendarId: 'pl#holiday@group.v.calendar.google.com',
  title: 'holiday',
  allDay: true,
  start: '2026-10-28',
  end: '2026-10-29',
  videoUrl: null,
  htmlLink: 'https://g.co/holiday',
};

const urls = () => world.fetch.mock.calls.map(([url]) => url);

describe('syncWindow', () => {
  it('is yesterday, today and tomorrow in the user zone', () => {
    expect(syncWindow('Europe/Warsaw', new Date('2026-10-28T10:00:00Z'))).toEqual({
      start: '2026-10-26T23:00:00.000Z',
      end: '2026-10-29T23:00:00.000Z',
    });
  });
});

describe('syncCalendar', () => {
  it('stores the selected calendars’ events of the window and marks the connection active', async () => {
    world.connect('u1', 'Europe/Warsaw', 'error');
    world.state.syncState.set('u1', {
      syncedAt: null,
      error: 'Calendar API 503',
      lockedUntil: null,
    });
    world.state.events.set('u1', [
      { ...holiday, id: 'stale', start: '2026-10-01', end: '2026-10-02' },
    ]);
    googleDay();

    expect(await syncCalendar('u1', world.deps)).toBe('synced');

    expect(world.state.events.get('u1')).toEqual([standup, holiday]);
    expect(world.state.syncState.get('u1')).toMatchObject({
      syncedAt: '2026-10-28T10:00:00.000Z',
      error: null,
    });
    expect(world.state.connections.get('u1')?.status).toBe('active');

    // The decrypted refresh token and client credentials go to the token endpoint only.
    const [tokenUrl, tokenInit] = world.fetch.mock.calls[0]!;
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(tokenInit.body).toContain(`refresh_token=${REFRESH_TOKEN}`);
    // The unselected calendar is not read; both others use the Warsaw window.
    const eventUrls = urls().filter((u) => u.includes('/events?'));
    expect(eventUrls).toHaveLength(2);
    expect(urls().some((u) => u.includes('hidden'))).toBe(false);
    for (const url of eventUrls) {
      expect(url).toContain(`timeMin=${encodeURIComponent('2026-10-26T23:00:00.000Z')}`);
      expect(url).toContain(`timeMax=${encodeURIComponent('2026-10-29T23:00:00.000Z')}`);
    }
  });

  it('uses UTC until the client reports a time zone', async () => {
    world.connect('u1', null);
    world.state.google.calendarList = {
      status: 200,
      body: { items: [{ id: 'primary', selected: true }] },
    };
    await syncCalendar('u1', world.deps);
    expect(urls().find((u) => u.includes('/events?'))).toContain(
      `timeMin=${encodeURIComponent('2026-10-27T00:00:00.000Z')}`,
    );
  });

  it('marks a revoked grant and stops calling Google for it', async () => {
    world.connect('u1', 'Europe/Warsaw');
    world.state.events.set('u1', [standup]);
    world.state.google.token = {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
    };

    expect(await syncCalendar('u1', world.deps)).toBe('revoked');
    expect(world.state.connections.get('u1')?.status).toBe('revoked');
    expect(world.state.syncState.get('u1')?.error).toBe('Token endpoint: invalid_grant');
    expect(world.state.events.get('u1')).toEqual([standup]);

    world.state.now = new Date('2026-10-28T11:00:00Z');
    world.fetch.mockClear();
    expect(await syncCalendar('u1', world.deps)).toBe('revoked');
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('records a Google error and keeps the cached events and last sync time', async () => {
    world.connect('u1', 'Europe/Warsaw');
    googleDay();
    await syncCalendar('u1', world.deps);

    world.state.now = new Date('2026-10-28T11:00:00Z');
    world.state.google.events['pl#holiday@group.v.calendar.google.com'] = {
      status: 500,
      body: { error: { code: 500, status: 'INTERNAL' } },
    };
    expect(await syncCalendar('u1', world.deps)).toBe('error');

    expect(world.state.connections.get('u1')?.status).toBe('error');
    expect(world.state.syncState.get('u1')).toMatchObject({
      syncedAt: '2026-10-28T10:00:00.000Z',
      error: 'Calendar API 500 INTERNAL',
    });
    // All or nothing: the primary calendar's events are not replaced by a partial result.
    expect(world.state.events.get('u1')).toEqual([standup, holiday]);
  });

  it('records a token that no longer decrypts as an error', async () => {
    world.connect('u1', 'Europe/Warsaw');
    world.state.connections.get('u1')!.refreshTokenEncrypted = 'v1.broken';
    expect(await syncCalendar('u1', world.deps)).toBe('error');
    expect(world.state.syncState.get('u1')?.error).toBe(
      'Stored Google token could not be decrypted',
    );
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('does nothing for a user without a connection', async () => {
    expect(await syncCalendar('nobody', world.deps)).toBe('not_connected');
    expect(world.fetch).not.toHaveBeenCalled();
  });
});

const auth = (userId: string) => ({ Authorization: `Bearer token-for-${userId}` });

describe('POST /sync/calendar', () => {
  const refresh = (userId?: string) =>
    routes.request('/sync/calendar', { method: 'POST', headers: userId ? auth(userId) : {} });

  it('requires a valid token', async () => {
    expect((await refresh()).status).toBe(401);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('syncs and answers with today’s events', async () => {
    world.connect('u1', 'Europe/Warsaw');
    googleDay();
    const res = await refresh('u1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [holiday, standup],
      syncedAt: '2026-10-28T10:00:00.000Z',
      error: null,
      sync: 'synced',
    });
  });

  it('runs at most once per 30 s and otherwise returns the current data', async () => {
    world.connect('u1', 'Europe/Warsaw');
    googleDay();
    await refresh('u1');
    const calls = world.fetch.mock.calls.length;

    world.state.now = new Date('2026-10-28T10:00:29Z');
    const throttled = await refresh('u1');
    expect(throttled.status).toBe(200);
    expect(await throttled.json()).toMatchObject({
      events: [holiday, standup],
      syncedAt: '2026-10-28T10:00:00.000Z',
      sync: 'throttled',
    });
    expect(world.fetch.mock.calls.length).toBe(calls);

    world.state.now = new Date('2026-10-28T10:00:30Z');
    expect(await (await refresh('u1')).json()).toMatchObject({ sync: 'synced' });
    expect(world.fetch.mock.calls.length).toBeGreaterThan(calls);
  });

  it('reports a failed sync in the data instead of failing the request', async () => {
    world.connect('u1', 'Europe/Warsaw');
    world.state.google.token = { status: 503, body: { error: 'temporarily_unavailable' } };
    const res = await refresh('u1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      events: [],
      syncedAt: null,
      error: 'Token endpoint 503 temporarily_unavailable',
      sync: 'error',
    });
  });
});

describe('POST /internal/sync', () => {
  const internal = (headers: Record<string, string> = {}) =>
    routes.request('/internal/sync', { method: 'POST', headers });

  it('answers 503 and syncs nothing while SYNC_SECRET is not set', async () => {
    world.connect('u1', 'Europe/Warsaw');
    world.state.syncSecret = undefined;
    const res = await internal({ 'x-sync-secret': '' });
    expect(res.status).toBe(503);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret with 401', async () => {
    world.connect('u1', 'Europe/Warsaw');
    expect((await internal()).status).toBe(401);
    expect((await internal({ 'x-sync-secret': 'wrong' })).status).toBe(401);
    expect((await internal({ 'x-sync-secret': `${SYNC_SECRET}x` })).status).toBe(401);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it('syncs every connected user and answers with counts only', async () => {
    world.connect('ok', 'Europe/Warsaw');
    world.connect('was-error', 'UTC', 'error');
    world.connect('gone', 'UTC', 'revoked');
    googleDay();

    const res = await internal({ 'x-sync-secret': SYNC_SECRET });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      users: 2,
      synced: 2,
      throttled: 0,
      revoked: 0,
      error: 0,
      not_connected: 0,
      timeout: 0,
      failed: 0,
    });
    expect(world.state.connections.get('was-error')?.status).toBe('active');
    expect(world.state.connections.get('gone')?.status).toBe('revoked');
  });

  it('moves on when one user times out or fails', async () => {
    world.connect('slow', 'UTC');
    world.connect('broken', 'UTC');
    world.connect('ok', 'UTC');
    const { getSyncSource } = world.deps;
    const deps = {
      ...world.deps,
      getSyncSource: async (userId: string) => {
        if (userId === 'slow') return new Promise<never>(() => {});
        if (userId === 'broken') throw new Error('Failed to load Google connection: boom');
        return getSyncSource(userId);
      },
    };
    expect(await syncAllCalendars(deps, 10)).toMatchObject({
      users: 3,
      synced: 1,
      timeout: 1,
      failed: 1,
    });
    expect(logs).toEqual([
      'calendar sync timed out for user slow',
      'calendar sync failed for user broken: Failed to load Google connection: boom',
    ]);
  });
});

describe('GET /events/today', () => {
  const today = async (userId?: string) =>
    routes.request('/events/today', { headers: userId ? auth(userId) : {} });

  // 05:00 UTC: already the 28th in Warsaw (06:00), still the 27th in Los Angeles (22:00).
  const stored: CalendarEvent[] = [
    {
      ...standup,
      id: 'warsaw-morning',
      start: '2026-10-28T09:00:00.000Z',
      end: '2026-10-28T10:00:00.000Z',
    },
    {
      ...standup,
      id: 'la-afternoon',
      start: '2026-10-27T20:00:00.000Z',
      end: '2026-10-27T21:00:00.000Z',
    },
    { ...holiday, id: 'all-day-28', start: '2026-10-28', end: '2026-10-29' },
    { ...holiday, id: 'all-day-27', start: '2026-10-27', end: '2026-10-28' },
  ];

  beforeEach(() => {
    world.state.now = new Date('2026-10-28T05:00:00Z');
    for (const [userId, zone] of [
      ['warsaw', 'Europe/Warsaw'],
      ['la', 'America/Los_Angeles'],
    ] as const) {
      world.connect(userId, zone);
      world.state.events.set(userId, stored);
      world.state.syncState.set(userId, {
        syncedAt: '2026-10-28T04:45:00.000Z',
        error: null,
        lockedUntil: null,
      });
    }
  });

  it('requires a valid token', async () => {
    expect((await today()).status).toBe(401);
  });

  it('returns the events of today in the user’s time zone, all-day first', async () => {
    const warsaw = (await (await today('warsaw')).json()) as TodayEvents;
    expect(warsaw.events.map((e) => e.id)).toEqual(['all-day-28', 'warsaw-morning']);
    expect(warsaw.syncedAt).toBe('2026-10-28T04:45:00.000Z');
    expect(warsaw.error).toBeNull();

    const la = (await (await today('la')).json()) as TodayEvents;
    expect(la.events.map((e) => e.id)).toEqual(['all-day-27', 'la-afternoon']);
  });

  it('is empty before the first sync', async () => {
    const res = await today('new-user');
    expect(await res.json()).toEqual({ events: [], syncedAt: null, error: null });
  });
});

describe('secrets', () => {
  it('never appear in responses, stored errors or logs', async () => {
    const bodies: string[] = [];
    const send = async (path: string, init: RequestInit) => {
      bodies.push(await (await routes.request(path, init)).text());
    };
    world.connect('u1', 'Europe/Warsaw');
    googleDay();

    await send('/sync/calendar', { method: 'POST', headers: auth('u1') });
    await send('/events/today', { headers: auth('u1') });
    await send('/internal/sync', { method: 'POST', headers: { 'x-sync-secret': SYNC_SECRET } });
    await send('/internal/sync', { method: 'POST', headers: { 'x-sync-secret': 'wrong' } });

    // Failures echo Google's error bodies, which must not carry tokens through either.
    world.state.now = new Date('2026-10-28T11:00:00Z');
    world.state.google.token = {
      status: 401,
      body: { error: 'invalid_client', token: REFRESH_TOKEN },
    };
    await send('/sync/calendar', { method: 'POST', headers: auth('u1') });
    world.state.now = new Date('2026-10-28T12:00:00Z');
    world.state.google.token = tokenOk;
    world.state.google.calendarList = {
      status: 403,
      body: { error: { status: 'PERMISSION_DENIED', message: `bad ${ACCESS_TOKEN}` } },
    };
    await send('/sync/calendar', { method: 'POST', headers: auth('u1') });
    world.state.syncSecret = undefined;
    await send('/internal/sync', { method: 'POST', headers: { 'x-sync-secret': SYNC_SECRET } });

    const encrypted = world.state.connections.get('u1')!.refreshTokenEncrypted;
    const errors = [...world.state.syncState.values()].map((s) => s.error ?? '');
    const everything = [...bodies, ...errors, ...logs].join('\n');
    expect(bodies).toHaveLength(7);
    for (const secret of [REFRESH_TOKEN, ACCESS_TOKEN, CLIENT_SECRET, SYNC_SECRET, encrypted]) {
      expect(everything).not.toContain(secret);
    }
  });
});
