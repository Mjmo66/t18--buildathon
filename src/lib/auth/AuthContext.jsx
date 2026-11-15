import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ensurePublicKeyPublished } from '../chat';

const AuthContext = createContext(null);

// Provides { session, user, profile, charity, loading, refreshProfile, signOut }.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [charity, setCharity] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s) => {
    if (!s?.user) { setProfile(null); setCharity(null); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(p ?? null);
    if (p?.role === 'charity') {
      const { data: c } = await supabase.from('charities').select('*').eq('profile_id', s.user.id).maybeSingle();
      setCharity(c ?? null);
    } else {
      setCharity(null);
    }
    // Publish the E2E chat key once per sign-in; failures must not block the app.
    ensurePublicKeyPublished(s.user.id).catch((e) => console.warn('E2E key publish failed', e));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: calling supabase inside this callback can deadlock the auth lock.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    charity,
    loading,
    refreshProfile: () => loadProfile(session),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
