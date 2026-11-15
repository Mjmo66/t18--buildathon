// Data access for the volunteer pages (Supabase, RLS: own prefs and signups only).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export const PREFS_SKIP_KEY = 'kindred.prefsSkipped';

/** Own volunteer_prefs row: { prefs (null if none), loading, error, reload }. */
export function usePrefs(userId) {
  const [state, setState] = useState({ prefs: null, loading: true, error: null });
  const reload = useCallback(async () => {
    if (!userId) { setState({ prefs: null, loading: false, error: null }); return; }
    const { data, error } = await supabase.from('volunteer_prefs').select('*').eq('profile_id', userId).maybeSingle();
    setState({ prefs: data ?? null, loading: false, error: error?.message ?? null });
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export const REQUEST_SELECT = '*, charities(org_name, verified_at, description, website)';
export const SIGNUP_SELECT = '*, requests(id, title, duration_hours, address, charity_id, status, charities(org_name))';

export function skippedPrefs() {
  try { return localStorage.getItem(PREFS_SKIP_KEY) === '1'; } catch { return false; }
}
export function setSkippedPrefs() {
  try { localStorage.setItem(PREFS_SKIP_KEY, '1'); } catch { /* storage blocked: ignore */ }
}
