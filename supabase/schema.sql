-- ==============================================================================
-- Daymark — Daily Todo & Habit Tracker Database Schema
-- Supabase PostgreSQL Schema with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 2. Recurring Tasks Definition Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  weekdays INTEGER[] DEFAULT '{0,1,2,3,4,5,6}' NOT NULL, -- 0=Sun, 1=Mon, ..., 6=Sat
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  time_estimate_min INTEGER DEFAULT 30,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own tasks" ON public.tasks;
CREATE POLICY "Users can select own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- ------------------------------------------------------------------------------
-- 3. Daily Task Entries Table (Independent per Date)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_task_date UNIQUE (user_id, task_id, entry_date)
);

ALTER TABLE public.task_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own task entries" ON public.task_entries;
CREATE POLICY "Users can select own task entries"
  ON public.task_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own task entries" ON public.task_entries;
CREATE POLICY "Users can insert own task entries"
  ON public.task_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own task entries" ON public.task_entries;
CREATE POLICY "Users can update own task entries"
  ON public.task_entries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own task entries" ON public.task_entries;
CREATE POLICY "Users can delete own task entries"
  ON public.task_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_entries_user_date ON public.task_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_task_entries_task_id ON public.task_entries(task_id);

-- ------------------------------------------------------------------------------
-- 4. Custom Trackers & Habits Definition
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('numeric', 'boolean')),
  unit TEXT, -- e.g. 'ml', 'hours', 'pages', 'mins'
  target_value NUMERIC DEFAULT 1,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.custom_trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own custom trackers" ON public.custom_trackers;
CREATE POLICY "Users can select own custom trackers"
  ON public.custom_trackers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own custom trackers" ON public.custom_trackers;
CREATE POLICY "Users can insert own custom trackers"
  ON public.custom_trackers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own custom trackers" ON public.custom_trackers;
CREATE POLICY "Users can update own custom trackers"
  ON public.custom_trackers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own custom trackers" ON public.custom_trackers;
CREATE POLICY "Users can delete own custom trackers"
  ON public.custom_trackers FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_trackers_user_id ON public.custom_trackers(user_id);

-- ------------------------------------------------------------------------------
-- 5. Tracker Entries (Per Date)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracker_id UUID REFERENCES public.custom_trackers(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_tracker_date UNIQUE (user_id, tracker_id, entry_date)
);

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can select own tracker entries"
  ON public.tracker_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can insert own tracker entries"
  ON public.tracker_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can update own tracker entries"
  ON public.tracker_entries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can delete own tracker entries"
  ON public.tracker_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tracker_entries_user_date ON public.tracker_entries(user_id, entry_date);

-- ------------------------------------------------------------------------------
-- 6. Daily Notes & Reflections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  mood TEXT,
  gratitude TEXT,
  sleep_hours NUMERIC,
  water_ml NUMERIC,
  energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_note_date UNIQUE (user_id, entry_date)
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own notes" ON public.daily_notes;
CREATE POLICY "Users can select own notes"
  ON public.daily_notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON public.daily_notes;
CREATE POLICY "Users can insert own notes"
  ON public.daily_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.daily_notes;
CREATE POLICY "Users can update own notes"
  ON public.daily_notes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.daily_notes;
CREATE POLICY "Users can delete own notes"
  ON public.daily_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date ON public.daily_notes(user_id, entry_date);

-- ------------------------------------------------------------------------------
-- 7. Expenses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  account TEXT NOT NULL DEFAULT 'expense' CHECK (account IN ('expense', 'savings', 'cash')),
  is_transfer BOOLEAN DEFAULT FALSE NOT NULL,
  spend_type TEXT NOT NULL DEFAULT 'need' CHECK (spend_type IN ('need', 'want', 'savings')),
  payment_method TEXT DEFAULT 'Credit Card',
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.expenses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS spend_type TEXT NOT NULL DEFAULT 'need';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Credit Card';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own expenses" ON public.expenses;
CREATE POLICY "Users can select own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(user_id, category);

-- ------------------------------------------------------------------------------
-- 8. Budget Configurations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  monthly_budget NUMERIC(12,2) DEFAULT 30000.00 NOT NULL,
  currency TEXT DEFAULT '₹' NOT NULL,
  category_budgets JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.budget_configs ALTER COLUMN monthly_budget SET DEFAULT 30000.00;
ALTER TABLE public.budget_configs ALTER COLUMN currency SET DEFAULT '₹';

ALTER TABLE public.budget_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own budget" ON public.budget_configs;
CREATE POLICY "Users can select own budget"
  ON public.budget_configs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own budget" ON public.budget_configs;
