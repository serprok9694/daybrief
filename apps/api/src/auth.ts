import { isApiTokenLike, parseApiToken } from '@daybrief/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Verifies a Supabase access token and returns the user id (`sub`). Throws if invalid. */
export type TokenVerifier = (token: string) => Promise<string>;

export type AuthVariables = { userId: string };

/**
 * Supabase signs access tokens with asymmetric JWT signing keys (ES256); the public keys
 * are served at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and cached by jose.
 */
export function supabaseTokenVerifier(
  supabaseUrl: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(
    new URL('/auth/v1/.well-known/jwks.json', supabaseUrl),
  ),
): TokenVerifier {
  const issuer = new URL('/auth/v1', supabaseUrl).href;
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: 'authenticated' });
    if (!payload.sub) throw new Error('Token has no subject');
    return payload.sub;
  };
}

const bearer = (header: string | undefined) => /^Bearer (\S+)$/i.exec(header ?? '')?.[1];

/** The user id of a Supabase access token, or null if it does not verify. */
async function sessionUser(verify: () => TokenVerifier, credential: string) {
  // Outside the try: missing config is a server error, not a bad token.
  const verifyToken = verify();
  try {
    return await verifyToken(credential);
  } catch {
    return null;
  }
}

/** Requires `Authorization: Bearer <Supabase access token>`; sets `c.var.userId`. */
export function requireAuth(verify: () => TokenVerifier) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const credential = bearer(c.req.header('Authorization'));
    const userId = credential && (await sessionUser(verify, credential));
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', userId);
    await next();
  });
}

/**
 * Looks up an active API token by its SHA-256 hash and records its use; returns the owner
 * and the stored hash, or null for an unknown or revoked token.
 */
export type ApiTokenLookup = (
  tokenHash: string,
) => Promise<{ userId: string; tokenHash: string } | null>;

export type IdeaAuthVariables = AuthVariables & { via: 'session' | 'api_token' };

/**
 * `POST /ideas` only: accepts a Supabase access token (command bar) or a personal API token
 * `dbf_…` (Shortcuts). Sets `c.var.userId` and `c.var.via`. Every other route uses
 * `requireAuth`, where an API token fails JWT verification and gets 401.
 */
export function requireAuthOrApiToken(
  verify: () => TokenVerifier,
  lookup: ApiTokenLookup,
  hash: (token: string) => string,
) {
  return createMiddleware<{ Variables: IdeaAuthVariables }>(async (c, next) => {
    const credential = bearer(c.req.header('Authorization'));
    if (!credential) return c.json({ error: 'unauthorized' }, 401);
    if (!isApiTokenLike(credential)) {
      const userId = await sessionUser(verify, credential);
      if (!userId) return c.json({ error: 'unauthorized' }, 401);
      c.set('userId', userId);
      c.set('via', 'session');
      return next();
    }
    const token = parseApiToken(credential);
    if (!token) return c.json({ error: 'unauthorized' }, 401);
    const tokenHash = hash(token);
    const found = await lookup(tokenHash);
    // The lookup is by hash already; the constant-time compare makes sure the row really
    // is this token without the comparison itself leaking anything.
    if (!found || !secretMatches(tokenHash, found.tokenHash)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('userId', found.userId);
    c.set('via', 'api_token');
    await next();
  });
}

/**
 * Constant-time check of a shared secret (`x-sync-secret`). Both sides are hashed first,
 * so neither the content nor the length of the expected value leaks through timing.
 */
export function secretMatches(given: string | undefined, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given ?? ''), digest(expected)) && given !== undefined;
}
