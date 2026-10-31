import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, queryOf } from '../google/test-fetch';
import taskLists from './fixtures/task-lists.json';
import tasksPage1 from './fixtures/tasks-page-1.json';
import tasksPage2 from './fixtures/tasks-page-2.json';
import { listDueTasks, listTaskLists } from './tasks';

const TOKEN = 'ya29.access-token-secret';
const LIST = 'MDQ3NTI5NjM0MjM2NTk0MzY4NzY6MDow';
// taskWindow('Europe/Warsaw', 31 October 2026).
const DUE_MAX = '2026-10-31T23:59:59.999Z';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listTaskLists', () => {
  it('returns every list with id and title', async () => {
    const fetch = fakeFetch({ status: 200, body: taskLists });

    expect(await listTaskLists(TOKEN, { fetch })).toEqual({
      ok: true,
      value: [
        { id: 'MDQ3NTI5NjM0MjM2NTk0MzY4NzY6MDow', title: 'My Tasks' },
        { id: 'dWJYVGRaUWQ0a0NhWmZzUQ', title: 'Дом' },
      ],
    });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url.split('?')[0]).toBe('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
    expect(init.headers?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(queryOf(url).fields).toBe('nextPageToken,items(id,title)');
  });

  it('follows nextPageToken', async () => {
    const fetch = fakeFetch(
      {
        status: 200,
        body: { ...taskLists, items: taskLists.items.slice(0, 1), nextPageToken: 'page-2' },
      },
      { status: 200, body: { ...taskLists, items: taskLists.items.slice(1) } },
    );
    const result = await listTaskLists(TOKEN, { fetch });
    expect(result.ok && result.value.map((l) => l.title)).toEqual(['My Tasks', 'Дом']);
    expect(queryOf(fetch.mock.calls[1]![0]).pageToken).toBe('page-2');
  });

  it('a user with no lists gets an empty array', async () => {
    const fetch = fakeFetch({ status: 200, body: { kind: 'tasks#taskLists', etag: '"x"' } });
    expect(await listTaskLists(TOKEN, { fetch })).toEqual({ ok: true, value: [] });
  });

  it('passes Google errors through as error', async () => {
    const fetch = fakeFetch({
      status: 403,
      body: {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
        },
      },
    });
    expect(await listTaskLists(TOKEN, { fetch })).toEqual({
      ok: false,
      error: { kind: 'error', status: 403, message: 'Tasks API 403 PERMISSION_DENIED' },
    });
  });
});

describe('listDueTasks', () => {
  it('maps both pages into dashboard tasks', async () => {
    const fetch = fakeFetch({ status: 200, body: tasksPage1 }, { status: 200, body: tasksPage2 });

    expect(await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch })).toEqual({
      ok: true,
      value: [
        {
          // Due today; notes and the attached email link are dropped.
          id: 'SGhGZVBrUmJxUGtfQ3JWdA',
          listId: LIST,
          title: 'Pay the electricity bill',
          dueDate: '2026-10-31',
          webViewLink: 'https://tasks.google.com/task/HhFePkRbqPk_CrVt?sa=6',
        },
        {
          // Overdue.
          id: 'dE1aWnJ3c0ZQbWdLbnhCeQ',
          listId: LIST,
          title: 'Renew passport',
          dueDate: '2026-10-27',
          webViewLink: 'https://tasks.google.com/task/tMZZrwsFPmgKnxBy?sa=6',
        },
        {
          // Subtask: a plain row.
          id: 'Y0p3bHRhQ0FZTFVsVWZ1Ug',
          listId: LIST,
          title: 'Book the venue',
          dueDate: '2026-10-31',
          webViewLink: 'https://tasks.google.com/task/cJwltaCAYLUlUfuR?sa=6',
        },
        // "Read about Expo Router v6" is gone: no due date.
        // Page 2: the completed and the hidden task are gone.
        {
          // No title, no webViewLink.
          id: 'TmVlZFJlU3luY0hlcmVaWg',
          listId: LIST,
          title: '',
          dueDate: '2026-10-29',
          webViewLink: null,
        },
      ],
    });
  });

  it('never returns notes or links', async () => {
    const fetch = fakeFetch({ status: 200, body: tasksPage1 }, { status: 200, body: tasksPage2 });
    const result = JSON.stringify(await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch }));
    expect(result).not.toMatch(/PIN on the fridge|mail\.google\.com|invoice/);
  });

  it('asks for open tasks up to dueMax, page by page, with a minimal field mask', async () => {
    const fetch = fakeFetch({ status: 200, body: tasksPage1 }, { status: 200, body: tasksPage2 });
    const list = 'a/b+c';

    await listDueTasks(TOKEN, list, DUE_MAX, { fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
    const [first, init] = fetch.mock.calls[0]!;
    expect(first.split('?')[0]).toBe('https://tasks.googleapis.com/tasks/v1/lists/a%2Fb%2Bc/tasks');
    expect(init).toEqual({
      method: 'GET',
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
    });
    const query = queryOf(first);
    expect(query).toMatchObject({
      dueMax: DUE_MAX,
      showCompleted: 'false',
      showHidden: 'false',
      showDeleted: 'false',
      maxResults: '100',
    });
    expect(query.pageToken).toBeUndefined();
    expect(query.fields).not.toMatch(/notes|links/);
    expect(queryOf(fetch.mock.calls[1]![0]).pageToken).toBe(tasksPage1.nextPageToken);
  });

  it('drops deleted tasks and malformed due dates', async () => {
    const base = tasksPage1.items[0]!;
    const fetch = fakeFetch({
      status: 200,
      body: {
        kind: 'tasks#tasks',
        items: [
          { ...base, id: 'deleted', deleted: true },
          { ...base, id: 'bad-due', due: 'tomorrow' },
          { ...base, id: undefined },
        ],
      },
    });
    expect(await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch })).toEqual({ ok: true, value: [] });
  });

  it('an error on a later page fails the whole list', async () => {
    const fetch = fakeFetch(
      { status: 200, body: tasksPage1 },
      {
        status: 429,
        body: {
          error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' },
        },
      },
    );
    expect(await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch })).toEqual({
      ok: false,
      error: { kind: 'error', status: 429, message: 'Tasks API 429 RESOURCE_EXHAUSTED' },
    });
  });

  it('stops on a runaway pagination loop', async () => {
    const page = { status: 200, body: { kind: 'tasks#tasks', items: [], nextPageToken: 'again' } };
    const fetch = fakeFetch(...Array.from({ length: 30 }, () => page));
    const result = await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch });
    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(20);
  });

  it('network failure and broken JSON are errors without the token', async () => {
    for (const response of [
      new TypeError(`fetch failed ${TOKEN}`),
      { status: 502, body: '<html>Bad Gateway</html>' },
    ]) {
      const result = await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch: fakeFetch(response) });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('access-token-secret');
    }
  });

  it('uses only the fetch it is given', async () => {
    const globalFetch = vi.fn(() => {
      throw new Error('global fetch must not be used');
    });
    vi.stubGlobal('fetch', globalFetch);
    const fetch = fakeFetch({ status: 200, body: taskLists });
    expect((await listTaskLists(TOKEN, { fetch })).ok).toBe(true);
    const tasks = fakeFetch({ status: 200, body: tasksPage2 });
    expect((await listDueTasks(TOKEN, LIST, DUE_MAX, { fetch: tasks })).ok).toBe(true);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});
