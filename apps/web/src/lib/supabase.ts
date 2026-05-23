// Single shared Supabase browser client for the website.
// Only the PUBLISHABLE (anon) key is used here — row-level security on the
// database is what actually protects data, not key secrecy.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@momma-mia/db';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Fail loudly in dev rather than silently making unauthenticated calls.
  console.error(
    'Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
