// Public build-time config. Expo inlines EXPO_PUBLIC_* only when read as literal
// `process.env.EXPO_PUBLIC_…` member expressions, so each is spelled out.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set (see apps/app/.env.example)`);
  return value;
}

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787',
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
