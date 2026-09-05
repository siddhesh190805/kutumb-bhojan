# Kutumb Bhojan Cloud Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Kutumb Bhojan app reliably cloud-backed, private to an authenticated household, realtime-aware, and safe to deploy on the single canonical Vercel project.

**Architecture:** Keep the existing static Vanilla JS frontend and Supabase client, but isolate deterministic cloud row mapping in `sync.js`. Supabase remains the authoritative shared store after authentication; localStorage remains a browser cache/backup. All five domain tables use the same stable local keys and household-scoped RLS.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Supabase JS v2 CDN, PostgreSQL/RLS, Node built-in test runner, Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-09-05-kutumb-bhojan-design.md`

## Global Constraints
- Keep one canonical Vercel project: `kutumb-bhojan`.
- Do not create a second hosting project or parallel app version.
- Every English navigation/data label shown to the family keeps Marathi alongside it.
- Supabase frontend access uses only the publishable key; never expose service-role/secret credentials.
- Household data is accessible only to authenticated household members through RLS.
- Preserve the existing starter content and Pithla exclusion.
- LocalStorage remains available as cache/backup; cloud sync is authoritative when authenticated.
- Every code change must be packaged into the current source ZIP.

---

### Task 1: Harden Supabase bootstrap permissions

**Files:**
- Modify: `supabase.schema.sql`
- Create: Supabase migration `lock_down_household_bootstrap`

**Interfaces:**
- Produces: authenticated-only `public.bootstrap_household(text) returns uuid` and `public.is_household_member(uuid) returns boolean` execution privileges.

- [x] **Step 1: Inspect existing function grants and definitions.**
- [x] **Step 2: Apply a migration that revokes public/anonymous execution, requires `auth.uid()`, and grants execution only to `authenticated`.**
- [x] **Step 3: Update the checked-in schema to match production.**
- [x] **Step 4: Verify function definitions and grants with SQL queries.**

### Task 2: Centralize cloud row mapping and synchronize every domain

**Files:**
- Create: `sync.js`
- Modify: `app.js`
- Modify: `tests/sync.test.js`

**Interfaces:**
- `buildRemoteRows(state, householdId)` returns `{meal_entries, recipes, family_members, shopping_items, prep_tasks}` arrays ready for Supabase upsert.
- `mapRemoteState(data)` converts the five Supabase query results into the local state shape without losing stable keys.

- [x] **Step 1: Add failing tests for all five table payloads and stable-key reconstruction.**
- [x] **Step 2: Run the focused tests and observe the expected missing-module failure.**
- [x] **Step 3: Implement the pure mapping functions.**
- [x] **Step 4: Run the focused tests and full suite.**
- [x] **Step 5: Replace duplicated mapping logic in `app.js` with `sync.js` imports.**
- [x] **Step 6: Change `syncLocalChanges()` to upsert meals, recipes, family, shopping, and prep.**
- [x] **Step 7: Make remote-load failures visible in the UI instead of silently returning to login.**

### Task 3: Add safe realtime refresh and session controls

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/sync.test.js`

**Interfaces:**
- `subscribeToHousehold()` subscribes to household-scoped changes on all five domain tables.
- Session logout clears remote state/subscription and returns to the auth screen.

- [x] **Step 1: Add deterministic tests for duplicate-safe realtime subscription table configuration.**
- [x] **Step 2: Implement one Supabase channel for the current household, filtered by `household_id`.**
- [x] **Step 3: Refresh local state from Supabase after remote changes while preventing self-triggered refresh loops.**
- [x] **Step 4: Add logout control to Settings and clean up the channel on sign-out.**
- [ ] **Step 5: Verify auth/session state transitions in the browser smoke test.**

### Task 4: Verify canonical Vercel deployment and package source

**Files:**
- Modify: `README.md` if deployment notes need correction
- Create: `/mnt/data/kutumb-bhojan-v2-current.zip`

- [x] **Step 1: Run `npm test` and `node --check app.js`.**
- [x] **Step 2: Run a local static-server smoke test and verify HTTP 200 plus app markers.**
- [x] **Step 3: Inspect the existing Vercel project/deployments and verify `kutumb-bhojan.vercel.app` resolves to the current project.**
- [ ] **Step 4: Deploy only the current project when the deployment tool has a verified payload source.**
- [ ] **Step 5: Fetch the production URL and verify the returned HTML references the current `/app.js` and `/styles.css`.**
- [x] **Step 6: Zip the complete source tree, excluding `.git`, and provide the sandbox download link.**
