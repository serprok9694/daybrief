import { GOOGLE_SCOPES } from '@daybrief/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { api, bearer } from '../lib/api';
import { supabase } from '../lib/supabase';

// Closes the auth popup on web if the redirect lands in one.
WebBrowser.maybeCompleteAuthSession();

/** Where Google (via Supabase) sends the user back with `?code=`. */
function redirectUrl(): string {
  return Platform.OS === 'web'
    ? `${window.location.origin}/auth/callback`
    : Linking.createURL('auth/callback');
}

/**
 * Starts Google sign-in. Web: navigates away and comes back to /auth/callback.
 * Native: runs the flow in an auth session and finishes it here.
 * Resolves `false` when the user closed the native auth session.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const native = Platform.OS !== 'web';
  const redirectTo = redirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES.join(' '),
      // offline + consent: Google returns a refresh token on every sign-in.
      queryParams: { access_type: 'offline', prompt: 'consent' },
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (!native) return true;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const { code, error: oauthError } = Linking.parse(result.url).queryParams ?? {};
  if (oauthError === 'access_denied') return false;
  if (typeof code !== 'string') throw new Error('Sign-in did not return a code');
  await completeSignIn(code);
  return true;
}

// The callback screen can mount twice (StrictMode, fast refresh); a code works only once.
const inflight = new Map<string, Promise<void>>();

/**
 * Exchanges the OAuth code for a session and hands Google's refresh token to the API, which
 * encrypts and stores it. The token is not kept anywhere on the client: the storage wrapper
 * in lib/supabase.ts drops it from the persisted session. If the API call fails the user is
 * signed out, so the next sign-in (prompt=consent) retries with a fresh token.
 */
export function completeSignIn(code: string): Promise<void> {
  let pending = inflight.get(code);
  if (!pending) {
    pending = exchangeAndConnect(code);
    inflight.set(code, pending);
  }
  return pending;
}

async function exchangeAndConnect(code: string): Promise<void> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  try {
    const refreshToken = data.session.provider_refresh_token;
    if (!refreshToken) throw new Error('Google did not return a refresh token');
    const res = await api.connections.google.$post(
      { json: { refreshToken } },
      bearer(data.session.access_token),
    );
    if (!res.ok) throw new Error(`Saving the Google connection failed: HTTP ${res.status}`);
  } catch (e) {
    await supabase.auth.signOut();
    throw e;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