CREATE POLICY "Users can upsert own budget"
  ON public.budget_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Trigger for automatic user profile creation on signup
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.budget_configs (user_id, monthly_budget, currency, category_budgets)
  VALUES (
    NEW.id,
    30000.00,
    '₹',
    '{"Housing": 10000, "Groceries": 5000, "Food & Dining": 3000, "Transportation": 2000, "Utilities": 2500, "Health & Fitness": 1500, "Entertainment": 1500, "Shopping": 2000, "Subscriptions": 800, "Personal Care": 800, "Education": 1000, "Other": 800}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- App-specific state stores daily task/habit histories and user-defined categories.
CREATE TABLE IF NOT EXISTS public.app_data (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('habits', 'tasks', 'wellness', 'settings')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, collection)
);

-- Normalized tables used by the current application modules.
CREATE TABLE IF NOT EXISTS public.habits (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Personal',
  target_days_per_week INTEGER NOT NULL DEFAULT 7 CHECK (target_days_per_week BETWEEN 1 AND 7),
  weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#10B981',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, id)
);

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';

UPDATE public.habits AS habit
SET weekdays = (
  SELECT ARRAY_AGG(day_of_week ORDER BY ordinal) AS weekdays
  FROM UNNEST(ARRAY[1, 2, 3, 4, 5, 6, 0]) WITH ORDINALITY AS days(day_of_week, ordinal)
  WHERE ordinal <= habit.target_days_per_week
)
WHERE CARDINALITY(habit.weekdays) <> habit.target_days_per_week;

CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  habit_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT habit_completions_habit_owner_fk
    FOREIGN KEY (user_id, habit_id) REFERENCES public.habits(user_id, id) ON DELETE CASCADE,
  CONSTRAINT unique_user_habit_date UNIQUE (user_id, habit_id, entry_date)
);

CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  time_estimate_min INTEGER,
  category TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.daily_wellness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  mood TEXT,
  water_glasses NUMERIC NOT NULL DEFAULT 0,
  sleep_hours NUMERIC NOT NULL DEFAULT 7.5,
  energy_score INTEGER NOT NULL DEFAULT 3 CHECK (energy_score BETWEEN 1 AND 5),
  journal_notes TEXT NOT NULL DEFAULT '',
  gratitude TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_wellness_date UNIQUE (user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  task_categories TEXT[] NOT NULL DEFAULT '{}',
  habit_categories TEXT[] NOT NULL DEFAULT '{}',
  expense_categories JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme TEXT CHECK (theme IN ('dark', 'light')),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON public.daily_tasks(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_wellness_user_date ON public.daily_wellness(user_id, entry_date DESC);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_wellness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
CREATE POLICY "Users can manage own habits" ON public.habits FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own habit completions" ON public.habit_completions;
CREATE POLICY "Users can manage own habit completions" ON public.habit_completions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own daily tasks" ON public.daily_tasks;
CREATE POLICY "Users can manage own daily tasks" ON public.daily_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own daily wellness" ON public.daily_wellness;
CREATE POLICY "Users can manage own daily wellness" ON public.daily_wellness FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- One-time, idempotent migration from the former JSON app_data collections.
INSERT INTO public.habits (
  id, user_id, title, category, target_days_per_week, weekdays, streak, best_streak, color
)
SELECT
  item->>'id',
  source.user_id,
  COALESCE(NULLIF(item->>'title', ''), 'Untitled habit'),
  COALESCE(NULLIF(item->>'category', ''), 'Personal'),
  LEAST(7, GREATEST(1, COALESCE(NULLIF(item->>'targetDaysPerWeek', '')::INTEGER, 7))),
  CASE
    WHEN jsonb_typeof(item->'weekdays') = 'array' THEN ARRAY(
      SELECT day_value::INTEGER
      
      FROM jsonb_array_elements_text(item->'weekdays') AS day_value
      WHERE day_value ~ '^[0-6]$'
    )
    ELSE ARRAY(
      SELECT day_of_week
      FROM UNNEST(ARRAY[1, 2, 3, 4, 5, 6, 0]) WITH ORDINALITY AS days(day_of_week, ordinal)
      WHERE ordinal <= LEAST(7, GREATEST(1, COALESCE(NULLIF(item->>'targetDaysPerWeek', '')::INTEGER, 7)))
    )
  END,
  GREATEST(0, COALESCE(NULLIF(item->>'streak', '')::INTEGER, 0)),
  GREATEST(0, COALESCE(NULLIF(item->>'bestStreak', '')::INTEGER, 0)),
  COALESCE(NULLIF(item->>'color', ''), '#10B981')
FROM public.app_data AS source
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(source.data) = 'array' THEN source.data ELSE '[]'::jsonb END
) AS item
WHERE source.collection = 'habits' AND NULLIF(item->>'id', '') IS NOT NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.habit_completions (user_id, habit_id, entry_date)
SELECT
  source.user_id,
  item->>'id',
  completion.entry_date::DATE
FROM public.app_data AS source
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(source.data) = 'array' THEN source.data ELSE '[]'::jsonb END
) AS item
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(item->'completedDates') = 'array'
    THEN item->'completedDates' ELSE '[]'::jsonb END
) AS completion(entry_date)
JOIN public.habits AS habit
  ON habit.user_id = source.user_id AND habit.id = item->>'id'
