import type { PartOfDay } from '@daybrief/core';
import type { Language } from '@daybrief/i18n';

/** i18n key of the dashboard greeting. Night uses the evening phrase (see the design). */
export function greetingKey(part: PartOfDay) {
  return `greeting.${part}` as const;
}

/** Weekday, month and day in the UI language: "Tuesday, October 27", "вторник, 27 октября". */
export function formatToday(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** The fields of Supabase `user_metadata` that Google sign-in fills in. */
export interface GoogleMetadata {
  full_name?: unknown;
  name?: unknown;
  avatar_url?: unknown;
  picture?: unknown;
}

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Name shown in the top bar: the profile's display name, then the Google name from the
 * session, then the local part of the email.
 */
export function displayName(
  profileName: string | null | undefined,
  metadata: GoogleMetadata | undefined,
  email: string | undefined,
): string {
  return (
    nonEmpty(profileName) ??
    nonEmpty(metadata?.full_name) ??
    nonEmpty(metadata?.name) ??
    nonEmpty(email?.split('@')[0]) ??
    ''
  );
}

/** First word of a name, for the greeting ("Good morning, Sergei"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** Google profile photo from the session, if the provider sent one. */
export function avatarUrl(metadata: GoogleMetadata | undefined): string | undefined {
  const url = nonEmpty(metadata?.avatar_url) ?? nonEmpty(metadata?.picture);
  return url?.startsWith('https://') ? url : undefined;
}

/**
 * Columns of the widget grid, like CSS `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`:
 * as many columns of at least `min` as fit, stretched to fill the row.
 */
export function gridColumns(
  width: number,
  min: number,
  gap: number,
): { columns: number; itemWidth: number } {
  if (width <= 0) return { columns: 1, itemWidth: 0 };
  const columns = Math.max(1, Math.floor((width + gap) / (min + gap)));
  return { columns, itemWidth: (width - gap * (columns - 1)) / columns };
}
