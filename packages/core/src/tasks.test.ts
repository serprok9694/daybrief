import { describe, expect, it } from 'vitest';
import { groupTasks, localDate, taskWindow, type GoogleTask } from './tasks';

const WARSAW = 'Europe/Warsaw';
const utc = (iso: string) => new Date(iso);

const task = (id: string, dueDate: string): GoogleTask => ({
  id,
  listId: 'MDQ3NTI5NjM0MjM2NTk0MzY4NzY6MDow',
  title: `Task ${id}`,
  dueDate,
  webViewLink: `https://tasks.google.com/task/${id}`,
});
const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

// 2026 in Europe/Warsaw: CET (+01) → CEST (+02) on 29 March at 02:00,
// back to CET on 25 October at 03:00.

describe('taskWindow', () => {
  it('today in the user’s zone and the end of that date as dueMax', () => {
    expect(taskWindow(WARSAW, utc('2026-10-31T12:00:00Z'))).toEqual({
      today: '2026-10-31',
      dueMax: '2026-10-31T23:59:59.999Z',
    });
  });

  it('uses the local date, not the UTC one', () => {
    // 23:30 UTC is already 00:30 on 1 November in Warsaw.
    expect(taskWindow(WARSAW, utc('2026-10-31T23:30:00Z')).today).toBe('2026-11-01');
    expect(taskWindow('UTC', utc('2026-10-31T23:30:00Z')).today).toBe('2026-10-31');
    // And behind UTC: still the 31st in New York at 02:00 UTC on 1 November.
    expect(taskWindow('America/New_York', utc('2026-11-01T02:00:00Z')).today).toBe('2026-10-31');
  });

  it('dueMax admits a task due today and nothing due tomorrow', () => {
    const { dueMax } = taskWindow(WARSAW, utc('2026-10-31T23:30:00Z'));
    expect(Date.parse('2026-11-01T00:00:00.000Z')).toBeLessThan(Date.parse(dueMax));
    expect(Date.parse('2026-11-02T00:00:00.000Z')).toBeGreaterThan(Date.parse(dueMax));
  });
});

describe('localDate', () => {
  it('pads month and day', () => {
    expect(localDate('UTC', utc('2026-03-05T10:00:00Z'))).toBe('2026-03-05');
  });
});

describe('groupTasks', () => {
  const tasks = [
    task('today-a', '2026-10-31'),
    task('week-ago', '2026-10-24'),
    task('tomorrow', '2026-11-01'),
    task('yesterday', '2026-10-30'),
    task('today-b', '2026-10-31'),
    task('week-ago-2', '2026-10-24'),
  ];

  it('overdue oldest first with days late, then today in input order, future dropped', () => {
    const grouped = groupTasks(tasks, WARSAW, utc('2026-10-31T09:00:00Z'));
    expect(grouped.overdue.map((t) => [t.id, t.overdueDays])).toEqual([
      ['week-ago', 7],
      ['week-ago-2', 7],
      ['yesterday', 1],
    ]);
    expect(ids(grouped.today)).toEqual(['today-a', 'today-b']);
  });

  it('keeps the task fields', () => {
    const grouped = groupTasks([task('y', '2026-10-30')], WARSAW, utc('2026-10-31T09:00:00Z'));
    expect(grouped.overdue[0]).toEqual({ ...task('y', '2026-10-30'), overdueDays: 1 });
  });

  it('just before midnight in Warsaw', () => {
    // 22:59 UTC = 23:59 CET on 31 October.
    const grouped = groupTasks(tasks, WARSAW, utc('2026-10-31T22:59:00Z'));
    expect(ids(grouped.today)).toEqual(['today-a', 'today-b']);
    expect(ids(grouped.overdue)).toEqual(['week-ago', 'week-ago-2', 'yesterday']);
  });

  it('just after midnight in Warsaw while it is still the 31st in UTC', () => {
    // 23:00 UTC = 00:00 CET on 1 November.
    const now = utc('2026-10-31T23:00:00Z');
    const warsaw = groupTasks(tasks, WARSAW, now);
    expect(ids(warsaw.today)).toEqual(['tomorrow']);
    expect(warsaw.overdue.map((t) => [t.id, t.overdueDays])).toEqual([
      ['week-ago', 8],
      ['week-ago-2', 8],
      ['yesterday', 2],
      ['today-a', 1],
      ['today-b', 1],
    ]);

    const inUtc = groupTasks(tasks, 'UTC', now);
    expect(ids(inUtc.today)).toEqual(['today-a', 'today-b']);
    expect(ids(inUtc.overdue)).toEqual(['week-ago', 'week-ago-2', 'yesterday']);
  });

  it('around midnight in UTC', () => {
    expect(ids(groupTasks(tasks, 'UTC', utc('2026-10-31T23:59:59Z')).today)).toEqual([
      'today-a',
      'today-b',
    ]);
    expect(ids(groupTasks(tasks, 'UTC', utc('2026-11-01T00:00:00Z')).today)).toEqual(['tomorrow']);
  });

  it('autumn DST change: the 25-hour day still counts as one day', () => {
    const autumn = [
      task('sat', '2026-10-24'),
      task('sun', '2026-10-25'),
      task('mon', '2026-10-26'),
    ];
    // 22:59 UTC on the 25th = 23:59 CET, the clocks went back at 03:00 that night.
    const sunday = groupTasks(autumn, WARSAW, utc('2026-10-25T22:59:00Z'));
    expect(ids(sunday.today)).toEqual(['sun']);
    expect(sunday.overdue.map((t) => [t.id, t.overdueDays])).toEqual([['sat', 1]]);
    // 23:00 UTC = 00:00 CET on Monday.
    const monday = groupTasks(autumn, WARSAW, utc('2026-10-25T23:00:00Z'));
    expect(ids(monday.today)).toEqual(['mon']);
    expect(monday.overdue.map((t) => [t.id, t.overdueDays])).toEqual([
      ['sat', 2],
      ['sun', 1],
    ]);
  });

  it('spring DST change: the 23-hour day still counts as one day', () => {
    const spring = [
      task('sat', '2026-03-28'),
      task('sun', '2026-03-29'),
      task('mon', '2026-03-30'),
    ];
    // 21:59 UTC on the 29th = 23:59 CEST.
    const sunday = groupTasks(spring, WARSAW, utc('2026-03-29T21:59:00Z'));
    expect(ids(sunday.today)).toEqual(['sun']);
    // 22:00 UTC = 00:00 CEST on Monday.
    const monday = groupTasks(spring, WARSAW, utc('2026-03-29T22:00:00Z'));
    expect(ids(monday.today)).toEqual(['mon']);
    expect(monday.overdue.map((t) => [t.id, t.overdueDays])).toEqual([
      ['sat', 2],
      ['sun', 1],
    ]);
  });

  it('counts days across month and year boundaries', () => {
    const grouped = groupTasks(
      [task('old', '2025-12-31'), task('feb', '2026-02-28')],
      'UTC',
      utc('2026-03-01T08:00:00Z'),
    );
    expect(grouped.overdue.map((t) => [t.id, t.overdueDays])).toEqual([
      ['old', 60],
      ['feb', 1],
    ]);
  });

  it('drops tasks with a malformed due date', () => {
    const grouped = groupTasks([task('bad', '31.10.2026')], 'UTC', utc('2026-10-31T08:00:00Z'));
    expect(grouped).toEqual({ overdue: [], today: [] });
  });
});
