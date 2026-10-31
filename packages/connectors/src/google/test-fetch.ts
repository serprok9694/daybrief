import { vi } from 'vitest';
import type { FetchLike } from './http';

export type FakeResponse = { status: number; body: unknown } | Error;

/** A `fetch` that answers from a queue and records every request. Test-only. */
export function fakeFetch(...responses: FakeResponse[]) {
  const queue = [...responses];
  return vi.fn<FetchLike>(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fakeFetch: no more responses queued');
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => {
        if (typeof next.body === 'string') throw new SyntaxError('Unexpected token');
        return next.body;
      },
    };
  });
}

/** Query parameters of a recorded URL. */
export function queryOf(url: string): Record<string, string> {
  const query = url.split('?')[1] ?? '';
  return Object.fromEntries(
    query
      .split('&')
      .filter(Boolean)
      .map((pair) => pair.split('=').map(decodeURIComponent) as [string, string]),
  );
}