WHERE source.collection = 'habits'
  AND completion.entry_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ON CONFLICT (user_id, habit_id, entry_date) DO NOTHING;

INSERT INTO public.daily_tasks (
  id, user_id, entry_date, title, completed, priority, time_estimate_min, category, completed_at
)
SELECT
  item->>'id',
  source.user_id,
  (item->>'date')::DATE,
  COALESCE(NULLIF(item->>'title', ''), 'Untitled task'),
  COALESCE((item->>'completed')::BOOLEAN, FALSE),
  CASE WHEN item->>'priority' IN ('low', 'medium', 'high') THEN item->>'priority' ELSE 'medium' END,
  NULLIF(item->>'timeEstimateMin', '')::INTEGER,
  NULLIF(item->>'category', ''),
  CASE
    WHEN item->>'completedAt' ~ '^[0-9]+([.][0-9]+)?$'
      THEN to_timestamp((item->>'completedAt')::DOUBLE PRECISION / 1000.0)
    ELSE NULL
  END
FROM public.app_data AS source
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(source.data) = 'array' THEN source.data ELSE '[]'::jsonb END
) AS item
WHERE source.collection = 'tasks'
  AND NULLIF(item->>'id', '') IS NOT NULL
  AND item->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.daily_wellness (
  user_id, entry_date, mood, water_glasses, sleep_hours, energy_score, journal_notes, gratitude
)
SELECT
  source.user_id,
  wellness.entry_date::DATE,
  NULLIF(wellness.data->>'mood', ''),
  COALESCE(NULLIF(wellness.data->>'waterGlasses', '')::NUMERIC, 0),
  COALESCE(NULLIF(wellness.data->>'sleepHours', '')::NUMERIC, 7.5),
  LEAST(5, GREATEST(1, COALESCE(NULLIF(wellness.data->>'energyScore', '')::INTEGER, 3))),
  COALESCE(wellness.data->>'journalNotes', ''),
  COALESCE(wellness.data->>'gratitude', '')
FROM public.app_data AS source
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(source.data) = 'object' THEN source.data ELSE '{}'::jsonb END
) AS wellness(entry_date, data)
WHERE source.collection = 'wellness'
  AND wellness.entry_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ON CONFLICT (user_id, entry_date) DO NOTHING;

INSERT INTO public.user_settings (
  user_id, task_categories, habit_categories, expense_categories, theme
)
SELECT
  source.user_id,
  COALESCE(ARRAY(SELECT jsonb_array_elements_text(source.data->'taskCategories')), '{}'),
  COALESCE(ARRAY(SELECT jsonb_array_elements_text(source.data->'habitCategories')), '{}'),
  CASE WHEN jsonb_typeof(source.data->'expenseCategories') = 'object'
    THEN source.data->'expenseCategories' ELSE '{}'::jsonb END,
  CASE WHEN source.data->>'theme' IN ('dark', 'light') THEN source.data->>'theme' ELSE NULL END
FROM public.app_data AS source
WHERE source.collection = 'settings'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own app data" ON public.app_data;
CREATE POLICY "Users can manage own app data"
  ON public.app_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes"
  ON public.notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON public.notes(user_id, created_at DESC);

-- Explicit API grants are required in addition to RLS policies. The client
-- uses only the authenticated role; anonymous access to user tables is denied.
REVOKE ALL ON TABLE
  public.profiles,
  public.tasks,
  public.task_entries,
  public.custom_trackers,
  public.tracker_entries,
  public.daily_notes,
  public.expenses,
  public.budget_configs,
  public.app_data,
  public.habits,
  public.habit_completions,
  public.daily_tasks,
  public.daily_wellness,
  public.user_settings,
  public.notes
FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.tasks,
  public.task_entries,
  public.custom_trackers,
  public.tracker_entries,
  public.daily_notes,
  public.expenses,
  public.budget_configs,
  public.app_data,
  public.habits,
  public.habit_completions,
  public.daily_tasks,
  public.daily_wellness,
  public.user_settings,
  public.notes
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
