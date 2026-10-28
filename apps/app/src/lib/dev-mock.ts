import type { Profile } from '@daybrief/core';
import type { Session } from '@supabase/supabase-js';

export interface DevMock {
  session: Session;
  profile: Profile;
}

/**
 * Local-only fake session and `/me` profile, to look at signed-in screens without Google.
 * On with `EXPO_PUBLIC_DEV_MOCK_AUTH=1` in a dev server. Production builds never contain it:
 * Metro folds `process.env.NODE_ENV` and drops the require of the mock data with the dead
 * branch.
 */
export const devMock: DevMock | null =
  process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_DEV_MOCK_AUTH === '1'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay inside the folded branch
      (require('./dev-mock-data') as typeof import('./dev-mock-data')).createDevMock()
    : null;
