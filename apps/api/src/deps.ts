import type { FetchLike } from '@daybrief/connectors';
import {
  PROFILE_COLUMNS,
  profileFromRow,
  type ApiToken,
  type CalendarEvent,
  type Database,
  type GoogleConnectionStatus,
  type Idea,
  type IdeaSource,
  type Profile,
  type ProfilePatch,
} from '@daybrief/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTokenVerifier, type ApiTokenLookup, type TokenVerifier } from './auth';
import { parseKey } from './crypto';
import { CALENDAR_EVENT_COLUMNS, eventFromRow, eventToRow } from './events';
import {
  API_TOKEN_COLUMNS,
  apiTokenFromRow,
  IDEA_COLUMNS,
  ideaFromRow,
  type IdeaOfTheDayDeps,
} from './ideas';
import type { SyncDeps } from './sync';

/** What routes need from the outside world; tests pass fakes. */
export interface Deps extends SyncDeps, IdeaOfTheDayDeps {
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
  /** Adds an idea or, for a duplicate (external id, or text hash among open ideas), returns
   * the existing one with `created: false`. */
  addIdea: (userId: string, idea: NewIdea) => Promise<{ idea: Idea; created: boolean }>;
  /** Sets "not now" or "done" on the user's own idea; false when there is no such idea. */
  updateIdea: (userId: string, ideaId: string, patch: IdeaPatch) => Promise<boolean>;
  useApiToken: ApiTokenLookup;
  /** The user's active tokens, oldest first. */
  listApiTokens: (userId: string) => Promise<ApiToken[]>;
  /** Null when the user already has `limit` active tokens. */
  createApiToken: (userId: string, token: NewApiToken, limit: number) => Promise<ApiToken | null>;
  /** Revokes the user's own token; false when there is no such token. */
  revokeApiToken: (userId: string, tokenId: string) => Promise<boolean>;
}

export interface NewIdea {
  text: string;
  source: IdeaSource;
  externalId: string | null;
  textHash: string;
}

export type IdeaPatch = { snoozedUntil: Date } | { doneAt: Date };

export interface NewApiToken {
  name: string;
  /** SHA-256 of the token; the token itself never reaches the data layer. */
  tokenHash: string;
  last4: string;
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

  // Ideas and API tokens ---------------------------------------------------------------------
  async addIdea(userId, { text, source, externalId, textHash }) {
    const { data, error } = await adminClient()
      .rpc('add_idea', {
        p_user_id: userId,
        p_text: text,
        p_source: source,
        p_text_hash: textHash,
        p_external_id: externalId ?? undefined,
      })
      .single();
    // Messages name the constraint, never the row: no idea text in logs.
    if (error) throw new Error(`Failed to add idea: ${error.message}`);
    const { created, ...row } = data;
    return { idea: ideaFromRow(row), created };
  },
  async getOpenIdeas(userId) {
    const { data, error } = await adminClient()
      .from('ideas')
      .select(IDEA_COLUMNS)
      .eq('user_id', userId)
      .is('done_at', null);
    if (error) throw new Error(`Failed to load ideas: ${error.message}`);
    return data.map(ideaFromRow);
  },
  async markIdeaShown(userId, ideaId, at) {
    const { error } = await adminClient()
      .from('ideas')
      .update({ last_shown_at: at.toISOString() })
      .eq('user_id', userId)
      .eq('id', ideaId);
    if (error) throw new Error(`Failed to mark idea shown: ${error.message}`);
  },
  async updateIdea(userId, ideaId, patch) {
    const { data, error } = await adminClient()
      .from('ideas')
      .update(
        'doneAt' in patch
          ? { done_at: patch.doneAt.toISOString() }
          : { snoozed_until: patch.snoozedUntil.toISOString() },
      )
      .eq('user_id', userId)
      .eq('id', ideaId)
      .select('id');
    if (error) throw new Error(`Failed to update idea: ${error.message}`);
    return data.length > 0;
  },
  async useApiToken(tokenHash) {
    const { data, error } = await adminClient()
      .rpc('use_api_token', { p_token_hash: tokenHash })
      .maybeSingle();
    if (error) throw new Error(`Failed to check API token: ${error.message}`);
    return data && { userId: data.user_id, tokenHash: data.token_hash };
  },
  async listApiTokens(userId) {
    const { data, error } = await adminClient()
      .from('api_tokens')
      .select(API_TOKEN_COLUMNS)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at');
    if (error) throw new Error(`Failed to load API tokens: ${error.message}`);
    return data.map(apiTokenFromRow);
  },
  async createApiToken(userId, { name, tokenHash, last4 }, limit) {
    const { data, error } = await adminClient()
      .rpc('create_api_token', {
        p_user_id: userId,
        p_name: name,
        p_token_hash: tokenHash,
        p_last4: last4,
        p_limit: limit,
      })
      .select(API_TOKEN_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Failed to create API token: ${error.message}`);
    return data && apiTokenFromRow(data);
  },
  async revokeApiToken(userId, tokenId) {
    const { data, error } = await adminClient()
      .from('api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', tokenId)
      .is('revoked_at', null)
      .select('id');
    if (error) throw new Error(`Failed to revoke API token: ${error.message}`);
    return data.length > 0;
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
