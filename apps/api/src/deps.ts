import {
  PROFILE_COLUMNS,
  profileFromRow,
  type Database,
  type GoogleConnectionStatus,
  type Profile,
  type ProfilePatch,
} from '@daybrief/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTokenVerifier, type TokenVerifier } from './auth';
import { parseKey } from './crypto';

/** What routes need from the outside world; tests pass fakes. */
export interface Deps {
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

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
};
