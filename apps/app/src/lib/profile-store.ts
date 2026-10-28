import { isTimeZone, type Profile, type ProfilePatch } from '@daybrief/core';

export interface ProfileStoreDeps {
  /** `GET /me`. */
  fetchProfile: () => Promise<Profile>;
  /** `PATCH /me`; resolves with the saved profile. */
  saveProfile: (patch: ProfilePatch) => Promise<Profile>;
  /** Side effects of a profile outside React state: the UI language. */
  apply: (profile: Profile) => void;
  /** The device's IANA time zone. */
  deviceTimeZone: () => string | undefined;
}

export interface ProfileStore {
  get: () => Profile | null;
  subscribe: (listener: () => void) => () => void;
  /** Loads the profile, applies it and reports the time zone if the profile has none. */
  load: () => Promise<void>;
  /**
   * Applies the change at once, then saves it. If saving fails, the change is rolled back
   * (unless a newer change has replaced it) and the error is rethrown for the UI to show.
   */
  update: (patch: ProfilePatch) => Promise<void>;
}

/** The signed-in user's profile: one copy for the whole app, saved optimistically. */
export function createProfileStore(deps: ProfileStoreDeps): ProfileStore {
  let profile: Profile | null = null;
  // Bumped by every local change, so a slow response never overwrites a newer choice.
  let version = 0;
  const listeners = new Set<() => void>();

  const set = (next: Profile) => {
    profile = next;
    deps.apply(next);
    for (const listener of listeners) listener();
  };

  const update = async (patch: ProfilePatch) => {
    if (!profile) throw new Error('Profile is not loaded');
    const before = profile;
    const mine = ++version;
    set({ ...before, ...patch });
    try {
      const saved = await deps.saveProfile(patch);
      if (mine === version) set(saved);
    } catch (e) {
      if (mine === version) set(before);
      throw e;
    }
  };

  return {
    get: () => profile,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async load() {
      const loaded = await deps.fetchProfile();
      // A change made while loading wins over the loaded copy.
      if (version === 0) set(loaded);
      const timeZone = deps.deviceTimeZone();
      if (profile && profile.timezone === null && isTimeZone(timeZone)) {
        await update({ timezone: timeZone });
      }
    },
    update,
  };
}
