-- Enable UUID extension (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    type TEXT DEFAULT 'expense',
    account TEXT DEFAULT 'expense',
    is_transfer BOOLEAN DEFAULT false,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    spend_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Budget Table
CREATE TABLE IF NOT EXISTS budget (
    id TEXT PRIMARY KEY DEFAULT 'main',
    monthly_budget NUMERIC DEFAULT 0,
    currency TEXT DEFAULT '₹',
    category_budgets JSONB DEFAULT '{}'
);

-- Habits Table
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    target_days_per_week INTEGER DEFAULT 7,
    completed_dates JSONB DEFAULT '[]',
    streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    color TEXT
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'medium',
    time_estimate_min INTEGER,
    category TEXT,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Wellness Table
CREATE TABLE IF NOT EXISTS wellness (
    date TEXT PRIMARY KEY,
    mood TEXT,
    water_glasses INTEGER DEFAULT 0,
    sleep_hours NUMERIC DEFAULT 0,
    energy_score INTEGER DEFAULT 0,
    journal_notes TEXT,
    gratitude TEXT
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Note: In a production app, you should enable Row Level Security (RLS) on all these tables 
-- and create policies to ensure users can only access their own data.

-- 7. User Settings Table (for custom categories/prefs)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES auth.users(id),
  custom_categories JSONB DEFAULT '{}'::jsonb,
  habit_categories JSONB DEFAULT '{}'::jsonb,
  task_categories JSONB DEFAULT '{}'::jsonb
);
