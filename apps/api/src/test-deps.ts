import { GOOGLE_TOKEN_URL, type FetchLike } from '@daybrief/connectors';
import type { ApiToken, CalendarEvent, Idea } from '@daybrief/core';
import { randomBytes, randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { encrypt } from './crypto';
import type { Deps } from './deps';
import type { SyncSource } from './sync';

// Distinctive values, so tests can assert that none of them leaks into responses or logs.
export const REFRESH_TOKEN = 'refresh-token-LEAK-CANARY-1';
export const ACCESS_TOKEN = 'access-token-LEAK-CANARY-2';
export const CLIENT_SECRET = 'client-secret-LEAK-CANARY-3';
export const SYNC_SECRET = 'sync-secret-LEAK-CANARY-4';

export type FakeResponse = { status: number; body: unknown } | 'hang';

/** Google as the fake fetch answers it; tests change these between calls. */
export interface FakeGoogle {
  token: FakeResponse;
  calendarList: FakeResponse;
  /** By calendar id; missing calendars have no events. */
  events: Record<string, FakeResponse>;
}

export const tokenOk: FakeResponse = {
  status: 200,
  body: { access_token: ACCESS_TOKEN, expires_in: 3599, token_type: 'Bearer' },
};

const ideaView = (i: Idea): Idea => ({
  id: i.id,
  text: i.text,
  source: i.source,
  externalId: i.externalId,
  createdAt: i.createdAt,
  snoozedUntil: i.snoozedUntil,
  doneAt: i.doneAt,
  lastShownAt: i.lastShownAt,
});
const tokenView = (t: ApiToken): ApiToken => ({
  id: t.id,
  name: t.name,
  last4: t.last4,
  createdAt: t.createdAt,
  lastUsedAt: t.lastUsedAt,
});

/**
 * In-memory stand-in for Supabase and Google behind `Deps`. Tokens of the form
 * `token-for-<userId>` authenticate as that user. Test-only.
 */
export function fakeWorld() {
  const key = randomBytes(32);
  const state = {
    now: new Date('2026-10-28T10:00:00Z'),
    syncSecret: SYNC_SECRET as string | undefined,
    connections: new Map<string, Omit<SyncSource, 'timezone'>>(),
    timezones: new Map<string, string | null>(),
    events: new Map<string, CalendarEvent[]>(),
    syncState: new Map<
      string,
      { syncedAt: string | null; error: string | null; lockedUntil: number | null }
    >(),
    ideas: [] as (Idea & { userId: string; textHash: string })[],
    apiTokens: [] as (ApiToken & { userId: string; tokenHash: string; revoked: boolean })[],
    google: {
      token: tokenOk,
      calendarList: { status: 200, body: { items: [] } },
      events: {},
    } as FakeGoogle,
  };

  const fetch = vi.fn<FetchLike>(async (url, init) => {
    let response: FakeResponse;
    if (url === GOOGLE_TOKEN_URL) {
      response = state.google.token;
    } else if (init.headers?.authorization !== `Bearer ${ACCESS_TOKEN}`) {
      response = { status: 401, body: { error: { status: 'UNAUTHENTICATED' } } };
    } else if (url.includes('/users/me/calendarList')) {
      response = state.google.calendarList;
    } else {
      const id = decodeURIComponent(/\/calendars\/([^/]+)\/events/.exec(url)?.[1] ?? '');
      response = state.google.events[id] ?? { status: 200, body: { items: [] } };
    }
    if (response === 'hang') return new Promise(() => {});
    const { status, body } = response;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });

  const syncStateOf = (userId: string) => {
    let s = state.syncState.get(userId);
    if (!s) state.syncState.set(userId, (s = { syncedAt: null, error: null, lockedUntil: null }));
    return s;
  };

  const deps: Deps = {
    verifyToken: () => async (token) => {
      if (!token.startsWith('token-for-')) throw new Error('bad token');
      return token.slice('token-for-'.length);
    },
    getProfile: async (userId) =>
      state.timezones.has(userId)
        ? {
            userId,
            displayName: null,
            locale: null,
            theme: 'auto',
            scene: 'auto',
            timezone: state.timezones.get(userId) ?? null,
          }
        : null,
    updateProfile: async () => null,
    getGoogleConnection: async (userId) => {
      const connection = state.connections.get(userId);
      return connection
        ? { status: connection.status, scopes: [] }
        : { status: 'none', scopes: [] };
    },
    tokenKey: () => key,
    saveGoogleConnection: async () => {},
    syncSecret: () => state.syncSecret,
    getCalendarEvents: async (userId) => state.events.get(userId) ?? [],
    getCalendarSyncState: async (userId) => {
      const s = state.syncState.get(userId);
      return { syncedAt: s?.syncedAt ?? null, error: s?.error ?? null };
    },
    now: () => state.now,
    googleClient: () => ({ clientId: 'client-id', clientSecret: CLIENT_SECRET, fetch }),
    getSyncSource: async (userId) => {
      const connection = state.connections.get(userId);
      return connection ? { ...connection, timezone: state.timezones.get(userId) ?? null } : null;
    },
    tryLockSync: async (userId, seconds) => {
      const s = syncStateOf(userId);
      if (s.lockedUntil !== null && s.lockedUntil > state.now.getTime()) return false;
      s.lockedUntil = state.now.getTime() + seconds * 1000;
      return true;
    },
    saveCalendarSync: async (userId, events, syncedAt) => {
      state.events.set(userId, events);
      Object.assign(syncStateOf(userId), { syncedAt: syncedAt.toISOString(), error: null });
      const connection = state.connections.get(userId);
      if (connection) connection.status = 'active';
    },
    failCalendarSync: async (userId, error, status) => {
      syncStateOf(userId).error = error;
      const connection = state.connections.get(userId);
      if (connection) connection.status = status;
    },
    listSyncUserIds: async () =>
      [...state.connections].filter(([, c]) => c.status !== 'revoked').map(([id]) => id),

    // Ideas and API tokens, with the dedup and limit rules of the SQL functions.
    addIdea: async (userId, { text, source, externalId, textHash }) => {
      const mine = state.ideas.filter((i) => i.userId === userId);
      const existing =
        (externalId !== null && mine.find((i) => i.externalId === externalId)) ||
        mine.find((i) => i.textHash === textHash && i.doneAt === null);
      if (existing) return { idea: ideaView(existing), created: false };
      const idea = {
        id: randomUUID(),
        text,
        source,
        externalId,
        createdAt: state.now.toISOString(),
        snoozedUntil: null,
        doneAt: null,
        lastShownAt: null,
      };
      state.ideas.push({ ...idea, userId, textHash });
      return { idea, created: true };
    },
    getOpenIdeas: async (userId) =>
      state.ideas.filter((i) => i.userId === userId && i.doneAt === null).map(ideaView),
    markIdeaShown: async (userId, ideaId, at) => {
      const idea = state.ideas.find((i) => i.userId === userId && i.id === ideaId);
      if (idea) idea.lastShownAt = at.toISOString();
    },
    updateIdea: async (userId, ideaId, patch) => {
      const idea = state.ideas.find((i) => i.userId === userId && i.id === ideaId);
      if (!idea) return false;
      if ('doneAt' in patch) idea.doneAt = patch.doneAt.toISOString();
      else idea.snoozedUntil = patch.snoozedUntil.toISOString();
      return true;
    },
    useApiToken: async (tokenHash) => {
      const token = state.apiTokens.find((t) => t.tokenHash === tokenHash && !t.revoked);
      if (!token) return null;
      token.lastUsedAt = state.now.toISOString();
      return { userId: token.userId, tokenHash: token.tokenHash };
    },
    listApiTokens: async (userId) =>
      state.apiTokens.filter((t) => t.userId === userId && !t.revoked).map(tokenView),
    createApiToken: async (userId, { name, tokenHash, last4 }, limit) => {
      const active = state.apiTokens.filter((t) => t.userId === userId && !t.revoked);
      if (active.length >= limit) return null;
      const token = {
        id: randomUUID(),
        name,
        last4,
        createdAt: state.now.toISOString(),
        lastUsedAt: null,
      };
      state.apiTokens.push({ ...token, userId, tokenHash, revoked: false });
      return token;
    },
    revokeApiToken: async (userId, tokenId) => {
      const token = state.apiTokens.find(
        (t) => t.userId === userId && t.id === tokenId && !t.revoked,
      );
      if (!token) return false;
      token.revoked = true;
      return true;
    },
  };

  /** A user with a stored (encrypted) refresh token and a profile in `timezone`. */
  const connect = (
    userId: string,
    timezone: string | null,
    status: SyncSource['status'] = 'active',
  ) => {
    state.timezones.set(userId, timezone);
    state.connections.set(userId, {
      refreshTokenEncrypted: encrypt(REFRESH_TOKEN, key),
      status,
    });
  };

  return { state, deps, fetch, connect };
}
