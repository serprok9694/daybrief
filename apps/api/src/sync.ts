import {
  listEvents,
  listSelectedCalendars,
  refreshAccessToken,
  type GoogleError,
  type OAuthClient,
} from '@daybrief/connectors';
import { dayRange, type CalendarEvent, type TimeRange } from '@daybrief/core';
import { decrypt } from './crypto';

/** Manual refresh at most this often per user; also keeps two syncs from overlapping. */
export const SYNC_LOCK_SECONDS = 30;
/** `POST /internal/sync` gives up on a user after this long and moves on. */
export const USER_SYNC_TIMEOUT_MS = 20_000;

export interface SyncSource {
  /** Output of `encrypt`; decrypted only for the token exchange. */
  refreshTokenEncrypted: string;
  status: 'active' | 'revoked' | 'error';
  /** IANA zone from `profiles.timezone`; null until the client reports it. */
  timezone: string | null;
}

/** What the calendar sync needs from the outside world; tests pass fakes. */
export interface SyncDeps {
  now: () => Date;
  tokenKey: () => Buffer;
  /** `GOOGLE_CLIENT_ID/SECRET` and the `fetch` used for every Google call. */
  googleClient: () => OAuthClient;
  /** The user's Google connection; null when they never connected. */
  getSyncSource: (userId: string) => Promise<SyncSource | null>;
  /** Takes the calendar sync lock for `seconds`; false when it is held. */
  tryLockSync: (userId: string, seconds: number) => Promise<boolean>;
  /** In one transaction: replace all stored events, clear the error, mark `active`. */
  saveCalendarSync: (userId: string, events: CalendarEvent[], syncedAt: Date) => Promise<void>;
  /** Records the error (no tokens in it) and the new connection status. */
  failCalendarSync: (userId: string, error: string, status: GoogleError['kind']) => Promise<void>;
  /** Users the background sync visits: connections that are not revoked. */
  listSyncUserIds: () => Promise<string[]>;
}

export type SyncOutcome = 'synced' | 'throttled' | 'revoked' | 'error' | 'not_connected';

/** Yesterday, today and tomorrow in the user's zone (M1 decisions, "Окно синхронизации"). */
export function syncWindow(timeZone: string, now: Date): TimeRange {
  return { start: dayRange(timeZone, now, -1).start, end: dayRange(timeZone, now, 1).end };
}

/**
 * Pulls the user's selected calendars for the sync window and replaces the stored events.
 * A revoked grant marks the connection `revoked`; any other Google failure marks it
 * `error` and keeps the cached events. Throws only on database errors.
 */
export async function syncCalendar(userId: string, deps: SyncDeps): Promise<SyncOutcome> {
  const source = await deps.getSyncSource(userId);
  if (!source) return 'not_connected';
  // A revoked grant can't recover until the user signs in again (which sets `active`).
  if (source.status === 'revoked') return 'revoked';
  if (!(await deps.tryLockSync(userId, SYNC_LOCK_SECONDS))) return 'throttled';

  const fail = async (error: GoogleError['kind'], message: string) => {
    await deps.failCalendarSync(userId, message, error);
    return error;
  };

  let refreshToken: string;
  try {
    refreshToken = decrypt(source.refreshTokenEncrypted, deps.tokenKey());
  } catch {
    return fail('error', 'Stored Google token could not be decrypted');
  }

  const client = deps.googleClient();
  const token = await refreshAccessToken(refreshToken, client);
  if (!token.ok) return fail(token.error.kind, token.error.message);
  const { accessToken } = token.value;

  const calendars = await listSelectedCalendars(accessToken, client);
  if (!calendars.ok) return fail(calendars.error.kind, calendars.error.message);

  const now = deps.now();
  const window = syncWindow(source.timezone ?? 'UTC', now);
  const results = await Promise.all(
    calendars.value.map((calendar) => listEvents(accessToken, calendar.id, window, client)),
  );
  const events: CalendarEvent[] = [];
  for (const result of results) {
    // All or nothing: a partial result would delete the failed calendar's events.
    if (!result.ok) return fail(result.error.kind, result.error.message);
    events.push(...result.value);
  }

  await deps.saveCalendarSync(userId, events, now);
  return 'synced';
}

export type SyncSummary = { users: number } & Record<SyncOutcome | 'timeout' | 'failed', number>;

/**
 * Background sync (`POST /internal/sync`): every connected user, one at a time, each with
 * a timeout. Returns counts only; failures are logged without tokens.
 */
export async function syncAllCalendars(
  deps: SyncDeps,
  timeoutMs = USER_SYNC_TIMEOUT_MS,
): Promise<SyncSummary> {
  const userIds = await deps.listSyncUserIds();
  const summary: SyncSummary = {
    users: userIds.length,
    synced: 0,
    throttled: 0,
    revoked: 0,
    error: 0,
    not_connected: 0,
    timeout: 0,
    failed: 0,
  };
  for (const userId of userIds) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    // A timed-out sync keeps running in the background; its lock stops the next one from
    // overlapping it. Its late rejection must not become an unhandled one.
    const run = syncCalendar(userId, deps);
    run.catch(() => undefined);
    try {
      const outcome = await Promise.race([run, timeout]);
      summary[outcome] += 1;
      if (outcome === 'timeout') console.error(`calendar sync timed out for user ${userId}`);
    } catch (error) {
      summary.failed += 1;
      console.error(
        `calendar sync failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return summary;
}
