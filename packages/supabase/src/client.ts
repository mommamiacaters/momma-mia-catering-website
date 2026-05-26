// Platform-agnostic Supabase client factory.
// INVARIANT: this package never reads env and never imports react/react-native.
// Each app injects its own url/key and platform-specific auth options
// (web: browser storage + detectSessionInUrl; mobile: AsyncStorage + polyfill).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@momma-mia/db';

// Derive the options type from createClient itself so it always matches the
// installed supabase-js, instead of hand-pinning SupabaseClientOptions<'public'>.
type ClientOptions = Parameters<typeof createClient<Database>>[2];

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: ClientOptions,
) {
  return createClient<Database>(url, anonKey, options);
}

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;
