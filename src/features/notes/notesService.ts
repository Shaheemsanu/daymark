import { NoteItem } from '../../types';
import { supabase } from '../../lib/supabase';

const isUuid = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

const fromNoteRow = (item: {
  id: string;
  title: string;
  content: string;
  category: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
}): NoteItem => ({
  id: item.id,
  title: item.title,
  content: item.content,
  category: item.category || 'General',
  imageUrl: item.image_url ?? undefined,
  createdAt: new Date(item.created_at).getTime(),
  updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : undefined
});

async function getAuthenticatedClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You must be signed in to access your notes.');
  return { client: supabase, userId: data.user.id };
}

export const notesService = {
  async getNotes(): Promise<NoteItem[]> {
    const { client, userId } = await getAuthenticatedClient();
    const { data, error } = await client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(fromNoteRow);
  },

  async saveNote(note: Omit<NoteItem, 'id' | 'createdAt'>): Promise<NoteItem> {
    const { client, userId } = await getAuthenticatedClient();
    const { data, error } = await client.from('notes').insert({
      user_id: userId,
      title: note.title,
      content: note.content,
      category: note.category || 'General',
      image_url: note.imageUrl ?? null
    }).select('*').single();

    if (error) throw error;
    if (!data) throw new Error('Supabase did not return the saved note.');
    return fromNoteRow(data);
  },

  async saveNotes(notes: NoteItem[]): Promise<void> {
    const { client, userId } = await getAuthenticatedClient();
    const rows = notes.map(note => ({
      ...(isUuid(note.id) ? { id: note.id } : {}),
      user_id: userId,
      title: note.title,
      content: note.content,
      category: note.category || 'General',
      image_url: note.imageUrl ?? null,
      created_at: new Date(note.createdAt).toISOString(),
      updated_at: note.updatedAt ? new Date(note.updatedAt).toISOString() : null
    }));

    let savedIds: string[] = [];
    if (rows.length > 0) {
      const { data, error } = await client.from('notes').upsert(rows).select('id');
      if (error) throw error;
      savedIds = (data ?? []).map(row => row.id);
      if (savedIds.length !== rows.length) {
        throw new Error('Supabase did not confirm every imported note. Existing notes were not removed.');
      }
    }

    let deleteQuery = client.from('notes').delete().eq('user_id', userId);
    if (savedIds.length > 0) deleteQuery = deleteQuery.not('id', 'in', `(${savedIds.join(',')})`);
    const { error } = await deleteQuery;
    if (error) throw error;
  },

  async clearNotes(): Promise<void> {
    const { client, userId } = await getAuthenticatedClient();
    const { error } = await client.from('notes').delete().eq('user_id', userId);
    if (error) throw error;
  },

  async updateNote(id: string, partial: Partial<NoteItem>): Promise<void> {
    const { client, userId } = await getAuthenticatedClient();
    const payload: {
      title?: string;
      content?: string;
      category?: string;
      image_url?: string | null;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    if (partial.title !== undefined) payload.title = partial.title;
    if (partial.content !== undefined) payload.content = partial.content;
    if (partial.category !== undefined) payload.category = partial.category;
    if (partial.imageUrl !== undefined) payload.image_url = partial.imageUrl ?? null;

    const { data, error } = await client.from('notes')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('The note was not found or could not be updated.');
  },

  async deleteNote(id: string): Promise<void> {
    const { client, userId } = await getAuthenticatedClient();
    const { data, error } = await client.from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('The note was not found or could not be deleted.');
  }
};
