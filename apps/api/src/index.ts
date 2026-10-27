// Vercel entry point. Vercel's Hono detection requires this file to import 'hono'
// itself and default-export the app, so routes are mounted here rather than re-exported.
import { Hono } from 'hono';
import { routes } from './routes';

const app = new Hono().route('/', routes);

/** Route types for the typed RPC client (`hc<AppType>`) in apps/app. */
export type AppType = typeof app;
export default app;
