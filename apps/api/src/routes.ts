import { GOOGLE_SCOPES } from '@daybrief/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { requireAuth } from './auth';
import { allowedOrigin } from './cors';
import { encrypt } from './crypto';
import { liveDeps, type Deps } from './deps';

export function createRoutes(deps: Deps) {
  return (
    new Hono()
      .use('*', cors({ origin: allowedOrigin, maxAge: 600 }))
      .get('/health', (c) => c.json({ ok: true }))
      .get('/me', requireAuth(deps.verifyToken), async (c) => {
        const profile = await deps.getProfile(c.var.userId);
        if (!profile) return c.json({ error: 'not_found' }, 404);
        return c.json(profile, 200);
      })
      // Called by the app right after Google sign-in with the session's provider_refresh_token.
      // The token is encrypted here and is never logged or returned.
      .post(
        '/connections/google',
        requireAuth(deps.verifyToken),
        validator('json', (value: { refreshToken?: string } | null, c) => {
          // `null` and other non-objects are valid JSON too.
          const token = typeof value === 'object' ? value?.refreshToken : undefined;
          if (typeof token !== 'string' || token.trim() === '') {
            return c.json({ error: 'invalid_request' }, 400);
          }
          return { refreshToken: token };
        }),
        async (c) => {
          const { refreshToken } = c.req.valid('json');
          const scopes = [...GOOGLE_SCOPES];
          await deps.saveGoogleConnection(c.var.userId, {
            scopes,
            refreshTokenEncrypted: encrypt(refreshToken, deps.tokenKey()),
          });
          return c.json({ status: 'active' as const, scopes }, 200);
        },
      )
  );
}

export const routes = createRoutes(liveDeps);
