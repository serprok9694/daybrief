import { Hono } from 'hono';

export const routes = new Hono().get('/health', (c) => c.json({ ok: true }));
