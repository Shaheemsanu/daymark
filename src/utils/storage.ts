import { Expense, BudgetConfig, Habit, DailyTask, DailyWellness } from '../types';
import { DEFAULT_BUDGET, DEFAULT_CATEGORY_BUDGETS } from './constants';
import { dataService } from '../lib/dataService';
import { notesService } from '../features/notes/notesService';

export function getInitialSeedData() {
  return {
    expenses: [] as Expense[],
    budget: {
      monthlyBudget: DEFAULT_BUDGET,
      currency: '₹',
      categoryBudgets: { ...DEFAULT_CATEGORY_BUDGETS }
    } as BudgetConfig,
    habits: [] as Habit[],
    tasks: [] as DailyTask[],
    wellness: {} as Record<string, DailyWellness>
  };
}

export const loadExpenses = async (): Promise<Expense[]> => {
  return await dataService.loadExpenses();
};

export const saveExpenses = async (expenses: Expense[]): Promise<Expense[]> => {
  return dataService.saveExpenses(expenses);
};

export const loadBudgetConfig = async (): Promise<BudgetConfig> => {
  return dataService.loadBudgetConfig();
};

export const saveBudgetConfig = async (config: BudgetConfig): Promise<void> => {
  await dataService.saveBudgetConfig(config);
};

export const loadHabits = async (): Promise<Habit[]> => {
  return await dataService.loadHabits();
};

export const saveHabits = async (habits: Habit[]): Promise<void> => {
  await dataService.saveHabits(habits);
};

export const loadTasks = async (): Promise<DailyTask[]> => {
  return await dataService.loadTasks();
};

export const saveTasks = async (tasks: DailyTask[]): Promise<void> => {
  await dataService.saveTasks(tasks);
};

export const loadWellness = async (): Promise<Record<string, DailyWellness>> => {
  return await dataService.loadWellness();
};

export const saveWellness = async (wellness: Record<string, DailyWellness>): Promise<void> => {
  await dataService.saveWellness(wellness);
};

export const resetAllData = async (): Promise<void> => {
  const seed = getInitialSeedData();
  await Promise.all([
    saveExpenses(seed.expenses),
    saveBudgetConfig(seed.budget),
    saveHabits(seed.habits),
    saveTasks(seed.tasks),
    saveWellness(seed.wellness),
    notesService.clearNotes(),
    dataService.saveUserSettings({
      taskCategories: [],
      habitCategories: [],
      expenseCategories: {}
    })
  ]);
};

export const exportAllDataAsJSON = async (): Promise<string> => {
  const [expenses, budget, habits, tasks, wellness, settings, notes] = await Promise.all([
    loadExpenses(),
    loadBudgetConfig(),
    loadHabits(),
    loadTasks(),
    loadWellness(),
    dataService.loadUserSettings(),
    notesService.getNotes()
  ]);
  const data = {
    expenses,
    budget,
    habits,
    tasks,
    wellness,
    settings,
    notes,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  return JSON.stringify(data, null, 2);
};

export const exportExpensesAsCSV = (expenses: Expense[]): string => {
  const headers = ['Date', 'Title', 'Amount', 'Category', 'Payment Method', 'Spend Type', 'Recurring', 'Notes'];
  const rows = expenses.map(e => [
    `"${e.date}"`,
    `"${e.title.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${e.category}"`,
    `"${e.paymentMethod}"`,
    `"${e.spendType}"`,
    e.isRecurring ? 'Yes' : 'No',
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};
