import { PROFILE_COLUMNS, profileFromRow, type Database, type Profile } from '@daybrief/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTokenVerifier, type TokenVerifier } from './auth';
import { parseKey } from './crypto';

/** What routes need from the outside world; tests pass fakes. */
export interface Deps {
  verifyToken: () => TokenVerifier;
  getProfile: (userId: string) => Promise<Profile | null>;
  /** AES-256-GCM key for Google refresh tokens (`TOKEN_ENCRYPTION_KEY`). */
  tokenKey: () => Buffer;
  /** Creates or replaces the user's Google connection with status `active`. */
  saveGoogleConnection: (userId: string, connection: GoogleConnectionInput) => Promise<void>;
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
