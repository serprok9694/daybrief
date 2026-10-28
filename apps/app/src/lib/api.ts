import type { AppType } from '@daybrief/api';
import { hc } from 'hono/client';
import { env } from './env';

/** Typed RPC client for apps/api. Pass the Supabase access token per call. */
export const api = hc<AppType>(env.apiUrl);

export const bearer = (accessToken: string) => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});
