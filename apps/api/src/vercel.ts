// Vercel function handler. Bundled into one file by scripts/build-vercel.mjs.
import { getRequestListener } from '@hono/node-server';
import app from './index';

export default getRequestListener(app.fetch);
