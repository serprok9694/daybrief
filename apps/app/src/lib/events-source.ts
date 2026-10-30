import type { GoogleConnectionStatus, TodayEvents } from '@daybrief/core';
import type { SyncOutcome } from '../dashboard/events';
import { api, bearer } from './api';

/** Where the events widget reads from: the API, or the dev mock. */
export interface EventsSource {
  /** `GET /events/today`. */
  today(): Promise<TodayEvents>;
  /** `POST /sync/calendar`: syncs (at most every 30 s) and answers with fresh data. */
  sync(): Promise<TodayEvents & { sync: SyncOutcome }>;
  /** Status of the Calendar + Tasks connection. */
  connection(): Promise<GoogleConnectionStatus>;
}

async function json<T>(res: { ok: boolean; status: number; json(): Promise<T> }): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** The API with the session's current access token (it refreshes every hour). */
export function apiEventsSource(accessToken: () => Promise<string>): EventsSource {
  return {
    today: async () => json(await api.events.today.$get({}, bearer(await accessToken()))),
    sync: async () => json(await api.sync.calendar.$post({}, bearer(await accessToken()))),
    connection: async () =>
      (await json(await api.connections.google.$get({}, bearer(await accessToken())))).status,
  };
}
