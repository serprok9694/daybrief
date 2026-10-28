import { Hono } from 'hono';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { requireAuth, secretMatches, supabaseTokenVerifier, type TokenVerifier } from './auth';

const SUPABASE_URL = 'https://project.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const USER_ID = '6f1d1c1e-0000-4000-8000-000000000001';

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let verifier: TokenVerifier;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('ES256')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' };
  verifier = supabaseTokenVerifier(SUPABASE_URL, createLocalJWKSet({ keys: [jwk] }));
});

function token(
  overrides: { key?: CryptoKey; iss?: string; aud?: string; exp?: string | number } = {},
) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(USER_ID)
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? '1h')
    .sign(overrides.key ?? signingKey);
}

function app() {
  return new Hono()
    .use(requireAuth(() => verifier))
    .get('/whoami', (c) => c.json({ userId: c.var.userId }));
}

function request(authorization?: string) {
  return app().request('/whoami', {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe('requireAuth', () => {
  it('accepts a valid Supabase token and exposes the user id', async () => {
    const res = await request(`Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: USER_ID });
  });

  it('rejects a missing or malformed header', async () => {
    expect((await request()).status).toBe(401);
    expect((await request(await token())).status).toBe(401);
    expect((await request('Bearer not-a-jwt')).status).toBe(401);
  });

  it('rejects a token signed with another key', async () => {
    expect((await request(`Bearer ${await token({ key: otherKey })}`)).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect((await request(`Bearer ${await token({ exp })}`)).status).toBe(401);
  });

  it('rejects a wrong issuer or audience', async () => {
    const iss = 'https://other.supabase.co/auth/v1';
    expect((await request(`Bearer ${await token({ iss })}`)).status).toBe(401);
    expect((await request(`Bearer ${await token({ aud: 'anon' })}`)).status).toBe(401);
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await token()).split('.');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', iss: ISSUER, aud: 'authenticated' }),
    ).toString('base64url');
    expect((await request(`Bearer ${header}.${payload}.${signature}`)).status).toBe(401);
  });
});

describe('secretMatches', () => {
  it('accepts only the exact secret', () => {
    expect(secretMatches('s3cret', 's3cret')).toBe(true);
    expect(secretMatches('s3cre', 's3cret')).toBe(false);
    expect(secretMatches('s3cret ', 's3cret')).toBe(false);
    expect(secretMatches('', 's3cret')).toBe(false);
    expect(secretMatches(undefined, 's3cret')).toBe(false);
  });
});
