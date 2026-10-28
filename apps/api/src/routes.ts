import {
  GOOGLE_SCOPES,
  parseProfilePatch,
  type ProfilePatch,
  type TodayEvents,
} from '@daybrief/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { requireAuth, secretMatches } from './auth';
import { allowedOrigin } from './cors';
import { encrypt } from './crypto';
import { liveDeps, type Deps } from './deps';
import { eventsForToday } from './events';
import { syncAllCalendars, syncCalendar } from './sync';

export function createRoutes(deps: Deps) {
  /** Today's cached events in the user's zone (UTC until the client reports one). */
  const todayEvents = async (userId: string): Promise<TodayEvents> => {
    const [profile, events, state] = await Promise.all([
      deps.getProfile(userId),
      deps.getCalendarEvents(userId),
      deps.getCalendarSyncState(userId),
    ]);
    return {
      events: eventsForToday(events, profile?.timezone ?? 'UTC', deps.now()),
      syncedAt: state.syncedAt,
      error: state.error,
    };
  };

  return (
    new Hono()
      .use('*', cors({ origin: allowedOrigin, maxAge: 600 }))
      .get('/health', (c) => c.json({ ok: true }))
      .get('/me', requireAuth(deps.verifyToken), async (c) => {
        const profile = await deps.getProfile(c.var.userId);
        if (!profile) return c.json({ error: 'not_found' }, 404);
        return c.json(profile, 200);
      })
      // Settings: language, theme, background scene and the time zone the client reports.
      .patch(
        '/me',
        requireAuth(deps.verifyToken),
        // Typed for the RPC client; the value itself is untrusted until parsed.
        validator('json', (value: ProfilePatch, c) => {
          const patch = parseProfilePatch(value);
          if (!patch) return c.json({ error: 'invalid_request' }, 400);
          return patch;
        }),
        async (c) => {
          const profile = await deps.updateProfile(c.var.userId, c.req.valid('json'));
          if (!profile) return c.json({ error: 'not_found' }, 404);
          return c.json(profile, 200);
        },
      )
      .get('/connections/google', requireAuth(deps.verifyToken), async (c) => {
        const connection = await deps.getGoogleConnection(c.var.userId);
        return c.json(connection, 200);
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
      .get('/events/today', requireAuth(deps.verifyToken), async (c) =>
        c.json(await todayEvents(c.var.userId), 200),
      )
      // "Refresh" in the events widget. At most once per 30 s per user; a throttled or
      // failed sync still answers with the cached data (`sync` says what happened).
      .post('/sync/calendar', requireAuth(deps.verifyToken), async (c) => {
        const sync = await syncCalendar(c.var.userId, deps);
        return c.json({ ...(await todayEvents(c.var.userId)), sync }, 200);
      })
      // Background sync, called by pg_cron (M1/T3). Answers with counts only.
      .post('/internal/sync', async (c) => {
        const secret = deps.syncSecret();
        if (!secret) return c.json({ error: 'sync_not_configured' }, 503);
        if (!secretMatches(c.req.header('x-sync-secret'), secret)) {
          return c.json({ error: 'unauthorized' }, 401);
        }
        return c.json(await syncAllCalendars(deps), 200);
      })
  );
}

export const routes = createRoutes(liveDeps);
