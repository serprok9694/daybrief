// The Google tokens in a Supabase session (provider_token, provider_refresh_token) are only
// needed once, right after sign-in, to hand the refresh token to the API (M0/T6). This
// storage wrapper drops them before supabase-js persists the session, so they never sit in
// localStorage / SQLite on the device.

const PROVIDER_FIELDS = ['provider_token', 'provider_refresh_token'] as const;

/** The subset of Web Storage that supabase-js uses (sync or async). */
export interface AuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/** Removes provider tokens from a stored session; any other value passes through unchanged. */
export function stripProviderTokens(value: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return value; // e.g. the PKCE code verifier
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return value;
  const record = parsed as Record<string, unknown>;
  if (!PROVIDER_FIELDS.some((field) => field in record)) return value;
  const rest = { ...record };
  for (const field of PROVIDER_FIELDS) delete rest[field];
  return JSON.stringify(rest);
}

export function withoutProviderTokens(storage: AuthStorage): AuthStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, stripProviderTokens(value)),
    removeItem: (key) => storage.removeItem(key),
  };
}
