import {
  API_TOKEN_LIMIT,
  GOOGLE_SCOPES,
  IDEA_SNOOZE_DAYS,
  parseApiTokenName,
  parseIdeaInput,
  parseProfilePatch,
  type IdeaSource,
  type ProfilePatch,
  type TodayEvents,
} from '@daybrief/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { requireAuth, requireAuthOrApiToken, secretMatches } from './auth';
import { allowedOrigin } from './cors';
import { encrypt } from './crypto';
import { liveDeps, type Deps, type IdeaPatch } from './deps';
import { eventsForToday } from './events';
import { apiTokenHash, ideaOfTheDay, ideaTextHash, isUuid, newApiToken } from './ideas';
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

  const DAY_MS = 24 * 60 * 60 * 1000;
  /** "Not now" and "Done" on the idea of the day; answers with the next one. */
  const updateIdea = async (userId: string, ideaId: string, patch: IdeaPatch) => {
    if (!isUuid(ideaId) || !(await deps.updateIdea(userId, ideaId, patch))) return null;
    return { idea: await ideaOfTheDay(userId, deps) };
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
      // Ideas from the command bar (session) and from Apple Shortcuts (API token). The only
      // route an API token opens. Never log the body: idea text is private.
      .post(
        '/ideas',
        requireAuthOrApiToken(deps.verifyToken, deps.useApiToken, apiTokenHash),
        // Typed for the RPC client; the value itself is untrusted until parsed.
        validator(
          'json',
          (value: { text: string; source?: IdeaSource; externalId?: string | null }, c) => {
            const input = parseIdeaInput(value);
            if (typeof input === 'string') return c.json({ error: input }, 400);
            return input;
          },
        ),
        async (c) => {
          const { text, source, externalId } = c.req.valid('json');
          const { idea, created } = await deps.addIdea(c.var.userId, {
            text,
            source: source ?? (c.var.via === 'api_token' ? 'shortcut' : 'command'),
            externalId,
            textHash: ideaTextHash(text),
          });
          // A repeat is not an error: Shortcuts may resend, and the user sees the same idea.
          return c.json({ idea }, created ? 201 : 200);
        },
      )
      .get('/ideas/today', requireAuth(deps.verifyToken), async (c) =>
        c.json({ idea: await ideaOfTheDay(c.var.userId, deps) }, 200),
      )
      .post('/ideas/:id/snooze', requireAuth(deps.verifyToken), async (c) => {
        const snoozedUntil = new Date(deps.now().getTime() + IDEA_SNOOZE_DAYS * DAY_MS);
        const next = await updateIdea(c.var.userId, c.req.param('id'), { snoozedUntil });
        if (!next) return c.json({ error: 'not_found' }, 404);
        return c.json(next, 200);
      })
      .post('/ideas/:id/done', requireAuth(deps.verifyToken), async (c) => {
        const next = await updateIdea(c.var.userId, c.req.param('id'), { doneAt: deps.now() });
        if (!next) return c.json({ error: 'not_found' }, 404);
        return c.json(next, 200);
      })
      // Personal API tokens: managed with a session only, never with a token.
      .get('/tokens', requireAuth(deps.verifyToken), async (c) =>
        c.json({ tokens: await deps.listApiTokens(c.var.userId) }, 200),
      )
      .post(
        '/tokens',
        requireAuth(deps.verifyToken),
        validator('json', (value: { name: string }, c) => {
          const name = parseApiTokenName(value);
          if (name === null) return c.json({ error: 'invalid_request' }, 400);
          return { name };
        }),
        async (c) => {
          const { token, tokenHash, last4 } = newApiToken();
          const created = await deps.createApiToken(
            c.var.userId,
            { name: c.req.valid('json').name, tokenHash, last4 },
            API_TOKEN_LIMIT,
          );
          if (!created) return c.json({ error: 'token_limit', limit: API_TOKEN_LIMIT }, 409);
          // The only response that ever carries the full token.
          return c.json({ ...created, token }, 201);
        },
      )
      .delete('/tokens/:id', requireAuth(deps.verifyToken), async (c) => {
        const id = c.req.param('id');
        if (!isUuid(id) || !(await deps.revokeApiToken(c.var.userId, id))) {
          return c.json({ error: 'not_found' }, 404);
        }
        return c.body(null, 204);
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
