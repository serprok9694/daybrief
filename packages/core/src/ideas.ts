import { todayRange } from './time-zone';

/** Where an idea came from: the command bar, the "Send to daybrief" Shortcut, Reminders. */
export const IDEA_SOURCES = ['command', 'shortcut', 'reminders'] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

/** In code points, after trimming; the database checks the same limit. */
export const IDEA_MAX_LENGTH = 2000;
export const IDEA_EXTERNAL_ID_MAX_LENGTH = 200;
/** "Not now" hides an idea for this long. */
export const IDEA_SNOOZE_DAYS = 7;

export interface Idea {
  id: string;
  text: string;
  source: IdeaSource;
  externalId: string | null;
  createdAt: string;
  snoozedUntil: string | null;
  doneAt: string | null;
  lastShownAt: string | null;
}

/** Body of `POST /ideas` after validation; `source` is defaulted by the route. */
export interface IdeaInput {
  text: string;
  source: IdeaSource | undefined;
  externalId: string | null;
}

export type IdeaInputError = 'invalid_request' | 'empty_text' | 'text_too_long';

const codePoints = (value: string) => [...value].length;

/** Validates `{ text, source?, externalId? }`; returns the input or why it was rejected. */
export function parseIdeaInput(value: unknown): IdeaInput | IdeaInputError {
  if (typeof value !== 'object' || value === null) return 'invalid_request';
  const { text, source, externalId } = value as Record<string, unknown>;
  if (typeof text !== 'string') return 'invalid_request';
  if (source !== undefined && !IDEA_SOURCES.includes(source as IdeaSource)) {
    return 'invalid_request';
  }
  if (externalId !== undefined && externalId !== null && typeof externalId !== 'string') {
    return 'invalid_request';
  }
  const trimmedId = externalId?.trim() || null;
  if (trimmedId !== null && codePoints(trimmedId) > IDEA_EXTERNAL_ID_MAX_LENGTH) {
    return 'invalid_request';
  }
  const trimmed = text.trim();
  if (trimmed === '') return 'empty_text';
  if (codePoints(trimmed) > IDEA_MAX_LENGTH) return 'text_too_long';
  return { text: trimmed, source: source as IdeaSource | undefined, externalId: trimmedId };
}

/**
 * The form of an idea's text that dedup compares (its hash is stored): Unicode NFC,
 * case-folded, whitespace runs collapsed to one space, trimmed. So "Learn  Rust" sent from
 * Notes and "learn rust" typed in the command bar are the same idea.
 */
export function normalizeIdeaText(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

const isOpen = (idea: Idea, now: Date) =>
  idea.doneAt === null &&
  (idea.snoozedUntil === null || Date.parse(idea.snoozedUntil) <= now.getTime());

/**
 * Idea of the day (M2 rule, no LLM): among ideas that are neither done nor snoozed, the
 * one shown today (in `timeZone`) if there is one, so it stays put across reloads;
 * otherwise the one shown longest ago (never shown first, then oldest), which the caller
 * marks as shown (`markShown`).
 */
export function pickIdeaOfTheDay(
  ideas: readonly Idea[],
  timeZone: string,
  now: Date,
): { idea: Idea; markShown: boolean } | null {
  const open = ideas.filter((idea) => isOpen(idea, now));
  const dayStart = Date.parse(todayRange(timeZone, now).start);
  const shownAt = (idea: Idea) => (idea.lastShownAt ? Date.parse(idea.lastShownAt) : -Infinity);

  const today = open.filter((idea) => shownAt(idea) >= dayStart);
  if (today.length > 0) {
    const latest = today.reduce((a, b) => (shownAt(b) > shownAt(a) ? b : a));
    return { idea: latest, markShown: false };
  }
  const [next] = [...open].sort(
    (a, b) =>
      shownAt(a) - shownAt(b) ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return next ? { idea: next, markShown: true } : null;
}
