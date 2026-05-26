// RN Supabase client, built from the shared platform-agnostic factory.
// RN-only glue (URL polyfill, AsyncStorage, AppState) stays in the app — it must
// never leak into the shared @momma-mia/supabase package.
import 'react-native-url-polyfill/auto'; // MUST be the first import (RN lacks URL/URLSearchParams)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createSupabaseClient } from '@momma-mia/supabase';

export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // no URL bar in RN
    },
  },
);

// Refresh the session while the app is foregrounded. Offline-refresh hardening
// (NetInfo gate) is deferred to the auth phase, where sessions actually exist.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
