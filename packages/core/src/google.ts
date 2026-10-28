/**
 * Google OAuth scopes requested at sign-in (Calendar and Tasks, read-only; PRD 6.3).
 * Gmail is connected separately later (M3).
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
] as const;

/** State of the Calendar + Tasks connection as the settings screen shows it. */
export type GoogleConnectionStatus = 'active' | 'revoked' | 'error' | 'none';
