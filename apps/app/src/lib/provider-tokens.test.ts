import { describe, expect, it } from 'vitest';
import { stripProviderTokens, withoutProviderTokens } from './provider-tokens';

const session = {
  access_token: 'jwt',
  refresh_token: 'supabase-refresh',
  expires_at: 1,
  provider_token: 'google-access',
  provider_refresh_token: 'google-refresh',
  user: { id: 'user-1' },
};

describe('stripProviderTokens', () => {
  it('removes the Google tokens and keeps the Supabase session', () => {
    const stored = JSON.parse(stripProviderTokens(JSON.stringify(session)));
    expect(stored).toEqual({
      access_token: 'jwt',
      refresh_token: 'supabase-refresh',
      expires_at: 1,
      user: { id: 'user-1' },
    });
  });

  it.each(['plain-code-verifier', '"quoted"', '[1,2]', 'null', '{"a":1}'])(
    'leaves other values untouched: %s',
    (value) => {
      expect(stripProviderTokens(value)).toBe(value);
    },
  );
});

describe('withoutProviderTokens', () => {
  it('never writes provider tokens to the underlying storage', async () => {
    const data = new Map<string, string>();
    const storage = withoutProviderTokens({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    });
    await storage.setItem('sb-ref-auth-token', JSON.stringify(session));
    const raw = data.get('sb-ref-auth-token')!;
    expect(raw).not.toContain('google-refresh');
    expect(raw).not.toContain('google-access');
    expect(await storage.getItem('sb-ref-auth-token')).toBe(raw);
    await storage.removeItem('sb-ref-auth-token');
    expect(data.size).toBe(0);
  });
});
