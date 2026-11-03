import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from '../lib/dataService';

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from
  }
}));

describe('Module-specific Supabase persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
    supabaseMocks.upsert.mockResolvedValue({ error: null });
    supabaseMocks.from.mockImplementation(() => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: supabaseMocks.upsert
      };
      return query;
    });
  });

  it('stores habit definitions and completions in separate tables', async () => {
    const habits = [{
      id: 'habit-1',
      title: 'Read',
      category: 'Personal',
      targetDaysPerWeek: 5,
      weekdays: [0, 1],
      completedDates: ['2026-11-02'],
      streak: 1,
      bestStreak: 1,
      color: '#10B981'
    }];

    await dataService.saveHabits(habits);

    expect(supabaseMocks.from).toHaveBeenCalledWith('habits');
    expect(supabaseMocks.upsert).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        id: 'habit-1',
        user_id: 'user-1',
        target_days_per_week: 5,
        weekdays: [0, 1]
      })
    ], { onConflict: 'user_id,id' });
    expect(supabaseMocks.from).toHaveBeenCalledWith('habit_completions');
    expect(supabaseMocks.upsert).toHaveBeenNthCalledWith(2, [
      { user_id: 'user-1', habit_id: 'habit-1', entry_date: '2026-11-02' }
    ], { onConflict: 'user_id,habit_id,entry_date' });
  });

  it('stores each daily task as an authenticated row in its own table', async () => {
    const tasks = [{
      id: 'task-1',
      title: 'Review project',
      date: '2026-11-02',
      completed: false,
      priority: 'high' as const,
      category: 'Work'
    }];

    await dataService.saveTasks(tasks);

    expect(supabaseMocks.from).toHaveBeenCalledWith('daily_tasks');
    expect(supabaseMocks.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'task-1',
        user_id: 'user-1',
        entry_date: '2026-11-02',
        title: 'Review project',
        priority: 'high'
      })
    ], { onConflict: 'user_id,id' });
  });

  it('stores wellness entries and settings in their own tables', async () => {
    await dataService.saveWellnessEntry({
      date: '2026-11-02',
      mood: 'good',
      waterGlasses: 4,
      sleepHours: 7,
      energyScore: 3,
      journalNotes: 'Good day',
      gratitude: 'Family'
    });
    await dataService.saveUserSettings({
      taskCategories: ['Work'],
      habitCategories: ['Health'],
      expenseCategories: {}
    });

    expect(supabaseMocks.from).toHaveBeenCalledWith('daily_wellness');
    expect(supabaseMocks.from).toHaveBeenCalledWith('user_settings');
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        entry_date: '2026-11-02',
        water_glasses: 4,
        sleep_hours: 7,
        mood: 'good',
        energy_score: 3
      }),
      { onConflict: 'user_id,entry_date' }
    );
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', task_categories: ['Work'] }),
      { onConflict: 'user_id' }
    );
  });

  it('loads the selected wellness fields from the user-scoped Supabase table', async () => {
    const row = {
      entry_date: '2026-11-02',
      mood: 'good',
      water_glasses: 4,
      sleep_hours: 7,
      energy_score: 3,
      journal_notes: 'Good day',
      gratitude: 'Family'
    };
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [row], error: null })
    };
    supabaseMocks.from.mockReturnValueOnce(query);

    await expect(dataService.loadWellness()).resolves.toEqual({
      '2026-11-02': {
        date: '2026-11-02',
        mood: 'good',
        waterGlasses: 4,
        sleepHours: 7,
        energyScore: 3,
        journalNotes: 'Good day',
        gratitude: 'Family'
      }
    });
    expect(supabaseMocks.from).toHaveBeenCalledWith('daily_wellness');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('surfaces Supabase errors instead of reporting a successful save', async () => {
    const databaseError = new Error('row-level security policy');
    supabaseMocks.upsert.mockResolvedValue({ error: databaseError });

    await expect(dataService.saveHabits([{
      id: 'habit-1',
      title: 'Read',
      category: 'Personal',
      targetDaysPerWeek: 5,
      completedDates: [],
      streak: 0,
      bestStreak: 0,
      color: '#10B981'
    }])).rejects.toBe(databaseError);
    await expect(dataService.saveTasks([{
      id: 'task-1',
      title: 'Review project',
      date: '2026-11-02',
      completed: false,
      priority: 'high'
    }])).rejects.toBe(databaseError);
  });
});
