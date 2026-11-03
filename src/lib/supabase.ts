import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isValidSupabaseUrl = (): boolean => {
  try {
    const url = new URL(supabaseUrl);
    const isLocalHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);

    return (
      (url.protocol === 'https:' || isLocalHttp) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

const isPublicSupabaseKey = (): boolean => {
  if (supabaseAnonKey.startsWith('sb_publishable_')) return true;

  const [, encodedClaims] = supabaseAnonKey.split('.');
  if (!encodedClaims) return false;

  try {
    const base64 = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return claims.role === 'anon';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = (): boolean => {
  return isValidSupabaseUrl() && isPublicSupabaseKey();
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
