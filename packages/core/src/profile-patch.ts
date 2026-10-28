import { Constants } from './database.types';
import type { Locale, Profile, ScenePreference, ThemePreference } from './profile';

/** Profile fields the user may change from settings. */
export type ProfilePatch = Partial<Pick<Profile, 'locale' | 'theme' | 'scene' | 'timezone'>>;

const enums = Constants.public.Enums;

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);

const isLocale = oneOf<Locale>(enums.app_locale);
const isTheme = oneOf<ThemePreference>(enums.theme_preference);
const isScene = oneOf<ScenePreference>(enums.scene_preference);

/** True for an IANA time zone the runtime knows, e.g. `Europe/Berlin`. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '' || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const fields: { [K in keyof Required<ProfilePatch>]: (v: unknown) => v is ProfilePatch[K] } = {
  // null = follow the device language again.
  locale: (v): v is Locale | null => v === null || isLocale(v),
  theme: isTheme,
  scene: isScene,
  timezone: isTimeZone,
};

/**
 * Validates an untrusted settings update. Returns null when it is not an object, is empty,
 * has an unknown field or a value out of range, so a typo never half-applies.
 */
export function parseProfilePatch(value: unknown): ProfilePatch | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  const patch: Record<string, unknown> = {};
  for (const [key, v] of entries) {
    if (!Object.hasOwn(fields, key)) return null;
    if (!fields[key as keyof ProfilePatch](v)) return null;
    patch[key] = v;
  }
  return patch as ProfilePatch;
}
