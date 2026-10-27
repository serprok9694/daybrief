import type { Database } from './database.types';

type Enums = Database['public']['Enums'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type Locale = Enums['app_locale'];
export type ThemePreference = Enums['theme_preference'];
/** `auto` picks the scene by local part of day. */
export type ScenePreference = Enums['scene_preference'];

export interface Profile {
  userId: string;
  displayName: string | null;
  /** null = follow the device language. */
  locale: Locale | null;
  theme: ThemePreference;
  scene: ScenePreference;
  /** IANA time zone; null until the client reports it. */
  timezone: string | null;
}

export const PROFILE_COLUMNS = 'user_id, display_name, locale, theme, scene, timezone' as const;

export function profileFromRow(
  row: Pick<ProfileRow, 'user_id' | 'display_name' | 'locale' | 'theme' | 'scene' | 'timezone'>,
): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    locale: row.locale,
    theme: row.theme,
    scene: row.scene,
    timezone: row.timezone,
  };
}
