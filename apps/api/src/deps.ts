import { PROFILE_COLUMNS, profileFromRow, type Database, type Profile } from '@daybrief/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseTokenVerifier, type TokenVerifier } from './auth';

/** What routes need from the outside world; tests pass fakes. */
export interface Deps {
  verifyToken: () => TokenVerifier;
  getProfile: (userId: string) => Promise<Profile | null>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Built on first use so /health works without Supabase env.
let verifier: TokenVerifier | undefined;
let admin: SupabaseClient<Database> | undefined;

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
};
