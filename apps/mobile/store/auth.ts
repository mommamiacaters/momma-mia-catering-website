import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  /**
   * Call once at app root. Loads the persisted session + subscribes to changes.
   * Returns an unsubscribe function — the root effect must call it on unmount so
   * the auth listener doesn't leak across fast-refresh / remounts.
   */
  init: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  init: () => {
    supabase.auth.getSession().then(({ data }) => set({ session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => set({ session }));
    return () => data.subscription.unsubscribe();
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
