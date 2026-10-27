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

/** Requires `Authorization: Bearer <Supabase access token>`; sets `c.var.userId`. */
export function requireAuth(verify: () => TokenVerifier) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const match = /^Bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '');
    if (!match) return c.json({ error: 'unauthorized' }, 401);
    // Outside the try: missing config is a server error, not a bad token.
    const verifyToken = verify();
    let userId: string;
    try {
      userId = await verifyToken(match[1]!);
    } catch {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('userId', userId);
    await next();
  });
}
