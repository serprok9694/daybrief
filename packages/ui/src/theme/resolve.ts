import type { ThemeName } from '../tokens';

/** What the user picked in settings. `auto` follows the OS. */
export type ThemePreference = 'auto' | 'light' | 'dark';

export const themePreferences = ['auto', 'light', 'dark'] as const satisfies ThemePreference[];

/** The theme to render for a preference and the OS scheme (RN reports null when unknown). */
export function resolveTheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ThemeName {
  if (preference !== 'auto') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
