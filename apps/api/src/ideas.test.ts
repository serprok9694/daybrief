import { API_TOKEN_LIMIT, type ApiToken, type Idea } from '@daybrief/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiTokenHash } from './ideas';
import { createRoutes } from './routes';
import { fakeWorld } from './test-deps';

// Distinctive, so the log checks below can look for them.
const IDEA_TEXT = 'Idea text LEAK-CANARY-5';

let world: ReturnType<typeof fakeWorld>;
let routes: ReturnType<typeof createRoutes>;
let logs: string[];

beforeEach(() => {
  world = fakeWorld();
  world.state.now = new Date('2026-10-31T10:00:00Z');
  routes = createRoutes(world.deps);
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(
        args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(' '),
      );
    });
  }
});
afterEach(() => vi.restoreAllMocks());

const session = (userId: string) => `token-for-${userId}`;

const request = (method: string, path: string, credential?: string, body?: unknown) =>
  routes.request(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const postIdea = (credential: string | undefined, body: unknown) =>
  request('POST', '/ideas', credential, body);

/** Creates a token through the API, as settings will. */
async function createToken(userId: string, name = 'iPhone') {
  const res = await request('POST', '/tokens', session(userId), { name });
  expect(res.status).toBe(201);
  return (await res.json()) as ApiToken & { token: string };
}

describe('POST /ideas', () => {
  it('saves an idea from the command bar (session)', async () => {
    const res = await postIdea(session('user-1'), { text: `  ${IDEA_TEXT} ` });
    expect(res.status).toBe(201);
    const { idea } = (await res.json()) as { idea: Idea };
    expect(idea).toMatchObject({ text: IDEA_TEXT, source: 'command', externalId: null });
    expect(world.state.ideas).toHaveLength(1);
  });

  it('saves an idea from a Shortcut (API token) and records the use', async () => {
    const { token, id } = await createToken('user-1');
    const res = await postIdea(token, { text: IDEA_TEXT });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { idea: Idea }).idea).toMatchObject({ source: 'shortcut' });
    expect(world.state.ideas[0]?.userId).toBe('user-1');
    expect(world.state.apiTokens.find((t) => t.id === id)?.lastUsedAt).toBe(
      world.state.now.toISOString(),
    );
  });

  it('keeps an explicit source', async () => {
    const { token } = await createToken('user-1');
    const res = await postIdea(token, { text: 'x', source: 'reminders', externalId: 'r-1' });
    expect(((await res.json()) as { idea: Idea }).idea).toMatchObject({
      source: 'reminders',
      externalId: 'r-1',
    });
  });

  it('answers a repeat of the same text with the existing idea and 200', async () => {
    const first = (await (await postIdea(session('user-1'), { text: 'Learn Rust' })).json()) as {
      idea: Idea;
    };
    const res = await postIdea(session('user-1'), { text: '  learn\n RUST ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(first);
    expect(world.state.ideas).toHaveLength(1);
  });

  it('dedups by external id, even with another text or after "done"', async () => {
    const body = { text: 'Buy a plant', source: 'reminders', externalId: 'r-1' };
    const { idea } = (await (await postIdea(session('user-1'), body)).json()) as { idea: Idea };
    const edited = await postIdea(session('user-1'), { ...body, text: 'Buy two plants' });
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { idea: Idea }).idea.id).toBe(idea.id);

    await request('POST', `/ideas/${idea.id}/done`, session('user-1'));
    expect((await postIdea(session('user-1'), body)).status).toBe(200);
    expect(world.state.ideas).toHaveLength(1);
  });

  it('lets an archived text come back as a new idea', async () => {
    const { idea } = (await (await postIdea(session('user-1'), { text: 'Again' })).json()) as {
      idea: Idea;
    };
    await request('POST', `/ideas/${idea.id}/done`, session('user-1'));
    expect((await postIdea(session('user-1'), { text: 'again' })).status).toBe(201);
  });

  it('dedups per user', async () => {
    await postIdea(session('user-1'), { text: 'Same' });
    expect((await postIdea(session('user-2'), { text: 'Same' })).status).toBe(201);
  });

  it('validates the body', async () => {
    const cases: [unknown, string][] = [
      [{ text: '' }, 'empty_text'],
      [{ text: '   \n' }, 'empty_text'],
      [{ text: 'x'.repeat(2001) }, 'text_too_long'],
      [{ text: 'x', source: 'email' }, 'invalid_request'],
      [{}, 'invalid_request'],
      [null, 'invalid_request'],
    ];
    for (const [body, error] of cases) {
      const res = await postIdea(session('user-1'), body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
    expect((await postIdea(session('user-1'), { text: 'x'.repeat(2000) })).status).toBe(201);
    expect(world.state.ideas).toHaveLength(1);
  });

  it('rejects missing, malformed, unknown and revoked tokens with 401', async () => {
    const { token, id } = await createToken('user-1');
    const unknown = `dbf_${'A'.repeat(43)}`;
    for (const credential of [undefined, 'garbage', 'dbf_short', `${token}x`, unknown]) {
      expect((await postIdea(credential, { text: IDEA_TEXT })).status).toBe(401);
    }
    expect((await request('DELETE', `/tokens/${id}`, session('user-1'))).status).toBe(204);
    expect((await postIdea(token, { text: IDEA_TEXT })).status).toBe(401);
    expect(world.state.ideas).toHaveLength(0);
  });

  it('checks the stored hash, not just that the lookup found a row', async () => {
    const { token } = await createToken('user-1');
    const res = await createRoutes({
      ...world.deps,
      useApiToken: async () => ({ userId: 'user-1', tokenHash: apiTokenHash('another') }),
    }).request('/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: 'x' }),
    });
    expect(res.status).toBe(401);
  });

  it('never logs the idea text or the token, even when saving fails', async () => {
    const { token } = await createToken('user-1');
    const failing = createRoutes({
      ...world.deps,
      addIdea: async () => {
        throw new Error('Failed to add idea: connection refused');
      },
    });
    const res = await failing.request('/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: IDEA_TEXT }),
    });
    expect(res.status).toBe(500);
    await postIdea(token, { text: IDEA_TEXT });
    await postIdea(`${token}x`, { text: IDEA_TEXT });
    expect(logs.join('\n')).not.toContain('LEAK-CANARY');
    expect(logs.join('\n')).not.toContain(token);
    expect(logs.join('\n')).not.toContain(token.slice(4, 20));
  });
});

