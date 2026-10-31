/**
 * The slice of `fetch` the connector uses. The caller passes it in (global `fetch`, a
 * wrapper with a timeout, a fake in tests), so the connector never reaches the network
 * on its own.
 */
export type FetchLike = (
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type ConnectorDeps = { fetch: FetchLike };

/**
 * `revoked`: the user took access back or the refresh token expired; they need to sign in
 * again. `error`: anything else (Google down, quota, bad response). Messages never
 * contain tokens.
 */
export type GoogleError = { kind: 'revoked' | 'error'; status: number | null; message: string };

export type GoogleResult<T> = { ok: true; value: T } | { ok: false; error: GoogleError };

export const ok = <T>(value: T): GoogleResult<T> => ({ ok: true, value });
export const fail = (
  kind: GoogleError['kind'],
  status: number | null,
  message: string,
): GoogleResult<never> => ({
  ok: false,
  error: { kind, status, message },
});

export type Json = Record<string, unknown>;

export const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** `a=1&b=2`, skipping undefined values. Hand-rolled: URLSearchParams isn't in the ES lib. */
export function formEncode(params: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/** JSON body or undefined; a broken body is reported as an error by the caller. */
export async function readJson(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Name of a Google API in error messages, e.g. `Calendar API`. */
export type ApiName = string;

/**
 * GET a Google API URL with a bearer token. Errors carry Google's status text
 * (`PERMISSION_DENIED`, ...), never the request headers.
 */
export async function getJson(
  api: ApiName,
  url: string,
  accessToken: string,
  deps: ConnectorDeps,
): Promise<GoogleResult<Json>> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await deps.fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
  } catch {
    return fail('error', null, `${api}: network error`);
  }
  const body = await readJson(response);
  if (!response.ok) {
    const googleStatus =
      isRecord(body) && isRecord(body.error) ? str(body.error.status) : undefined;
    return fail(
      'error',
      response.status,
      `${api} ${response.status}${googleStatus ? ` ${googleStatus}` : ''}`,
    );
  }
  if (!isRecord(body)) return fail('error', response.status, `${api}: unexpected response`);
  return ok(body);
}

/** Guard against a pagination loop; our lists are nowhere near this. */
export const MAX_PAGES = 20;

/** `items` of every page of a Google list endpoint, following `nextPageToken`. */
export async function listAllPages(
  api: ApiName,
  url: (pageToken: string | undefined) => string,
  accessToken: string,
  deps: ConnectorDeps,
): Promise<GoogleResult<Json[]>> {
  const all: Json[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getJson(api, url(pageToken), accessToken, deps);
    if (!result.ok) return result;
    const items = result.value.items;
    if (items !== undefined && !Array.isArray(items))
      return fail('error', 200, `${api}: unexpected response`);
    all.push(...(items ?? []).filter(isRecord));
    pageToken = str(result.value.nextPageToken);
    if (!pageToken) return ok(all);
  }
  return fail('error', null, `${api}: more than ${MAX_PAGES} pages`);
}
