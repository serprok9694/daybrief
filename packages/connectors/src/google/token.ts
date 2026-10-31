import {
  fail,
  formEncode,
  isRecord,
  ok,
  readJson,
  str,
  type FetchLike,
  type GoogleResult,
} from './http';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type OAuthClient = { clientId: string; clientSecret: string; fetch: FetchLike };

/** Short-lived access token. Used for one sync and never stored (M1 decisions). */
export type AccessToken = { accessToken: string; expiresIn: number };

/**
 * Exchange the stored refresh token for an access token. `invalid_grant` (revoked or
 * expired grant) → `revoked`; anything else → `error`.
 */
export async function refreshAccessToken(
  refreshToken: string,
  { clientId, clientSecret, fetch }: OAuthClient,
): Promise<GoogleResult<AccessToken>> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: formEncode({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  } catch {
    return fail('error', null, 'Token endpoint: network error');
  }

  const body = await readJson(response);
  if (!response.ok) {
    // RFC 6749 5.2: { "error": "invalid_grant", "error_description": "..." }.
    const code = isRecord(body) ? str(body.error) : undefined;
    if (code === 'invalid_grant')
      return fail('revoked', response.status, 'Token endpoint: invalid_grant');
    return fail(
      'error',
      response.status,
      `Token endpoint ${response.status}${code ? ` ${code}` : ''}`,
    );
  }

  const accessToken = isRecord(body) ? str(body.access_token) : undefined;
  const expiresIn =
    isRecord(body) && typeof body.expires_in === 'number' ? body.expires_in : undefined;
  if (!accessToken || expiresIn === undefined) {
    return fail('error', response.status, 'Token endpoint: unexpected response');
  }
  return ok({ accessToken, expiresIn });
}
