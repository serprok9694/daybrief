import {
  API_TOKEN_BYTES,
  API_TOKEN_PREFIX,
  apiTokenLast4,
  normalizeIdeaText,
  pickIdeaOfTheDay,
  type ApiToken,
  type Idea,
  type Tables,
} from '@daybrief/core';
import { createHash, randomBytes } from 'node:crypto';

export type IdeaRow = Omit<Tables<'ideas'>, 'user_id' | 'text_hash'>;
export type ApiTokenRow = Omit<Tables<'api_tokens'>, 'user_id' | 'token_hash' | 'revoked_at'>;

export const IDEA_COLUMNS =
  'id, text, source, external_id, created_at, snoozed_until, done_at, last_shown_at' as const;
// Never token_hash: the hash stays in the database.
export const API_TOKEN_COLUMNS = 'id, name, last4, created_at, last_used_at' as const;

// PostgREST returns `+00:00` offsets; the API speaks `Z`.
const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value === null ? null : iso(value));

export function ideaFromRow(row: IdeaRow): Idea {
  return {
    id: row.id,
    text: row.text,
    source: row.source,
    externalId: row.external_id,
    createdAt: iso(row.created_at),
    snoozedUntil: isoOrNull(row.snoozed_until),
    doneAt: isoOrNull(row.done_at),
    lastShownAt: isoOrNull(row.last_shown_at),
  };
}

export function apiTokenFromRow(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    last4: row.last4,
    createdAt: iso(row.created_at),
    lastUsedAt: isoOrNull(row.last_used_at),
  };
}

const sha256Hex = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

/** What dedup compares: SHA-256 of the normalized text. */
export const ideaTextHash = (text: string) => sha256Hex(normalizeIdeaText(text));

/** The only form of an API token that is stored or looked up. */
export const apiTokenHash = (token: string) => sha256Hex(token);

/** A new token: the full value (shown once) and what is stored about it. */
export function newApiToken(): { token: string; tokenHash: string; last4: string } {
  const token = API_TOKEN_PREFIX + randomBytes(API_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: apiTokenHash(token), last4: apiTokenLast4(token) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are uuids; anything else is answered with 404 before it reaches Postgres. */
export const isUuid = (value: string) => UUID.test(value);

export interface IdeaOfTheDayDeps {
  getProfile: (userId: string) => Promise<{ timezone: string | null } | null>;
  /** Ideas that are not done; the pick filters out the snoozed ones itself. */
  getOpenIdeas: (userId: string) => Promise<Idea[]>;
  markIdeaShown: (userId: string, ideaId: string, at: Date) => Promise<void>;
  now: () => Date;
}

/** The idea of the day (M2 rule), stamping `last_shown_at` when it changes. */
export async function ideaOfTheDay(userId: string, deps: IdeaOfTheDayDeps): Promise<Idea | null> {
  const now = deps.now();
  const [profile, ideas] = await Promise.all([deps.getProfile(userId), deps.getOpenIdeas(userId)]);
  const pick = pickIdeaOfTheDay(ideas, profile?.timezone ?? 'UTC', now);
  if (!pick) return null;
  if (!pick.markShown) return pick.idea;
  await deps.markIdeaShown(userId, pick.idea.id, now);
  return { ...pick.idea, lastShownAt: now.toISOString() };
}
