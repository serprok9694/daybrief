import { GOOGLE_SCOPES, type Profile, type ProfilePatch } from '@daybrief/core';
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { decrypt } from './crypto';
import type { GoogleConnectionInput } from './deps';
import { createRoutes } from './routes';
import { fakeWorld } from './test-deps';

const profile: Profile = {
  userId: 'user-1',
  displayName: 'Alice',
  locale: 'ru',
  theme: 'auto',
  scene: 'auto',
  timezone: 'Europe/Berlin',
};

const key = randomBytes(32);
let saved: Map<string, GoogleConnectionInput>;
let updates: ProfilePatch[];
beforeEach(() => {
  saved = new Map();
  updates = [];
});

const routes = createRoutes({
  // Calendar routes are covered in sync.test.ts.
  ...fakeWorld().deps,
  // Accepts tokens of the form "token-for-<userId>".
  verifyToken: () => async (token) => {
    if (!token.startsWith('token-for-')) throw new Error('bad token');
    return token.slice('token-for-'.length);
  },
  getProfile: async (userId) => (userId === profile.userId ? profile : null),
  updateProfile: async (userId, patch) => {
    if (userId !== profile.userId) return null;
    updates.push(patch);
    return { ...profile, ...patch };
  },
  getGoogleConnection: async (userId) =>
    userId === profile.userId
      ? { status: 'active', scopes: [...GOOGLE_SCOPES] }
      : { status: 'none', scopes: [] },
  tokenKey: () => key,
  saveGoogleConnection: async (userId, connection) => {
    saved.set(userId, connection);
  },
});

const me = (token?: string) =>
  routes.request('/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe('GET /me', () => {
  it('returns the current user profile', async () => {
    const res = await me('token-for-user-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(profile);
  });

  it('requires a valid token', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('garbage')).status).toBe(401);
  });

  it('returns 404 when the profile does not exist', async () => {
    expect((await me('token-for-user-2')).status).toBe(404);
  });
});

describe('PATCH /me', () => {
  const patch = (body: unknown, token?: string) =>
    routes.request('/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it('requires a valid token', async () => {
    expect((await patch({ theme: 'dark' })).status).toBe(401);
    expect((await patch({ theme: 'dark' }, 'garbage')).status).toBe(401);
    expect(updates).toEqual([]);
  });

  it('saves the change and returns the updated profile', async () => {
    const res = await patch({ theme: 'dark', locale: null }, 'token-for-user-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...profile, theme: 'dark', locale: null });
    expect(updates).toEqual([{ theme: 'dark', locale: null }]);
  });

  it.each([{}, { theme: 'sepia' }, { userId: 'user-2' }, { displayName: 'x' }, null, []])(
    'rejects an invalid patch: %j',
    async (body) => {
      expect((await patch(body, 'token-for-user-1')).status).toBe(400);
      expect(updates).toEqual([]);
    },
  );

  it('returns 404 when the profile does not exist', async () => {
    expect((await patch({ scene: 'night' }, 'token-for-user-2')).status).toBe(404);
  });
});

describe('GET /connections/google', () => {
  const get = (token?: string) =>
    routes.request('/connections/google', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  it('requires a valid token', async () => {
    expect((await get()).status).toBe(401);
  });

  it('returns the status without the token', async () => {
    const res = await get('token-for-user-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'active', scopes: [...GOOGLE_SCOPES] });
  });

  it('reports none when the user never connected', async () => {
    expect(await (await get('token-for-user-2')).json()).toEqual({ status: 'none', scopes: [] });
  });
});

describe('POST /connections/google', () => {
  const refreshToken = '1//0g-google-refresh-token';
  const connect = (body: unknown, token?: string) =>
    routes.request('/connections/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it('requires a valid token', async () => {
    expect((await connect({ refreshToken })).status).toBe(401);
    expect((await connect({ refreshToken }, 'garbage')).status).toBe(401);
    expect(saved.size).toBe(0);
  });

  it.each([{}, { refreshToken: '' }, { refreshToken: '   ' }, { refreshToken: 42 }, null])(
    'rejects a missing or empty refresh token: %j',
    async (body) => {
      const res = await connect(body, 'token-for-user-1');
      expect(res.status).toBe(400);
      expect(saved.size).toBe(0);
    },
  );

  it('stores the encrypted token with the requested scopes', async () => {
    const res = await connect({ refreshToken }, 'token-for-user-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'active', scopes: [...GOOGLE_SCOPES] });

    const row = saved.get('user-1');
    expect(row?.scopes).toEqual([...GOOGLE_SCOPES]);
    expect(row?.refreshTokenEncrypted).not.toContain(refreshToken);
    expect(row?.refreshTokenEncrypted).toMatch(/^v1\./);
    expect(decrypt(row!.refreshTokenEncrypted, key)).toBe(refreshToken);
  });

  it('never echoes the token back', async () => {
    const res = await connect({ refreshToken }, 'token-for-user-1');
    expect(await res.text()).not.toContain(refreshToken);
  });
});

describe('CORS', () => {
  it('answers the preflight for the web app', async () => {
    const res = await routes.request('/connections/google', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://daybrief-web.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://daybrief-web.vercel.app');
    expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/authorization/i);
  });

  it('does not allow other origins', async () => {
    const res = await routes.request('/health', { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
