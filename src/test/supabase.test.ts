import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSupabaseConfig = async (url: string, key: string) => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
  return import('../lib/supabase');
};

const jwtForRole = (role: string) =>
  `eyJhbGciOiJub25lIn0.${btoa(JSON.stringify({ role }))}.signature`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Supabase client configuration', () => {
  it('accepts an HTTPS project URL with a publishable key', async () => {
    const config = await loadSupabaseConfig(
      'https://project.supabase.co',
      'sb_publishable_test_key'
    );

    expect(config.isSupabaseConfigured()).toBe(true);
    expect(config.supabase).not.toBeNull();
  });

  it('accepts a legacy anon JWT', async () => {
    const config = await loadSupabaseConfig(
      'https://project.supabase.co',
      jwtForRole('anon')
    );

    expect(config.isSupabaseConfigured()).toBe(true);
  });

  it('rejects service-role JWTs', async () => {
    const config = await loadSupabaseConfig(
      'https://project.supabase.co',
      jwtForRole('service_role')
    );

    expect(config.isSupabaseConfigured()).toBe(false);
    expect(config.supabase).toBeNull();
  });

  it('rejects database connection strings as project URLs', async () => {
    const config = await loadSupabaseConfig(
      'postgresql://postgres:password@db.project.supabase.co:5432/postgres',
      'sb_publishable_test_key'
    );

    expect(config.isSupabaseConfigured()).toBe(false);
  });
});
