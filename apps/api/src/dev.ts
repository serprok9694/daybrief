// Local dev server. On Vercel the app runs from the bundle built by scripts/build-vercel.mjs.
import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`daybrief api on http://localhost:${info.port}`);
});
