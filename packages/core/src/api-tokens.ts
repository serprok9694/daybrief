/**
 * Personal API tokens for Apple Shortcuts: `dbf_` + 32 random bytes in base64url (43
 * characters). Only a SHA-256 hash and the last 4 characters are stored; the full token is
 * shown once, when it is created. A token opens `POST /ideas` and nothing else.
 * Tokens are generated in apps/api (Node crypto); this module only knows their shape.
 */
export const API_TOKEN_PREFIX = 'dbf_';
export const API_TOKEN_BYTES = 32;
/** Active (not revoked) tokens per user. */
export const API_TOKEN_LIMIT = 10;
export const API_TOKEN_NAME_MAX_LENGTH = 100;

const TOKEN_PATTERN = /^dbf_[A-Za-z0-9_-]{43}$/;

/** A token row as settings list it; never the hash. */
export interface ApiToken {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Whether a bearer credential claims to be an API token (rather than a Supabase JWT). */
export function isApiTokenLike(credential: string): boolean {
  return credential.startsWith(API_TOKEN_PREFIX);
}

/** The token if `value` is well-formed, otherwise null. */
export function parseApiToken(value: string): string | null {
  return TOKEN_PATTERN.test(value) ? value : null;
}

export function apiTokenLast4(token: string): string {
  return token.slice(-4);
}

/** Validates the name given to a new token (`POST /tokens`); returns it trimmed or null. */
export function parseApiTokenName(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name } = value as Record<string, unknown>;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed === '' || [...trimmed].length > API_TOKEN_NAME_MAX_LENGTH) return null;
  return trimmed;
}
