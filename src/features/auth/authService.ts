import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AppProfile } from '../../lib/types';

export const authService = {
  isConfigured: isSupabaseConfigured,

  async signUp(email: string, password: string, fullName?: string) {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });

    return { user: data.user, session: data.session, error };
  },

  async signIn(email: string, password: string) {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    return { user: data.user, error };
  },

  async signOut() {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser(): Promise<AppProfile | null> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) return null;

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url
    };
  },

  onAuthStateChange(callback: (user: AppProfile | null) => void) {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url
        });
      } else {
        callback(null);
      }
    });

    return {
      unsubscribe: () => subscription.unsubscribe()
    };
  }
};
