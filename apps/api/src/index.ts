import { Hono } from 'hono';
import { routes } from './routes';

const app = new Hono().route('/', routes);

/** Route types for the typed RPC client (`hc<AppType>`) in apps/app. */
export type AppType = typeof app;
export default app;
