import React, { useState, useEffect, useRef } from 'react';
import {
  Expense,
  BudgetConfig,
  Habit,
  DailyTask,
  DailyWellness,
  AppProfile,
  CategoryInfo,
  UserSettings
} from '../types';
import { dataService } from '../lib/dataService';
import {
  loadExpenses,
  saveExpenses,
  loadBudgetConfig,
  saveBudgetConfig,
  loadHabits,
  saveHabits,
  loadTasks,
  saveTasks,
  loadWellness,
  saveWellness,
  resetAllData,
  getInitialSeedData,
  exportAllDataAsJSON,
  exportExpensesAsCSV
} from '../utils/storage';
import { formatDate, getAllCategories } from '../utils/constants';
import { authService } from '../features/auth/authService';
import { AuthPage } from '../features/auth/AuthPage';
import { Layout, NavView } from './Layout';
import { DailyOverview } from '../components/DailyOverview';
import { HabitsView } from '../components/HabitsView';
import { TasksView } from '../components/TasksView';
import { ExpenseDashboard } from '../components/ExpenseDashboard';
import { ReportsPage } from '../features/reports/ReportsPage';
import { HistoryReportsView } from '../components/HistoryReportsView';
import { NotesView } from '../components/NotesView';
import { notesService } from '../features/notes/notesService';
import { createId } from '../lib/id';

