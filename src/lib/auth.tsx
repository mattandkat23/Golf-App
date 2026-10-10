import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { knownUser } from './sync';

interface AuthState {
  session: Session | null;
  /** True while a password-reset code has been accepted but the new password isn't set yet. */
  recovering: boolean;
  setRecovering: (on: boolean) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>();
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  return <AuthContext.Provider value={{ session, recovering, setRecovering }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth needs an AuthProvider');
  return ctx;
}

/**
 * Whether to show the app. A parent who has signed in on this phone before keeps using it offline
 * (on the course) even if their login couldn't be refreshed without a connection.
 */
export function useSignedIn() {
  const { session, recovering } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (recovering) return false;
  return !!session || (!online && !!knownUser());
}
