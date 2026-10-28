import type { Profile } from '@daybrief/core';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api, bearer } from './api';
import { devMock } from './dev-mock';

/** The signed-in user's profile from `GET /me`; null while loading or if the request failed. */
export function useMe(): Profile | null {
  const { session } = useAuth();
  const token = session?.access_token;
  const [profile, setProfile] = useState<Profile | null>(devMock?.profile ?? null);

  useEffect(() => {
    if (devMock || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.me.$get({}, bearer(token));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!cancelled) setProfile(body);
      } catch (e) {
        // The screen falls back to the name from the session.
        console.warn('Loading the profile failed:', e instanceof Error ? e.message : e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return profile;
}
