import { describe, expect, it } from 'vitest';
import { fakeFetch, queryOf } from './test-fetch';
import { GOOGLE_TOKEN_URL, refreshAccessToken } from './token';

const REFRESH = '1//0refresh-token-secret';
const client = (fetch: ReturnType<typeof fakeFetch>) => ({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  fetch,
});

describe('refreshAccessToken', () => {
  it('posts the refresh grant as a form and returns the access token', async () => {
    const fetch = fakeFetch({
      status: 200,
      body: {
        access_token: 'ya29.a0AfH6SMexample',
        expires_in: 3599,
        scope:
          'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
        token_type: 'Bearer',
      },
    });

    const result = await refreshAccessToken(REFRESH, client(fetch));

    expect(result).toEqual({
      ok: true,
      value: { accessToken: 'ya29.a0AfH6SMexample', expiresIn: 3599 },
    });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(init.method).toBe('POST');
    expect(init.headers?.['content-type']).toBe('application/x-www-form-urlencoded');
    expect(queryOf(`?${init.body}`)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: REFRESH,
      client_id: 'client-id',
      client_secret: 'client-secret',
    });
  });

  it('invalid_grant → revoked', async () => {
    const fetch = fakeFetch({
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
    });
    expect(await refreshAccessToken(REFRESH, client(fetch))).toEqual({
      ok: false,
      error: { kind: 'revoked', status: 400, message: 'Token endpoint: invalid_grant' },
    });
  });

  it.each([
    [
      'other OAuth error',
      { status: 401, body: { error: 'invalid_client', error_description: 'Unauthorized' } },
      401,
    ],
    ['server error', { status: 503, body: 'Service Unavailable' }, 503],
    ['200 without a token', { status: 200, body: { token_type: 'Bearer' } }, 200],
    ['network failure', new TypeError('fetch failed'), null],
  ] as const)('%s → error', async (_, response, status) => {
    const result = await refreshAccessToken(REFRESH, client(fakeFetch(response)));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('error');
      expect(result.error.status).toBe(status);
    }
  });

  it('error messages never contain the tokens or the client secret', async () => {
    const responses = [
      { status: 400, body: { error: 'invalid_grant' } },
      { status: 400, body: { error: 'invalid_request' } },
      { status: 500, body: {} },
      new TypeError(`fetch failed: ${REFRESH}`),
    ];
    for (const response of responses) {
      const result = await refreshAccessToken(REFRESH, client(fakeFetch(response)));
      expect(JSON.stringify(result)).not.toMatch(/refresh-token-secret|client-secret/);
    }
  });
});
