import { Hono } from 'hono';

export const app = new Hono().get('/health', (c) => c.json({ ok: true }));

/** Route types for the typed RPC client (`hc<AppType>`) in apps/app. */
export type AppType = typeof app;
