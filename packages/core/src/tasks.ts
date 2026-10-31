import { wallClock } from './time-zone';

/**
 * A Google Tasks task as the dashboard shows it. Only what the widget needs: no notes
 * and no attached links (PRD 6.4).
 */
export type GoogleTask = {
  /** Google task id, unique within the task list. */
  id: string;
  listId: string;
  /** Empty when the task has no title; the UI shows a placeholder. */
  title: string;
  /** Due date `YYYY-MM-DD`. Google keeps only the date; the time part is always 00:00 UTC. */
  dueDate: string;
  /** The task in the Google Tasks web UI. */
  webViewLink: string | null;
};

/** A task due before today, with how many days it is late (1 = due yesterday). */
export type OverdueTask = GoogleTask & { overdueDays: number };

export type GroupedTasks = {
  /** Oldest due date first. */
  overdue: OverdueTask[];
  today: GoogleTask[];
};

/** What `GET /tasks/today` returns. */
export type TodayTasks = GroupedTasks & {
  /** When the last successful sync finished (RFC 3339), null if never. */
  syncedAt: string | null;
  /** Error of the last sync attempt, null if it succeeded. */
  error: string | null;
};

export type TaskWindow = {
  /** Today's date `YYYY-MM-DD` in the user's time zone. */
  today: string;
  /**
   * `dueMax` for `tasks.list` (RFC 3339): the last instant of today as a UTC date, which
   * is how Google encodes due dates. Includes today's tasks whether Google treats the
   * bound as inclusive or exclusive, and nothing due later.
   */
  dueMax: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Calendar date of `now` in `timeZone` as `YYYY-MM-DD`. */
export function localDate(timeZone: string, now: Date): string {
  const { year, month, day } = wallClock(now, timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Today's date and the `dueMax` bound for fetching tasks due today or earlier. */
export function taskWindow(timeZone: string, now: Date): TaskWindow {
  const today = localDate(timeZone, now);
  return { today, dueMax: `${today}T23:59:59.999Z` };
}

/** Whole days from date `from` to date `to` (both `YYYY-MM-DD`), NaN if either is malformed. */
function daysBetween(from: string, to: string): number {
  const ms = (date: string) => {
    const m = DATE.exec(date);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  return Math.round((ms(to) - ms(from)) / DAY_MS);
}

/**
 * Splits tasks into overdue (due before today in `timeZone`) and today's, comparing
 * dates only (M2 decisions, "Срок задачи"). Tasks due later are dropped. Overdue tasks
 * are sorted by due date, oldest first; ties and today's tasks keep input order.
 */
export function groupTasks(tasks: GoogleTask[], timeZone: string, now: Date): GroupedTasks {
  const today = localDate(timeZone, now);
  const overdue: OverdueTask[] = [];
  const dueToday: GoogleTask[] = [];
  for (const task of tasks) {
    const late = daysBetween(task.dueDate, today);
    if (late > 0) overdue.push({ ...task, overdueDays: late });
    else if (late === 0) dueToday.push(task);
  }
  // Array.prototype.sort is stable, so equal dates keep input order.
  overdue.sort((a, b) => b.overdueDays - a.overdueDays);
  return { overdue, today: dueToday };
}
