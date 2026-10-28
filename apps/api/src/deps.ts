import type { FetchLike } from '@daybrief/connectors';
import {
  PROFILE_COLUMNS,
  profileFromRow,
  type CalendarEvent,
  type Database,
  type GoogleConnectionStatus,
  type Profile,
  type ProfilePatch,
} from '@daybrief/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTokenVerifier, type TokenVerifier } from './auth';
import { parseKey } from './crypto';
import { CALENDAR_EVENT_COLUMNS, eventFromRow, eventToRow } from './events';
import type { SyncDeps } from './sync';

/** What routes need from the outside world; tests pass fakes. */
export interface Deps extends SyncDeps {
  verifyToken: () => TokenVerifier;
  getProfile: (userId: string) => Promise<Profile | null>;
  /** Applies a validated settings patch; null when the profile does not exist. */
  updateProfile: (userId: string, patch: ProfilePatch) => Promise<Profile | null>;
  /** Status of the Calendar + Tasks connection; `none` when the user never connected. */
  getGoogleConnection: (userId: string) => Promise<GoogleConnectionView>;
  /** AES-256-GCM key for Google refresh tokens (`TOKEN_ENCRYPTION_KEY`). */
  tokenKey: () => Buffer;
  /** Creates or replaces the user's Google connection with status `active`. */
  saveGoogleConnection: (userId: string, connection: GoogleConnectionInput) => Promise<void>;
  /** `SYNC_SECRET` for `POST /internal/sync`; undefined until it is configured. */
  syncSecret: () => string | undefined;
  /** All cached events of the user (the sync window). */
  getCalendarEvents: (userId: string) => Promise<CalendarEvent[]>;
  getCalendarSyncState: (userId: string) => Promise<SyncStateView>;
}

export interface GoogleConnectionView {
  status: GoogleConnectionStatus;
  scopes: string[];
}

export interface GoogleConnectionInput {
  scopes: string[];
  /** Output of `encrypt`; the plaintext token never reaches the data layer. */
  refreshTokenEncrypted: string;
}

export interface SyncStateView {
  syncedAt: string | null;
  error: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Per-request timeout for Google calls, well under the per-user sync timeout. */
const GOOGLE_FETCH_TIMEOUT_MS = 10_000;

const googleFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS) });

// Built on first use so /health works without Supabase env.
let verifier: TokenVerifier | undefined;
let admin: SupabaseClient<Database> | undefined;
let key: Buffer | undefined;

/** Service-role client: bypasses RLS, so every query must filter by user. */
function adminClient(): SupabaseClient<Database> {
  admin ??= createClient<Database>(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export const liveDeps: Deps = {
  verifyToken: () => (verifier ??= supabaseTokenVerifier(requireEnv('SUPABASE_URL'))),
  async getProfile(userId) {
    const { data, error } = await adminClient()
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data && profileFromRow(data);
  },
  async updateProfile(userId, patch) {
    const { data, error } = await adminClient()
      .from('profiles')
      // ProfilePatch keys are the column names (locale, theme, scene, timezone).
      .update(patch)
      .eq('user_id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return data && profileFromRow(data);
  },
  async getGoogleConnection(userId) {
    // Never select refresh_token_encrypted here: the status is all the client needs.
    const { data, error } = await adminClient()
      .from('google_connections')
      .select('status, scopes')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load Google connection: ${error.message}`);
    return data ?? { status: 'none', scopes: [] };
  },
  tokenKey: () => (key ??= parseKey(process.env.TOKEN_ENCRYPTION_KEY)),
  async saveGoogleConnection(userId, { scopes, refreshTokenEncrypted }) {
    const { error } = await adminClient().from('google_connections').upsert(
      {
        user_id: userId,
        scopes,
        refresh_token_encrypted: refreshTokenEncrypted,
        status: 'active',
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(`Failed to save Google connection: ${error.message}`);
  },
  // Empty counts as unset: the route answers 503 rather than accept an empty header.
  syncSecret: () => process.env.SYNC_SECRET || undefined,
  async getCalendarEvents(userId) {
    const { data, error } = await adminClient()
      .from('calendar_events')
      .select(CALENDAR_EVENT_COLUMNS)
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to load calendar events: ${error.message}`);
    return data.map(eventFromRow);
  },
  async getCalendarSyncState(userId) {
    const { data, error } = await adminClient()
      .from('sync_state')
      .select('synced_at, error')
      .eq('user_id', userId)
      .eq('source', 'calendar')
      .maybeSingle();
    if (error) throw new Error(`Failed to load sync state: ${error.message}`);
    // Normalise PostgREST's `+00:00` to `Z`, like the events.
    const syncedAt = data?.synced_at ? new Date(data.synced_at).toISOString() : null;
    return { syncedAt, error: data?.error ?? null };
  },

  // Calendar sync (SyncDeps) ---------------------------------------------------------------
  now: () => new Date(),
  googleClient: () => ({
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    fetch: googleFetch,
  }),
  async getSyncSource(userId) {
    const [connection, profile] = await Promise.all([
      adminClient()
        .from('google_connections')
        .select('refresh_token_encrypted, status')
        .eq('user_id', userId)
        .maybeSingle(),
      adminClient().from('profiles').select('timezone').eq('user_id', userId).maybeSingle(),
    ]);
    if (connection.error) {
      throw new Error(`Failed to load Google connection: ${connection.error.message}`);
    }
    if (profile.error) throw new Error(`Failed to load profile: ${profile.error.message}`);
    if (!connection.data) return null;
    return {
      refreshTokenEncrypted: connection.data.refresh_token_encrypted,
      status: connection.data.status,
      timezone: profile.data?.timezone ?? null,
    };
  },
  async tryLockSync(userId, seconds) {
    const { data, error } = await adminClient().rpc('try_lock_sync', {
      p_user_id: userId,
      p_source: 'calendar',
      p_seconds: seconds,
    });
    if (error) throw new Error(`Failed to lock sync: ${error.message}`);
    // null when another sync holds the lock.
    return data === true;
  },
  async saveCalendarSync(userId, events, syncedAt) {
    const { error } = await adminClient().rpc('save_calendar_sync', {
      p_user_id: userId,
      p_events: events.map(eventToRow),
      p_synced_at: syncedAt.toISOString(),
    });
    if (error) throw new Error(`Failed to save calendar sync: ${error.message}`);
  },
  async failCalendarSync(userId, message, status) {
    const { error } = await adminClient().rpc('fail_calendar_sync', {
      p_user_id: userId,
      p_error: message,
      p_status: status,
    });
    if (error) throw new Error(`Failed to record calendar sync error: ${error.message}`);
  },
  async listSyncUserIds() {
    // `error` is usually transient (Google down), so the background sync keeps trying;
    // `revoked` needs a new sign-in first.
    const { data, error } = await adminClient()
      .from('google_connections')
      .select('user_id')
      .in('status', ['active', 'error']);
    if (error) throw new Error(`Failed to list Google connections: ${error.message}`);
    return data.map((row) => row.user_id);
  },
};
