// Native: a SQLite-backed localStorage polyfill (no-op on web, which has its own).
import 'expo-sqlite/localStorage/install';

import type { Database } from '@daybrief/core';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import { withoutProviderTokens } from './provider-tokens';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // PKCE: the OAuth redirect carries a one-time ?code, exchanged in auth/google.ts.
    flowType: 'pkce',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storage: withoutProviderTokens(localStorage),
  },
});

// Native apps don't get the tab-visibility events supabase-js uses on web to pause refreshes.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
