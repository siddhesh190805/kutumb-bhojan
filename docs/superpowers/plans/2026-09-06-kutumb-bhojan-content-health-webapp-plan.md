# Kutumb Bhojan Content, Health & Web-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Kutumb Bhojan into a DB-driven family nutrition PWA with a hybrid health experience, configurable household targets, and Light/Dark/System theme support.

**Architecture:** Keep the existing Supabase household data model and anonymous-auth flow. Add read-only global health content tables plus household settings, fetch them through the existing Supabase client, render them through generic UI functions, and use LocalStorage only for offline/device preferences. Add a static service worker that caches the application shell but never caches authenticated Supabase responses.

**Tech Stack:** Static HTML/CSS/ES modules, Supabase JS v2, Supabase Postgres/RLS, browser Service Worker API, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-kutumb-bhojan-content-health-webapp-design.md`

## Global Constraints
- No email/password/OTP UI.
- Supabase anonymous sessions remain the access mechanism.
- Supabase is canonical for shared household data and health/content data.
- LocalStorage is a cache/offline fallback and device-preference store, not canonical shared content.
- Health guidance is general public-health information, not a medical prescription.
- New public tables must have RLS enabled and explicit grants.
- Service-role/secret credentials must never be placed in browser code.
- Existing meal/recipe/shopping/prep sync and realtime behavior must remain intact.

---

### Task 1: Add health/content and household-settings schema

**Files:**
- Create: `supabase/migrations/20260906003000_content_health_webapp.sql`
- Modify: `supabase.schema.sql`
- Test: `tests/app.test.js`

- [x] Create `health_tips`, `health_targets`, and `household_settings` with timestamps, bilingual content fields, indexes and RLS.
- [x] Grant SELECT on global health tables to `authenticated` only; grant household settings CRUD to `authenticated` subject to `is_household_member`.
- [x] Seed practical bilingual health tips and targets with WHO/FAO source attribution, including oil as a configurable household planning target rather than a clinical limit.
- [x] Add the same schema and seed definitions to `supabase.schema.sql` so a fresh project can reproduce the production schema.
- [x] Verify migration syntax locally with structural tests and apply the migration to the production Supabase project.

### Task 2: Make health/settings data part of the client state

**Files:**
- Modify: `sync.js`
- Modify: `app.js`
- Test: `tests/sync.test.js`, `tests/app.test.js`

- [x] Add mapping helpers for health tips, health targets and household settings.
- [x] Fetch global health content and household settings during cloud initialization.
- [x] Persist health content as a cache in the existing local state envelope, but always prefer fresh Supabase content when online.
- [x] Upsert household settings on edit and subscribe to household-settings realtime changes.
- [x] Preserve existing operational-table sync behavior.

### Task 3: Build the hybrid health dashboard and full Health Guide

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/app.test.js`

- [x] Add `health` navigation.
- [x] Add a dashboard health card that selects the highest-priority active tip.
- [x] Add household target snapshot cards, including oil stock/target.
- [x] Add category filtering and detail rendering for the Health Guide.
- [x] Ensure all health copy is rendered from fetched records rather than hard-coded content.

### Task 4: Add configurable household oil guidance

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/app.test.js`

- [x] Add Settings controls for current oil stock and monthly planning target.
- [x] Calculate daily household planning pace and show remaining monthly target.
- [x] Explain where to reduce oil: deep frying, repeated oil-heavy tadka, large oil portions in gravies; prefer measured spooning, roasting, steaming, pressure cooking and shallow cooking where suitable.
- [x] Keep the target editable and explicitly label it as a household planning target, not a medical limit.

### Task 5: Add Light/Dark/System theme and PWA shell

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `public/manifest.webmanifest`
- Create: `public/service-worker.js`
- Test: `tests/app.test.js`

- [x] Add theme tokens for light and dark modes.
- [x] Add a Settings theme selector with system preference support.
- [x] Persist theme locally and apply before first render to reduce flash.
- [x] Register the service worker and cache only the static app shell.
- [x] Update manifest theme/background colors and add standalone metadata.

### Task 6: Documentation, verification and release artifact

**Files:**
- Modify: `README.md`
- Modify: `tests/*.test.js`
- Create: `docs/superpowers/specs/2026-09-06-kutumb-bhojan-content-health-webapp-design.md`
- Create: `docs/superpowers/plans/2026-09-06-kutumb-bhojan-content-health-webapp-plan.md`

- [x] Update README to describe Supabase-backed content, anonymous sessions, Health Guide and PWA behavior.
- [x] Run `node --check app.js`.
- [x] Run `node --test tests/*.test.js` and require all tests to pass.
- [x] Verify the ZIP archive integrity.
- [x] Produce the updated source ZIP with a SHA-256 checksum.
- [ ] If GitHub write access is available, push the changes and verify the resulting Vercel deployment; otherwise report the exact remaining external deployment step without claiming completion.
