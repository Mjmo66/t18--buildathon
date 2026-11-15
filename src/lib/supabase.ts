import { createClient } from '@supabase/supabase-js';

// Public project URL and anon key (role "anon": safe in the browser, data is protected by RLS).
// Built in as defaults so the app runs where there is no .env, e.g. in Lovable; .env still overrides.
const DEFAULT_URL = 'https://rbhumyrjpgpwgsmhcttg.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiaHVteXJqcGdwd2dzbWhjdHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzgwNjgsImV4cCI6MjExMDMxNDA2OH0.1fLCcNAKew0Kvg8ygZvsQLHnNfNQ0-3D6D7tWLfi48U';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
