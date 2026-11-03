# Implementation Plan: Supabase Full Migration

Migrate the Daymark application from local storage persistence to a fully server-side Supabase architecture.

## User Review & Critical Decisions

> [!IMPORTANT]
> The migration will **permanently delete all existing local data**.

- **Confirmed Decision 1**: **Data Reset**: Start fresh with Supabase; all existing local storage data will be wiped.
- **Confirmed Decision 2**: **Strictly Online**: The application will require an active internet connection and will not support offline caching or synchronization.
- **Confirmed Decision 3**: **Enforced Authentication**: All features will be protected by Supabase Authentication; users must sign in to access any part of the application.

## 1. Overview & Core Concept

- **What It Does**: Transitions Daymark into a cloud-native application. All user data (expenses, tasks, habits, wellness, notes) will reside in Supabase PostgreSQL tables instead of the browser's `localStorage`.
- **Target Audience**: Users requiring secure, multi-device, and cloud-synchronized personal finance and habit tracking.
- **Key Value**: Reliability, security, and true multi-device data persistence.

## 2. User Experience & Visual Design

- **Flow Change**: All existing entry points (daily, expenses, etc.) will be wrapped in an authentication guard. Unauthorized users will be redirected to the AuthPage.
- **Auth UI**: Minimal changes, but enforced globally.
- **Empty States**: Since the app starts fresh, the "empty state" will guide users to add their first items after they sign in.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full Backend Migration**
    - *Chosen Approach*: Replace `localStorage` interaction in all storage utilities (`storage.ts`) with Supabase SDK (`supabase-js`) database queries.
    - *Why*: Ensures data integrity and multi-device access.
    - *Alternatives*: Keep `localStorage` as a hybrid cache; rejected to maintain strict online-only design as per user request.
- **Decision 2: Global Auth Guard**
    - *Chosen Approach*: Wrap the entire `App` component's render logic with an auth check.
    - *Why*: Simplest and most secure way to enforce authentication for all features.

## 4. Technical Architecture & Data Strategy

```text
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ (Supabase Client SDK)
         ▼
┌─────────────────┐
│    Supabase     │
│  (Auth & DB)    │
└─────────────────┘
```

- **Data Strategy**:
    - Every service (e.g., `expenses`, `tasks`, `notes`) will be updated to point to Supabase API calls.
    - Database schema migration required:
        - `profiles` table (linked to Auth)
        - `expenses` table
        - `habits` table
        - `tasks` table
        - `wellness` table
        - `notes` table
- **Auth Strategy**:
    - Use Supabase Auth with Row Level Security (RLS) policies to ensure users can only access their own data.
    - `authService.ts` will become the primary gatekeeper for the app.
