import type { Profile } from '@daybrief/core';
import { describe, expect, it } from 'vitest';
import { createRoutes } from './routes';

const profile: Profile = {
  userId: 'user-1',
  displayName: 'Alice',
  locale: 'ru',
  theme: 'auto',
  scene: 'auto',
  timezone: 'Europe/Berlin',
};

const routes = createRoutes({
  // Accepts tokens of the form "token-for-<userId>".
  verifyToken: () => async (token) => {
    if (!token.startsWith('token-for-')) throw new Error('bad token');
    return token.slice('token-for-'.length);
  },
  getProfile: async (userId) => (userId === profile.userId ? profile : null),
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
