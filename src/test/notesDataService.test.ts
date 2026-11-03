import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notesService } from '../features/notes/notesService';

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  not: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from
  }
}));

const savedNote = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Journal',
  content: 'A note',
  category: 'Personal',
  image_url: null,
  created_at: '2026-11-02T12:00:00.000Z',
  updated_at: null
};

describe('Notes persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
    supabaseMocks.insert.mockReturnThis();
    supabaseMocks.update.mockReturnThis();
    supabaseMocks.delete.mockReturnThis();
    supabaseMocks.upsert.mockReturnThis();
    supabaseMocks.select.mockReturnThis();
    supabaseMocks.eq.mockReturnThis();
    supabaseMocks.not.mockReturnThis();
    supabaseMocks.single.mockResolvedValue({ data: savedNote, error: null });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: { id: savedNote.id }, error: null });
    supabaseMocks.from.mockReturnValue({
      insert: supabaseMocks.insert,
      update: supabaseMocks.update,
      delete: supabaseMocks.delete,
      upsert: supabaseMocks.upsert,
      select: supabaseMocks.select,
      eq: supabaseMocks.eq,
      not: supabaseMocks.not,
      single: supabaseMocks.single,
      maybeSingle: supabaseMocks.maybeSingle
    });
  });

  it('lets Supabase generate the note UUID and returns its saved row', async () => {
    const note = await notesService.saveNote({
      title: 'Journal',
      content: 'A note',
      category: 'Personal'
    });

    expect(supabaseMocks.from).toHaveBeenCalledWith('notes');
    expect(supabaseMocks.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'Journal',
      content: 'A note',
      category: 'Personal',
      image_url: null
    });
    expect(supabaseMocks.select).toHaveBeenCalledWith('*');
    expect(note.id).toBe(savedNote.id);
  });

  it('surfaces a missing note when an update matches no row', async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(notesService.updateNote('missing-note', { title: 'Updated' }))
      .rejects.toThrow('The note was not found or could not be updated.');
  });

  it('surfaces Supabase errors when saving a note', async () => {
    const databaseError = new Error('row-level security policy');
    supabaseMocks.single.mockResolvedValue({ data: null, error: databaseError });

    await expect(notesService.saveNote({
      title: 'Journal',
      content: 'A note',
      category: 'Personal'
    })).rejects.toBe(databaseError);
  });
});