export default function App() {
  const [user, setUser] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);

  // Navigation - Daily Overview 1st, Expense 2nd after overview
  const [currentView, setCurrentView] = useState<NavView>('daily');
  const [taskToEditId, setTaskToEditId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Core Data States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<BudgetConfig>({
    monthlyBudget: 30000,
    currency: '₹',
    categoryBudgets: {}
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [savingHabitIds, setSavingHabitIds] = useState<Set<string>>(() => new Set());
  const [savingHabitDates, setSavingHabitDates] = useState<Set<string>>(() => new Set());
  const [savingHabitDeletes, setSavingHabitDeletes] = useState<Set<string>>(() => new Set());
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const [savingTaskActions, setSavingTaskActions] = useState<Set<string>>(() => new Set());
  const [wellness, setWellness] = useState<Record<string, DailyWellness>>({});
  const wellnessRef = useRef<Record<string, DailyWellness>>({});
  const savedWellnessRef = useRef<Record<string, DailyWellness>>({});
  const wellnessSaveQueue = useRef<Record<string, Promise<void>>>({});
  const [userSettings, setUserSettings] = useState<UserSettings>({
    taskCategories: [],
    habitCategories: [],
    expenseCategories: {}
  });

  const [dataLoading, setDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [pendingSaves, setPendingSaves] = useState(0);

  // Quick Log Drawer
  const [pendingExpenseDialog, setPendingExpenseDialog] = useState(false);
  const [pendingTaskDialog, setPendingTaskDialog] = useState(false);
  const [pendingHabitDialog, setPendingHabitDialog] = useState(false);
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Check auth session
  useEffect(() => {
    if (!authService.isConfigured()) {
      setAuthError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      setAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      setAuthError('');
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Could not connect to Supabase Auth.');
      } finally {
        setAuthLoading(false);
      }
    };

    void initAuth();

    const { unsubscribe } = authService.onAuthStateChange(setUser);

    return () => {
      unsubscribe();
    };
  }, [authAttempt]);

  // Load data
  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    const loadAllData = async () => {
      setDataLoading(true);
      setDataLoadError('');
      try {
        const [loadedExpenses, loadedBudget, loadedHabits, loadedTasks, loadedWellness, loadedSettings] =
          await Promise.all([
            loadExpenses(),
            loadBudgetConfig(),
            loadHabits(),
            loadTasks(),
            loadWellness(),
            dataService.loadUserSettings()
          ]);
        setExpenses(loadedExpenses);
        setBudget(loadedBudget);
        setHabits(loadedHabits);
        setTasks(loadedTasks);
        wellnessRef.current = loadedWellness;
        savedWellnessRef.current = loadedWellness;
        setWellness(loadedWellness);
        setUserSettings(loadedSettings);
        setIsDarkMode(loadedSettings.theme
          ? loadedSettings.theme === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch (error) {
        setDataLoadError(error instanceof Error ? error.message : 'Could not load your data from Supabase.');
      } finally {
        setDataLoading(false);
      }
    };
    void loadAllData();
  }, [user, loadAttempt]);

  const persistState = async <T,>(
    setValue: React.Dispatch<React.SetStateAction<T>>,
    previousValue: T,
    nextValue: T,
    save: (value: T) => Promise<void>
  ): Promise<void> => {
    setValue(nextValue);
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await save(nextValue);
    } catch (error) {
      setValue(previousValue);
      setSaveError(error instanceof Error ? error.message : 'Could not save your data to Supabase.');
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const persistWithId = async (
    setSavingIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    persist: () => Promise<void>
  ): Promise<void> => {
    setSavingIds(current => new Set(current).add(id));
    try {
      await persist();
    } finally {
      setSavingIds(current => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const updateUserSettings = async (settings: Partial<UserSettings>) => {
    const nextSettings = { ...userSettings, ...settings };
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await dataService.saveUserSettings(nextSettings);
      setUserSettings(nextSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your settings to Supabase.');
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  // Habit Handlers (Module 1 - same as previous first code)
  const handleToggleHabit = async (habitId: string, dateIso: string) => {
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const isCompleted = h.completedDates.includes(dateIso);
      const newDates = isCompleted
        ? h.completedDates.filter(d => d !== dateIso)
        : [...h.completedDates, dateIso];

      // Recompute streak
      let currentStreak = 0;
      const checkDate = new Date();
      const todayString = formatDate(checkDate);
      let inspect = new Date();

      if (!newDates.includes(todayString)) {
        inspect.setDate(inspect.getDate() - 1);
      }

      while (newDates.includes(formatDate(inspect))) {
        currentStreak++;
        inspect.setDate(inspect.getDate() - 1);
      }

      const bestStreak = Math.max(h.bestStreak, currentStreak);

      return {
        ...h,
        completedDates: newDates,
        streak: currentStreak,
        bestStreak
      };
    });

    await persistWithId(
      setSavingHabitDates,
      `${habitId}:${dateIso}`,
      () => persistState(setHabits, habits, updated, saveHabits)
    );
  };

  const handleAddHabit = async (
    newHabit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'bestStreak'>
  ) => {
    const created: Habit = {
      ...newHabit,
      id: createId(),
      completedDates: [],
      streak: 0,
      bestStreak: 0
    };
    const updated = [...habits, created];
    await persistWithId(
      setSavingHabitIds,
      created.id,
      () => persistState(setHabits, habits, updated, saveHabits)
    );
  };

  const handleUpdateHabit = async (id: string, partial: Partial<Habit>) => {
    const updated = habits.map(h => (h.id === id ? { ...h, ...partial } : h));
    await persistWithId(
      setSavingHabitIds,
      id,
      () => persistState(setHabits, habits, updated, saveHabits)
    );
  };

  const handleDeleteHabit = async (id: string) => {
    const updated = habits.filter(h => h.id !== id);
    await persistWithId(
      setSavingHabitIds,
      id,
      () => persistWithId(
        setSavingHabitDeletes,
        id,
        () => persistState(setHabits, habits, updated, saveHabits)
      )
    );
  };

  // Task Handlers (Module 2 - same as previous first code)
  const handleAddTask = async (newTask: Omit<DailyTask, 'id' | 'completed'>) => {
    const created: DailyTask = {
      ...newTask,
      id: createId(),
      completed: false
    };
    const updated = [created, ...tasks];
    await persistWithId(
      setSavingTaskIds,
      created.id,
      () => persistWithId(
        setSavingTaskActions,
        `${created.id}:create`,
        () => persistState(setTasks, tasks, updated, saveTasks)
      )
    );
  };

  const handleToggleTask = async (taskId: string) => {
    const updated = tasks.map(t =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
        : t
    );
    await persistWithId(
      setSavingTaskIds,
      taskId,
      () => persistWithId(
        setSavingTaskActions,
        `${taskId}:toggle`,
        () => persistState(setTasks, tasks, updated, saveTasks)
      )
    );
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<DailyTask>) => {
    const updated = tasks.map(task => task.id === taskId ? { ...task, ...updates } : task);
    await persistWithId(
      setSavingTaskIds,
      taskId,
      () => persistWithId(
        setSavingTaskActions,
        `${taskId}:update`,
        () => persistState(setTasks, tasks, updated, saveTasks)
      )
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    await persistWithId(
      setSavingTaskIds,
      taskId,
      () => persistWithId(
        setSavingTaskActions,
        `${taskId}:delete`,
        () => persistState(setTasks, tasks, updated, saveTasks)
      )
    );
  };

  const handleRequestTaskEdit = (taskId: string) => {
    setTaskToEditId(taskId);
    setCurrentView('tasks');
  };

  // Expense Handlers (New Dedicated Expense Model)
  const handleAddExpense = async (newExp: Omit<Expense, 'id' | 'createdAt'>) => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      const savedExpense = await dataService.insertExpense(newExp);
      setExpenses(current => [savedExpense, ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your expense to Supabase.';
      setSaveError(message);
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleUpdateExpense = async (id: string, partial: Partial<Expense>) => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      const savedExpense = await dataService.updateExpense(id, partial);
      setExpenses(current => current.map(expense => expense.id === id ? savedExpense : expense));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not update your expense in Supabase.');
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await dataService.deleteExpense(id);
      setExpenses(current => current.filter(expense => expense.id !== id));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not delete your expense from Supabase.');
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleUpdateBudget = async (newBudget: BudgetConfig) => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await saveBudgetConfig(newBudget);
      setBudget(newBudget);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your budget to Supabase.');
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  // Wellness Handler
  const handleUpdateWellness = async (date: string, partial: Partial<DailyWellness>) => {
    const previousWellness = wellnessRef.current;
    const existing = previousWellness[date] || {
      date,
      waterGlasses: 0,
      sleepHours: 7.5,
      energyScore: 3,
      journalNotes: '',
      gratitude: ''
    };
    const updatedEntry = { ...existing, ...partial, date };
    const updatedWellness = {
      ...previousWellness,
      [date]: updatedEntry
    };
    wellnessRef.current = updatedWellness;
    setWellness(updatedWellness);
    setPendingSaves(count => count + 1);
    setSaveError('');

    const previousSave = wellnessSaveQueue.current[date] ?? Promise.resolve();
    const save = previousSave
      .catch(() => undefined)
      .then(() => dataService.saveWellnessEntry(updatedEntry));
    wellnessSaveQueue.current[date] = save;

    try {
      await save;
      savedWellnessRef.current = {
        ...savedWellnessRef.current,
        [date]: updatedEntry
      };
    } catch (error) {
      if (wellnessRef.current[date] === updatedEntry) {
        const restoredWellness = { ...wellnessRef.current };
        const savedEntry = savedWellnessRef.current[date];
        if (savedEntry) {
          restoredWellness[date] = savedEntry;
        } else {
          delete restoredWellness[date];
        }
        wellnessRef.current = restoredWellness;
        setWellness(restoredWellness);
      }
      setSaveError(error instanceof Error ? error.message : 'Could not save your wellness data to Supabase.');
    } finally {
      if (wellnessSaveQueue.current[date] === save) {
        delete wellnessSaveQueue.current[date];
      }
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleSaveCustomExpenseCategory = async (category: CategoryInfo) => {
    await updateUserSettings({
      expenseCategories: {
        ...userSettings.expenseCategories,
        [category.name]: { ...category, isCustom: true }
      }
    });
  };

  const handleRemoveCustomExpenseCategory = async (categoryName: string) => {
    const categories = { ...userSettings.expenseCategories };
    delete categories[categoryName];
    const updatedExpenses = expenses.map(expense =>
      expense.category === categoryName ? { ...expense, category: 'Other' } : expense
    );
    const nextSettings = { ...userSettings, expenseCategories: categories };
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await Promise.all([
        dataService.saveUserSettings(nextSettings),
        dataService.reassignExpenseCategory(categoryName, 'Other')
      ]);
      setUserSettings(nextSettings);
      setExpenses(updatedExpenses);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not remove this category.');
      throw error;
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleToggleDarkMode = () => {
    const theme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(theme === 'dark');
    void updateUserSettings({ theme }).catch(() => {
      setIsDarkMode(theme !== 'dark');
    });
  };

  // Export & Backup
  const handleExportCSV = () => {
    const csvContent = exportExpensesAsCSV(expenses);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daymark_expenses_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = async () => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      const jsonStr = await exportAllDataAsJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `daymark_backup_${formatDate(new Date())}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not export your Supabase data.');
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleImportJSON = async (data: any) => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      const importedExpenses = Array.isArray(data.expenses) ? data.expenses as Expense[] : expenses;
      const nextBudget = data.budget ?? budget;
      const nextHabits = Array.isArray(data.habits) ? data.habits : habits;
      const nextTasks = Array.isArray(data.tasks) ? data.tasks : tasks;
      const nextWellness = data.wellness ?? wellness;
      const nextSettings = data.settings ? { ...userSettings, ...data.settings } : userSettings;

      const savedExpenses = Array.isArray(data.expenses)
        ? await saveExpenses(importedExpenses)
        : expenses;

      await Promise.all([
        ...(data.budget ? [saveBudgetConfig(nextBudget)] : []),
        ...(Array.isArray(data.habits) ? [saveHabits(nextHabits)] : []),
        ...(Array.isArray(data.tasks) ? [saveTasks(nextTasks)] : []),
        ...(data.wellness ? [saveWellness(nextWellness)] : []),
        ...(Array.isArray(data.notes) ? [notesService.saveNotes(data.notes)] : []),
        ...(data.settings ? [dataService.saveUserSettings(nextSettings)] : [])
      ]);

      setExpenses(savedExpenses);
      setBudget(nextBudget);
      setHabits(nextHabits);
      setTasks(nextTasks);
      wellnessRef.current = nextWellness;
      savedWellnessRef.current = nextWellness;
      setWellness(nextWellness);
      setUserSettings(nextSettings);
      alert('Backup data restored to Supabase successfully!');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not restore this backup to Supabase.');
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleResetData = async () => {
    setPendingSaves(count => count + 1);
    setSaveError('');
    try {
      await resetAllData();
      const seed = getInitialSeedData();
      setExpenses(seed.expenses);
      setBudget(seed.budget);
      setHabits(seed.habits);
      setTasks(seed.tasks);
      wellnessRef.current = seed.wellness;
      savedWellnessRef.current = seed.wellness;
      setWellness(seed.wellness);
      setUserSettings({ taskCategories: [], habitCategories: [], expenseCategories: {} });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not reset your Supabase data.');
    } finally {
      setPendingSaves(count => Math.max(0, count - 1));
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await authService.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  const openQuickLog = (tab: 'expense' | 'task' | 'habit' = 'expense') => {
    if (tab === 'expense') {
      setCurrentView('expenses');
      setPendingExpenseDialog(true);
      return;
    }

    if (tab === 'task') {
      setTaskToEditId(null);
      setCurrentView('tasks');
      setPendingTaskDialog(true);
      return;
    }

    setCurrentView('habits');
    setPendingHabitDialog(true);
  };

  if (!authService.isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm dark:border-amber-900 dark:bg-slate-900">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Connect Daymark to Supabase</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Add your Supabase project URL and public anon key to a <code>.env</code> file, then restart the app.
            Run the SQL in <code>supabase/schema.sql</code> in your Supabase SQL Editor.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 text-slate-500 font-mono text-xs">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        {authLoading ? 'Loading Daymark workspace...' : 'Syncing data from Supabase...'}
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div role="alert" className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
          <p className="text-sm text-rose-700 dark:text-rose-300">{authError}</p>
          <button
            type="button"
            onClick={() => {
              setAuthLoading(true);
              setAuthAttempt(attempt => attempt + 1);
            }}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={newUser => setUser(newUser)} />;
  }

  if (dataLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div role="alert" className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
          <h1 className="font-semibold text-slate-900 dark:text-slate-100">Could not sync your data</h1>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{dataLoadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt(attempt => attempt + 1)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
          >
            Retry sync
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      currentView={currentView}
      onSelectView={setCurrentView}
      user={user}
      onSignOut={handleSignOut}
      isDarkMode={isDarkMode}
      onToggleDarkMode={handleToggleDarkMode}
      onOpenQuickLog={tab => openQuickLog(tab || 'expense')}
    >
      {saveError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError('')} className="font-semibold underline">Dismiss</button>
        </div>
      )}
      {/* 1. Daily Overview Dashboard */}
      {currentView === 'daily' && (
        <DailyOverview
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          habits={habits}
          tasks={tasks}
          wellness={wellness}
          expenses={expenses}
          budget={budget}
          onToggleHabit={handleToggleHabit}
          savingHabitDates={savingHabitDates}
          onToggleTask={handleToggleTask}
          savingTaskIds={savingTaskIds}
          savingTaskActions={savingTaskActions}
          onAddTask={handleAddTask}
          onEditTask={handleRequestTaskEdit}
          onDeleteTask={handleDeleteTask}
          onUpdateWellness={handleUpdateWellness}
          onQuickLogExpense={() => openQuickLog('expense')}
          onOpenAddHabit={() => openQuickLog('habit')}
        />
      )}

      {/* 2. Habit Tracker (Module 1 - same as previous first code) */}
      {currentView === 'habits' && (
        <HabitsView
          habits={habits}
          customCategories={userSettings.habitCategories}
          onChangeCustomCategories={categories => updateUserSettings({ habitCategories: categories })}
          onAddHabit={handleAddHabit}
          onUpdateHabit={handleUpdateHabit}
          onDeleteHabit={handleDeleteHabit}
          savingHabitDeletes={savingHabitDeletes}
          onToggleHabit={handleToggleHabit}
          savingHabitIds={savingHabitIds}
          savingHabitDates={savingHabitDates}
          isSaving={pendingSaves > 0}
          wellness={wellness}
          onUpdateWellness={handleUpdateWellness}
          selectedDate={selectedDate}
          openAddHabitRequest={pendingHabitDialog}
          onAddHabitRequestHandled={() => setPendingHabitDialog(false)}
        />
      )}

      {/* 3. Daily Tasks & Priorities (Module 2 - same as previous first code) */}
      {currentView === 'tasks' && (
        <TasksView
          tasks={tasks}
          customCategories={userSettings.taskCategories}
          onChangeCustomCategories={categories => updateUserSettings({ taskCategories: categories })}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          taskToEditId={taskToEditId}
          onTaskEditHandled={() => setTaskToEditId(null)}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          savingTaskIds={savingTaskIds}
          savingTaskActions={savingTaskActions}
          isSaving={pendingSaves > 0}
          openAddTaskRequest={pendingTaskDialog}
          onAddTaskRequestHandled={() => setPendingTaskDialog(false)}
        />
      )}

      {/* 3b. Notes & Journal Module with Image & Supabase Support */}
      {currentView === 'notes' && (
        <NotesView
          currencySymbol={budget.currency}
        />
      )}

      {/* 4. Dedicated Expense Dashboard (New Model) */}
      {currentView === 'expenses' && (
        <ExpenseDashboard
          expenses={expenses}
          budget={budget}
          customExpenseCategories={userSettings.expenseCategories}
          onSaveCustomExpenseCategory={handleSaveCustomExpenseCategory}
          onRemoveCustomExpenseCategory={handleRemoveCustomExpenseCategory}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          onUpdateBudget={handleUpdateBudget}
          onExportCSV={handleExportCSV}
          openExpenseDialogRequest={pendingExpenseDialog}
          onExpenseDialogRequestHandled={() => setPendingExpenseDialog(false)}
        />
      )}

      {/* 5. Performance Analytics & Recharts Trends */}
      {currentView === 'reports' && (
        <ReportsPage
          habits={habits}
          tasks={tasks}
          expenses={expenses}
          wellness={wellness}
          budget={budget}
        />
      )}

      {/* 6. History & Data Management */}
      {currentView === 'history' && (
        <HistoryReportsView
          expenses={expenses}
          habits={habits}
          tasks={tasks}
          wellness={wellness}
          budget={budget}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onResetData={handleResetData}
        />
      )}

    </Layout>
  );
}
