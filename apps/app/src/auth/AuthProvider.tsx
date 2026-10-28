import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { devMock } from '../lib/dev-mock';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    devMock ? { session: devMock.session, loading: false } : { session: null, loading: true },
  );

  useEffect(() => {
    if (devMock) return;
    // Fires INITIAL_SESSION right away, then on every sign-in, refresh and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
