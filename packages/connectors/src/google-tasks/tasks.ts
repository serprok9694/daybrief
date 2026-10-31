import type { GoogleTask } from '@daybrief/core';
import {
  formEncode,
  listAllPages,
  ok,
  str,
  type ConnectorDeps,
  type GoogleResult,
  type Json,
} from '../google/http';

const API = 'https://tasks.googleapis.com/tasks/v1';
const API_NAME = 'Tasks API';

// Partial responses: notes and attached links never leave Google (PRD 6.4). Subtasks
// are plain rows (M2 decisions), so `parent` isn't needed either.
const TASK_LIST_FIELDS = 'nextPageToken,items(id,title)';
const TASK_FIELDS = 'nextPageToken,items(id,title,status,due,hidden,deleted,webViewLink)';
const DUE = /^\d{4}-\d{2}-\d{2}T/;

export type TaskList = { id: string; title: string };

/** All task lists of the user (M2 decisions, "Какие задачи"). */
export async function listTaskLists(
  accessToken: string,
  deps: ConnectorDeps,
): Promise<GoogleResult<TaskList[]>> {
  const items = await listAllPages(
    API_NAME,
    (pageToken) =>
      `${API}/users/@me/lists?${formEncode({ maxResults: 1000, fields: TASK_LIST_FIELDS, pageToken })}`,
    accessToken,
    deps,
  );
  if (!items.ok) return items;
  return ok(
    items.value.flatMap((item) => {
      const id = str(item.id);
      return id ? [{ id, title: str(item.title) ?? '' }] : [];
    }),
  );
}

/**
 * Open tasks of one list due no later than `dueMax` (RFC 3339, see `taskWindow`).
 * Completed, hidden, deleted and undated tasks are dropped even if Google returns them.
 */
export async function listDueTasks(
  accessToken: string,
  listId: string,
  dueMax: string,
  deps: ConnectorDeps,
): Promise<GoogleResult<GoogleTask[]>> {
  const items = await listAllPages(
    API_NAME,
    (pageToken) =>
      `${API}/lists/${encodeURIComponent(listId)}/tasks?${formEncode({
        dueMax,
        showCompleted: false,
        showHidden: false,
        showDeleted: false,
        maxResults: 100,
        fields: TASK_FIELDS,
        pageToken,
      })}`,
    accessToken,
    deps,
  );
  if (!items.ok) return items;
  return ok(items.value.flatMap((item) => toGoogleTask(item, listId) ?? []));
}

/** Google task resource → dashboard task, or null if it shouldn't be shown. */
export function toGoogleTask(item: Json, listId: string): GoogleTask | null {
  const id = str(item.id);
  const due = str(item.due);
  if (!id || !due || !DUE.test(due)) return null;
  if (item.status === 'completed' || item.hidden === true || item.deleted === true) return null;
  return {
    id,
    listId,
    title: str(item.title) ?? '',
    // Google keeps only the date; the time part is always 00:00 UTC and means nothing.
    dueDate: due.slice(0, 10),
    webViewLink: str(item.webViewLink) ?? null,
  };
}
