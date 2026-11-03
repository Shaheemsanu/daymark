# Supabase Database Configuration for Daymark

This directory contains the database schema and initialization instructions for **Daymark — Daily Todo & Habit Tracker**.

---

## 1. Quick Setup in Supabase Dashboard

1. **Create a Supabase Project**:
   - Go to [database.new](https://database.new) or log in to [Supabase](https://supabase.com).
   - Create a new project named `daymark` (or your preferred name).
   - Set a strong database password and pick your closest region.

2. **Execute Database Schema**:
   - In your Supabase project dashboard, open the **SQL Editor** from the left navigation.
   - Click **+ New Query**.
   - Copy the entire content of [`supabase/schema.sql`](./schema.sql) and paste it into the editor.
   - Click **Run** to execute the script.
   - This creates the tables, constraints, triggers, RLS policies, and explicit API grants. Re-run the full script after schema changes; `CREATE TABLE IF NOT EXISTS` does not update existing columns.

3. **Get API Keys**:
   - Navigate to **Project Settings** → **API**.
   - Copy the **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - Copy the **anon / public** key (`sb_publishable_...` or JWT anon key).
   - Use only the project URL and public key; never use a PostgreSQL connection string or expose a `service_role` / secret key in frontend code.

4. **Configure Authentication Redirects**:
   - In Supabase dashboard, go to **Authentication** → **URL Configuration**.
   - Ensure the **Email** provider is enabled under **Authentication** → **Providers**.
   - Under **Site URL**, add your local dev URL: `http://localhost:3000/`.
   - Under **Redirect URLs**, add:
     - `http://localhost:3000/**`
     - Your production URL (e.g. `https://<username>.github.io/daymark/**`)

5. **Set Environment Variables**:
   - In your local project root, create a `.env` file (or copy `.env.example`):
     ```bash
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-public-key
     VITE_BASE_PATH=/
     ```

---

## 2. Architecture & Security Model

- **Row Level Security (RLS)**: User-owned records across module tables are protected by policies checking `auth.uid() = user_id`.
- **API privileges**: The schema grants table access to authenticated users only and revokes anonymous access; RLS policies continue to restrict each user to their own rows.
- **Supabase-only app storage**: Expenses, budgets, habits, daily habit completions, daily tasks, wellness history, user settings, and notes each use dedicated tables. The legacy `app_data` table remains available for compatibility; re-running `schema.sql` migrates its existing habit, task, wellness, and settings records into the normalized tables.
- **Immediate persistence**: Each app change is written to Supabase as it happens. Bulk habit/task/wellness saves use batched upserts, and user data is scoped by the authenticated user ID.
- **Daily Independence Constraint**:
  - The `task_entries` table enforces `UNIQUE (user_id, task_id, entry_date)`: each recurring task has a completely independent status (`pending`, `complete`, `skipped`) for each calendar date.
  - The `tracker_entries` table enforces `UNIQUE (user_id, tracker_id, entry_date)`: tracking values (water, habits, metrics) are isolated per day.
- **Auto Profile & Budget Trigger**: An automated database trigger (`on_auth_user_created`) provisions a user profile and default budget configuration upon signup.
- **No local-data fallback**: Supabase credentials are required. Connection and persistence errors are shown in the app rather than being treated as successful local saves.
