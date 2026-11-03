import { supabase } from './supabase';
import {
  BudgetConfig,
  DailyTask,
  DailyWellness,
  Expense,
  Habit,
  UserSettings
} from '../types';
import { DEFAULT_BUDGET as MONTHLY_BUDGET, DEFAULT_CATEGORY_BUDGETS } from '../utils/constants';

const DEFAULT_BUDGET: BudgetConfig = {
  monthlyBudget: MONTHLY_BUDGET,
  currency: '₹',
  categoryBudgets: DEFAULT_CATEGORY_BUDGETS
};

const DEFAULT_SETTINGS: UserSettings = {
  taskCategories: [],
  habitCategories: [],
  expenseCategories: {}
};

type DataTable = 'habits' | 'habit_completions' | 'daily_tasks' | 'daily_wellness';

const requireClient = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

const requireUser = async () => {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You must be signed in to access your Daymark data.');
  return { client, user: data.user };
};

type ExpenseInput = Omit<Expense, 'id' | 'createdAt'> & Partial<Pick<Expense, 'id' | 'createdAt'>>;

const isUuid = (id: string | undefined): id is string =>
  Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));

const toExpenseRow = (expense: ExpenseInput, userId: string) => ({
  ...(isUuid(expense.id) ? { id: expense.id } : {}),
  user_id: userId,
  entry_date: expense.date,
  title: expense.title,
  amount: expense.amount,
  category: expense.category,
  type: expense.type ?? 'expense',
  account: expense.account ?? 'expense',
  is_transfer: expense.isTransfer ?? false,
  spend_type: expense.spendType ?? 'need',
  payment_method: expense.paymentMethod,
  notes: expense.notes ?? null,
  is_recurring: expense.isRecurring ?? false
});

const fromExpenseRow = (row: {
  id: string;
  title: string;
  amount: number | string;
  category: string;
  entry_date: string;
  payment_method: string | null;
  type: 'expense' | 'income' | null;
  account: 'expense' | 'savings' | 'cash' | null;
  is_transfer: boolean | null;
  notes: string | null;
  is_recurring: boolean | null;
  spend_type: 'need' | 'want' | 'savings' | null;
  created_at: string;
}): Expense => ({
  id: row.id,
  title: row.title,
  amount: Number(row.amount),
  category: row.category,
  date: row.entry_date,
  paymentMethod: row.payment_method ?? 'Credit Card',
  type: row.type ?? 'expense',
  account: row.account ?? 'expense',
  isTransfer: row.is_transfer ?? false,
  notes: row.notes ?? undefined,
  isRecurring: row.is_recurring ?? false,
  spendType: row.spend_type ?? 'need',
  createdAt: new Date(row.created_at).getTime()
});

async function removeRowsNotIn(
  client: ReturnType<typeof requireClient>,
  table: DataTable,
  userId: string,
  retainedIds: Set<string>
): Promise<void> {
  const { data, error } = await client
    .from(table)
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;

  const staleIds = (data ?? [])
    .map(row => row.id as string)
    .filter(id => !retainedIds.has(id));
  if (staleIds.length === 0) return;

  const { error: deleteError } = await client
    .from(table)
    .delete()
    .eq('user_id', userId)
    .in('id', staleIds);
  if (deleteError) throw deleteError;
}