describe('an API token opens POST /ideas only', () => {
  it('gets 401 everywhere else', async () => {
    const { token, id } = await createToken('user-1');
    const { idea } = (await (await postIdea(token, { text: 'x' })).json()) as { idea: Idea };
    const routesToTry: [string, string, unknown?][] = [
      ['GET', '/ideas/today'],
      ['POST', `/ideas/${idea.id}/snooze`],
      ['POST', `/ideas/${idea.id}/done`],
      ['GET', '/tokens'],
      ['POST', '/tokens', { name: 'from a token' }],
      ['DELETE', `/tokens/${id}`],
      ['GET', '/me'],
      ['PATCH', '/me', { theme: 'dark' }],
      ['GET', '/connections/google'],
      ['GET', '/events/today'],
      ['POST', '/sync/calendar'],
    ];
    for (const [method, path, body] of routesToTry) {
      const res = await request(method, path, token, body);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
    expect(world.state.apiTokens).toHaveLength(1);
    expect(world.state.ideas[0]).toMatchObject({ doneAt: null, snoozedUntil: null });
  });
});

describe('idea of the day', () => {
  const today = () => request('GET', '/ideas/today', session('user-1'));
  const todayIdea = async () => ((await (await today()).json()) as { idea: Idea | null }).idea;
  const add = async (text: string, userId = 'user-1') => {
    const res = await postIdea(session(userId), { text });
    return ((await res.json()) as { idea: Idea }).idea;
  };
  const later = (ms: number) => {
    world.state.now = new Date(world.state.now.getTime() + ms);
  };
  const HOUR = 60 * 60 * 1000;

  it('is null without ideas', async () => {
    const res = await today();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ idea: null });
  });

  it('requires a session', async () => {
    expect((await request('GET', '/ideas/today')).status).toBe(401);
  });

  it('shows the oldest idea and keeps it for the rest of the day', async () => {
    const first = await add('first');
    later(HOUR);
    await add('second');
    expect((await todayIdea())?.id).toBe(first.id);
    const shownAt = world.state.ideas[0]?.lastShownAt;
    expect(shownAt).toBe(world.state.now.toISOString());

    later(HOUR);
    expect((await todayIdea())?.id).toBe(first.id);
    // Stamped once a day, not on every open.
    expect(world.state.ideas[0]?.lastShownAt).toBe(shownAt);

    later(24 * HOUR);
    expect((await todayIdea())?.text).toBe('second');
  });

  it('uses the profile time zone for "today"', async () => {
    world.state.timezones.set('user-1', 'Asia/Tokyo');
    // 14:30 UTC is 23:30 in Tokyo; an hour later it is the next day there, not in UTC.
    world.state.now = new Date('2026-10-31T14:30:00Z');
    await add('first');
    later(1);
    await add('second');
    expect((await todayIdea())?.text).toBe('first');
    later(HOUR);
    expect((await todayIdea())?.text).toBe('second');
  });

  it('"Not now" hides the idea for 7 days and answers with the next one', async () => {
    const first = await add('first');
    later(1);
    const second = await add('second');
    expect((await todayIdea())?.id).toBe(first.id);

    const res = await request('POST', `/ideas/${first.id}/snooze`, session('user-1'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { idea: Idea }).idea.id).toBe(second.id);
    expect(world.state.ideas[0]?.snoozedUntil).toBe(
      new Date(world.state.now.getTime() + 7 * 24 * HOUR).toISOString(),
    );
    expect((await todayIdea())?.id).toBe(second.id);

    await request('POST', `/ideas/${second.id}/done`, session('user-1'));
    expect(await todayIdea()).toBeNull();
    later(7 * 24 * HOUR);
    expect((await todayIdea())?.id).toBe(first.id);
  });

  it('"Done" archives the idea for good', async () => {
    const idea = await add('only');
    const res = await request('POST', `/ideas/${idea.id}/done`, session('user-1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ idea: null });
    expect(world.state.ideas[0]?.doneAt).toBe(world.state.now.toISOString());
    later(30 * 24 * HOUR);
    expect(await todayIdea()).toBeNull();
  });

  it("acts only on the user's own ideas", async () => {
    const other = await add('not yours', 'user-2');
    for (const action of ['snooze', 'done']) {
      const res = await request('POST', `/ideas/${other.id}/${action}`, session('user-1'));
      expect(res.status).toBe(404);
    }
    expect((await request('POST', '/ideas/not-a-uuid/done', session('user-1'))).status).toBe(404);
    expect(world.state.ideas[0]).toMatchObject({ doneAt: null, snoozedUntil: null });
    expect(await todayIdea()).toBeNull();
  });
});

describe('API tokens', () => {
  it('returns the full token once and lists only what settings need', async () => {
    const created = await createToken('user-1', '  iPhone · Send to daybrief ');
    expect(created.token).toMatch(/^dbf_[A-Za-z0-9_-]{43}$/);
    expect(created).toMatchObject({
      name: 'iPhone · Send to daybrief',
      last4: created.token.slice(-4),
      createdAt: world.state.now.toISOString(),
      lastUsedAt: null,
    });
    // Only the hash is stored.
    expect(world.state.apiTokens[0]?.tokenHash).toBe(apiTokenHash(created.token));
    expect(JSON.stringify(world.state.apiTokens)).not.toContain(created.token);

    const res = await request('GET', '/tokens', session('user-1'));
    expect(res.status).toBe(200);
    const { id, name, last4, createdAt, lastUsedAt } = created;
    expect(await res.clone().json()).toEqual({
      tokens: [{ id, name, last4, createdAt, lastUsedAt }],
    });
    const body = await res.text();
    expect(body).not.toContain(created.token);
    expect(body).not.toContain(apiTokenHash(created.token));
  });

  it('makes a different token each time', async () => {
    const a = await createToken('user-1');
    const b = await createToken('user-1');
    expect(a.token).not.toBe(b.token);
  });

  it('allows at most 10 active tokens', async () => {
    const tokens = [];
    for (let i = 0; i < API_TOKEN_LIMIT; i++) tokens.push(await createToken('user-1', `t${i}`));
    const res = await request('POST', '/tokens', session('user-1'), { name: 'one more' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'token_limit', limit: 10 });
    // Per user, and revoking frees a slot.
    await createToken('user-2');
    await request('DELETE', `/tokens/${tokens[0]!.id}`, session('user-1'));
    await createToken('user-1', 'replacement');
  });

  it('validates the name', async () => {
    for (const body of [{}, { name: ' ' }, { name: 'n'.repeat(101) }, null]) {
      expect((await request('POST', '/tokens', session('user-1'), body)).status).toBe(400);
    }
  });

  it("revokes only the user's own active tokens", async () => {
    const mine = await createToken('user-1');
    const theirs = await createToken('user-2');
    expect((await request('DELETE', `/tokens/${theirs.id}`, session('user-1'))).status).toBe(404);
    expect((await request('DELETE', '/tokens/nope', session('user-1'))).status).toBe(404);
    expect((await request('DELETE', `/tokens/${mine.id}`, session('user-1'))).status).toBe(204);
    expect((await request('DELETE', `/tokens/${mine.id}`, session('user-1'))).status).toBe(404);
    const list = await request('GET', '/tokens', session('user-1'));
    expect(await list.json()).toEqual({ tokens: [] });
    expect((await postIdea(theirs.token, { text: 'still works' })).status).toBe(201);
  });

  it('require a session', async () => {
    expect((await request('GET', '/tokens')).status).toBe(401);
    expect((await request('POST', '/tokens', undefined, { name: 'x' })).status).toBe(401);
  });
});
