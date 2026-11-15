import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Visible in the console so a missing .env is obvious during the hackathon.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (copy .env.example to .env).');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
