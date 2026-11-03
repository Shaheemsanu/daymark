import { describe, it, expect, vi } from 'vitest';
import { authService } from '../features/auth/authService';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  supabase: null
}));

describe('Supabase authentication configuration', () => {
  it('does not create a local account when Supabase is unavailable', async () => {
    await expect(authService.signIn('alex@daymark.dev', 'password123'))
      .rejects.toThrow('Supabase is not configured');
  });

  it('does not return a local profile when Supabase is unavailable', async () => {
    await expect(authService.getCurrentUser())
      .rejects.toThrow('Supabase is not configured');
  });

  it('does not silently sign out without Supabase', async () => {
    await expect(authService.signOut())
      .rejects.toThrow('Supabase is not configured');
  });
});
