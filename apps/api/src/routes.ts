import { Hono } from 'hono';
import { requireAuth } from './auth';
import { liveDeps, type Deps } from './deps';

export function createRoutes(deps: Deps) {
  return new Hono()
    .get('/health', (c) => c.json({ ok: true }))
    .get('/me', requireAuth(deps.verifyToken), async (c) => {
      const profile = await deps.getProfile(c.var.userId);
      if (!profile) return c.json({ error: 'not_found' }, 404);
      return c.json(profile, 200);
    });
}

export const routes = createRoutes(liveDeps);
