// Loaded only through lib/dev-mock.ts in development. See there.
import type { Profile, ScenePreference } from '@daybrief/core';
import { isLanguage, setLanguage } from '@daybrief/i18n';
import type { Session } from '@supabase/supabase-js';
import type { DevMock } from './dev-mock';

const scenes: readonly ScenePreference[] = ['auto', 'morning', 'day', 'evening', 'night'];

/**
 * Web query parameters tune the mock for visual checks: `?lang=ru`, `?scene=night`,
 * `?name=Anna%20Kowalska`.
 */
export function createDevMock(): DevMock {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  const params = new URLSearchParams(search);

  const lang = params.get('lang') ?? '';
  if (isLanguage(lang)) void setLanguage(lang);
  const sceneParam = params.get('scene') ?? '';
  const scene = scenes.find((s) => s === sceneParam) ?? 'auto';
  const name = params.get('name') ?? 'Siarhei';

  const profile: Profile = {
    userId: 'dev-user',
    displayName: name,
    locale: null,
    theme: 'auto',
    scene,
    timezone: null,
  };
  // Only the fields the app reads; the rest of Session is irrelevant offline.
  const session = {
    access_token: 'dev-mock',
    token_type: 'bearer',
    user: { id: 'dev-user', email: 'dev@example.com', user_metadata: { full_name: name } },
  } as unknown as Session;

  return { session, profile };
}
