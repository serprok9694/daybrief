// Local dev server. On Vercel the app is served from src/index.ts instead.
import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`daybrief api on http://localhost:${info.port}`);
});