export const dataService = {
  async loadExpenses(): Promise<Expense[]> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromExpenseRow);
  },

  async saveExpenses(expenses: ExpenseInput[]): Promise<Expense[]> {
    const { client, user } = await requireUser();
    const rows = expenses.map(expense => toExpenseRow(expense, user.id));
    let savedRows: Expense[] = [];

    if (rows.length > 0) {
      const { data, error } = await client.from('expenses').upsert(rows).select('*');
      if (error) throw error;
      savedRows = (data ?? []).map(fromExpenseRow);
      if (savedRows.length !== rows.length) {
        throw new Error('Supabase did not confirm every imported expense. No existing expenses were removed.');
      }
    }

    const ids = savedRows.map(expense => expense.id);
    let deleteQuery = client.from('expenses').delete().eq('user_id', user.id);
    if (ids.length > 0) {
      deleteQuery = deleteQuery.not('id', 'in', `(${ids.join(',')})`);
    }
    const { error } = await deleteQuery;
    if (error) throw error;
    return savedRows;
  },

  async insertExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }

    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('expenses')
      .insert(toExpenseRow(expense, user.id))
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Supabase did not return the saved expense.');
    return fromExpenseRow(data);
  },

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
    const { client, user } = await requireUser();
    const row: Record<string, unknown> = {};
    if (updates.title !== undefined) row.title = updates.title;
    if (updates.amount !== undefined) row.amount = updates.amount;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.date !== undefined) row.entry_date = updates.date;
    if (updates.paymentMethod !== undefined) row.payment_method = updates.paymentMethod;
    if (updates.type !== undefined) row.type = updates.type;
    if (updates.account !== undefined) row.account = updates.account;
    if (updates.isTransfer !== undefined) row.is_transfer = updates.isTransfer;
    if (updates.notes !== undefined) row.notes = updates.notes ?? null;
    if (updates.isRecurring !== undefined) row.is_recurring = updates.isRecurring;
    if (updates.spendType !== undefined) row.spend_type = updates.spendType;

    if (Object.keys(row).length === 0) {
      throw new Error('There are no expense changes to save.');
    }
    if (updates.amount !== undefined && (!Number.isFinite(updates.amount) || updates.amount <= 0)) {
      throw new Error('Expense amount must be greater than zero.');
    }

    const { data, error } = await client
      .from('expenses')
      .update(row)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new Error('The expense was not found or could not be updated.');
    return fromExpenseRow(data);
  },

  async deleteExpense(id: string): Promise<void> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('The expense was not found or could not be deleted.');
  },

  async reassignExpenseCategory(fromCategory: string, toCategory: string): Promise<void> {
    const { client, user } = await requireUser();
    const { error } = await client
      .from('expenses')
      .update({ category: toCategory })
      .eq('user_id', user.id)
      .eq('category', fromCategory);
    if (error) throw error;
  },

  async loadBudgetConfig(): Promise<BudgetConfig> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('budget_configs')
      .select('monthly_budget,currency,category_budgets')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return DEFAULT_BUDGET;
    return {
      monthlyBudget: Number(data.monthly_budget),
      currency: data.currency,
      categoryBudgets: data.category_budgets ?? {}
    };
  },

  async saveBudgetConfig(config: BudgetConfig): Promise<void> {
    const { client, user } = await requireUser();
    const { error } = await client.from('budget_configs').upsert(
      {
        user_id: user.id,
        monthly_budget: config.monthlyBudget,
        currency: config.currency,
        category_budgets: config.categoryBudgets,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  },

  async loadHabits(): Promise<Habit[]> {
    const { client, user } = await requireUser();
    const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] =
      await Promise.all([
        client.from('habits').select('*').eq('user_id', user.id).order('created_at'),
        client.from('habit_completions').select('habit_id,entry_date').eq('user_id', user.id)
      ]);
    if (habitsError) throw habitsError;
    if (completionsError) throw completionsError;

    const completedDates = new Map<string, string[]>();
    for (const completion of completions ?? []) {
      const dates = completedDates.get(completion.habit_id) ?? [];
      dates.push(completion.entry_date);
      completedDates.set(completion.habit_id, dates);
    }

    return (habits ?? []).map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      targetDaysPerWeek: row.target_days_per_week,
      weekdays: row.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      completedDates: completedDates.get(row.id) ?? [],
      streak: row.streak,
      bestStreak: row.best_streak,
      color: row.color
    }));
  },

  async saveHabits(habits: Habit[]): Promise<void> {
    const { client, user } = await requireUser();
    const habitRows = habits.map(habit => ({
      id: habit.id,
      user_id: user.id,
      title: habit.title,
      category: habit.category,
      target_days_per_week: habit.targetDaysPerWeek,
      weekdays: habit.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      streak: habit.streak,
      best_streak: habit.bestStreak,
      color: habit.color,
      updated_at: new Date().toISOString()
    }));
    if (habitRows.length > 0) {
      const { error } = await client
        .from('habits')
        .upsert(habitRows, { onConflict: 'user_id,id' });
      if (error) throw error;
    }

    const completionRows = habits.flatMap(habit =>
      [...new Set(habit.completedDates)].map(entryDate => ({
        user_id: user.id,
        habit_id: habit.id,
        entry_date: entryDate
      }))
    );
    if (completionRows.length > 0) {
      const { error } = await client
        .from('habit_completions')
        .upsert(completionRows, { onConflict: 'user_id,habit_id,entry_date' });
      if (error) throw error;
    }

    const { data: existingCompletions, error: completionError } = await client
      .from('habit_completions')
      .select('id,user_id,habit_id,entry_date')
      .eq('user_id', user.id);
    if (completionError) throw completionError;
    const retainedCompletions = new Set(
      completionRows.map(row => `${row.habit_id}:${row.entry_date}`)
    );
    const staleCompletionIds = (existingCompletions ?? [])
      .filter(row => !retainedCompletions.has(`${row.habit_id}:${row.entry_date}`))
      .map(row => row.id);
    if (staleCompletionIds.length > 0) {
      const { error } = await client
        .from('habit_completions')
        .delete()
        .eq('user_id', user.id)
        .in('id', staleCompletionIds);
      if (error) throw error;
    }

    await removeRowsNotIn(client, 'habits', user.id, new Set(habits.map(habit => habit.id)));
  },

  async loadTasks(): Promise<DailyTask[]> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('daily_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });
    if (error) throw error;

    return (data ?? []).map(row => ({
      id: row.id,
      date: row.entry_date,
      title: row.title,
      completed: row.completed,
      priority: row.priority,
      timeEstimateMin: row.time_estimate_min ?? undefined,
      category: row.category ?? undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined
    }));
  },

  async saveTasks(tasks: DailyTask[]): Promise<void> {
    const { client, user } = await requireUser();
    const rows = tasks.map(task => ({
      id: task.id,
      user_id: user.id,
      entry_date: task.date,
      title: task.title,
      completed: task.completed,
      priority: task.priority,
      time_estimate_min: task.timeEstimateMin ?? null,
      category: task.category ?? null,
      completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
      updated_at: new Date().toISOString()
    }));
    if (rows.length > 0) {
      const { error } = await client
        .from('daily_tasks')
        .upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
    }
    await removeRowsNotIn(client, 'daily_tasks', user.id, new Set(tasks.map(task => task.id)));
  },

  async loadWellness(): Promise<Record<string, DailyWellness>> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('daily_wellness')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });
    if (error) throw error;

    return Object.fromEntries((data ?? []).map(row => [row.entry_date, {
      date: row.entry_date,
      mood: row.mood ?? undefined,
      waterGlasses: Number(row.water_glasses),
      sleepHours: Number(row.sleep_hours),
      energyScore: row.energy_score,
      journalNotes: row.journal_notes,
      gratitude: row.gratitude
    }]));
  },

  async saveWellness(wellness: Record<string, DailyWellness>): Promise<void> {
    const { client, user } = await requireUser();
    const rows = Object.values(wellness).map(entry => ({
      user_id: user.id,
      entry_date: entry.date,
      mood: entry.mood ?? null,
      water_glasses: entry.waterGlasses,
      sleep_hours: entry.sleepHours,
      energy_score: entry.energyScore,
      journal_notes: entry.journalNotes,
      gratitude: entry.gratitude,
      updated_at: new Date().toISOString()
    }));
    if (rows.length > 0) {
      const { error } = await client
        .from('daily_wellness')
        .upsert(rows, { onConflict: 'user_id,entry_date' });
      if (error) throw error;
    }
    await removeRowsNotIn(
      client,
      'daily_wellness',
      user.id,
      new Set(rows.map(row => row.entry_date))
    );
  },

  async saveWellnessEntry(entry: DailyWellness): Promise<void> {
    const { client, user } = await requireUser();
    const { error } = await client.from('daily_wellness').upsert(
      {
        user_id: user.id,
        entry_date: entry.date,
        mood: entry.mood ?? null,
        water_glasses: entry.waterGlasses,
        sleep_hours: entry.sleepHours,
        energy_score: entry.energyScore,
        journal_notes: entry.journalNotes,
        gratitude: entry.gratitude,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,entry_date' }
    );
    if (error) throw error;
  },

  async loadUserSettings(): Promise<UserSettings> {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from('user_settings')
      .select('task_categories,habit_categories,expense_categories,theme')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;

    return {
      taskCategories: Array.isArray(data?.task_categories) ? data.task_categories : [],
      habitCategories: Array.isArray(data?.habit_categories) ? data.habit_categories : [],
      expenseCategories: data?.expense_categories && typeof data.expense_categories === 'object'
        ? data.expense_categories
        : {},
      theme: data?.theme ?? undefined
    };
  },

  async saveUserSettings(settings: UserSettings): Promise<void> {
    const { client, user } = await requireUser();
    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        task_categories: settings.taskCategories,
        habit_categories: settings.habitCategories,
        expense_categories: settings.expenseCategories,
        theme: settings.theme ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }
};
