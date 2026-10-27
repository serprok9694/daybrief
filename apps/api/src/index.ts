// Vercel entry point: the default export is the Hono app.
import { app } from './routes';

export type { AppType } from './routes';
export default app;
