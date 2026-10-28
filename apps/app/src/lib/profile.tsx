import type { Profile, ProfilePatch } from '@daybrief/core';
import { getLanguage, setLanguage, systemLocales } from '@daybrief/i18n';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api, bearer } from './api';
import { devMock } from './dev-mock';
import { profileLanguage } from './profile-language';
import { createProfileStore, type ProfileStore } from './profile-store';
import { supabase } from './supabase';

function applyLanguage(profile: Profile) {
  const language = profileLanguage(profile.locale, systemLocales());
  if (language !== getLanguage()) void setLanguage(language);
}

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The access token refreshes every hour, so each request reads the current one.
async function auth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Not signed in');
  return bearer(data.session.access_token);
}

function createLiveStore(): ProfileStore {
  return createProfileStore({
    async fetchProfile() {
      const res = await api.me.$get({}, await auth());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async saveProfile(patch) {
      const res = await api.me.$patch({ json: patch }, await auth());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    apply: applyLanguage,
    deviceTimeZone,
  });
}

/** In the dev mock the profile lives in memory: changes apply, nothing is sent anywhere. */
function createMockStore(initial: Profile): ProfileStore {
  let saved = initial;
  return createProfileStore({
    fetchProfile: async () => saved,
    saveProfile: async (patch: ProfilePatch) => (saved = { ...saved, ...patch }),
    apply: applyLanguage,
    deviceTimeZone,
  });
}

const ProfileContext = createContext<ProfileStore | null>(null);

/**
 * Loads the signed-in user's profile once and shares it: the root applies its theme, the
 * dashboard its scene, settings change it. A new user (sign-out, sign-in) gets a new store.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const store = useMemo(() => {
    if (!userId) return null;
    return devMock ? createMockStore(devMock.profile) : createLiveStore();
  }, [userId]);

  useEffect(() => {
    store?.load().catch((e: unknown) => {
      // Screens fall back to defaults (theme auto, scene by time, name from the session).
      console.warn('Loading the profile failed:', e instanceof Error ? e.message : e);
    });
  }, [store]);

  return <ProfileContext.Provider value={store}>{children}</ProfileContext.Provider>;
}

const noStore = { get: () => null, subscribe: () => () => {} };

/** The profile (null while loading, signed out or if loading failed) and how to change it. */
export function useProfile(): {
  profile: Profile | null;
  update: (patch: ProfilePatch) => Promise<void>;
} {
  const store = useContext(ProfileContext);
  const source = store ?? noStore;
  const profile = useSyncExternalStore(source.subscribe, source.get, source.get);
  const update = useMemo(
    () => (patch: ProfilePatch) =>
      store ? store.update(patch) : Promise.reject(new Error('Not signed in')),
    [store],
  );
  return { profile, update };
}
