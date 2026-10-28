// Loaded only through lib/dev-mock.ts in development. See there.
import type {
  GoogleConnectionStatus,
  Profile,
  ScenePreference,
  ThemePreference,
} from '@daybrief/core';
import { isLanguage } from '@daybrief/i18n';
import type { Session } from '@supabase/supabase-js';
import type { DevMock } from './dev-mock';

const scenes: readonly ScenePreference[] = ['auto', 'morning', 'day', 'evening', 'night'];
const themes: readonly ThemePreference[] = ['auto', 'light', 'dark'];
const connections: readonly GoogleConnectionStatus[] = ['active', 'revoked', 'error', 'none'];

/**
 * Web query parameters tune the mock for visual checks: `?lang=ru`, `?scene=night`, `?theme=dark`,
 * `?name=Anna%20Kowalska`, `?google=error` (Calendar + Tasks connection status).
 */
export function createDevMock(): DevMock {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  const params = new URLSearchParams(search);

  const lang = params.get('lang') ?? '';
  const sceneParam = params.get('scene') ?? '';
  const scene = scenes.find((s) => s === sceneParam) ?? 'auto';
  const themeParam = params.get('theme') ?? '';
  const theme = themes.find((t) => t === themeParam) ?? 'auto';
  const googleParam = params.get('google') ?? '';
  const googleConnection = connections.find((c) => c === googleParam) ?? 'active';
  const name = params.get('name') ?? 'Siarhei';

  const profile: Profile = {
    userId: 'dev-user',
    displayName: name,
    // The profile applies its locale on load, like the real one.
    locale: isLanguage(lang) ? lang : null,
    theme,
    scene,
    timezone: null,
  };
  // Only the fields the app reads; the rest of Session is irrelevant offline.
  const session = {
    access_token: 'dev-mock',
    token_type: 'bearer',
    user: { id: 'dev-user', email: 'dev@example.com', user_metadata: { full_name: name } },
  } as unknown as Session;

  return { session, profile, googleConnection };
}
