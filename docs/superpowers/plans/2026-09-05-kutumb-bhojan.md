# Kutumb Bhojan Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a bilingual, mobile-first family nutrition web app that preserves the existing Notion meal-planning system while making daily use substantially simpler.

**Architecture:** Static HTML/CSS/JavaScript app. Starter data is bundled in `app.js`; a versioned localStorage store handles edits and JSON import/export; one client-side renderer covers Today, Calendar, Recipes, Shopping, Prep, Family and Settings without a server-side database.

**Tech Stack:** Vanilla HTML, CSS and JavaScript, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-kutumb-bhojan-design.md`

## Global Constraints
- Mobile-first and usable by a non-technical family member.
- Every English navigation/data label has Marathi alongside it.
- Actual HTML checkboxes must be used for Shopping and Prep.
- Preserve the 120 calendar entries, 23 approved family recipes, 38 shopping items, 8 prep tasks and 4 family members.
- Keep Pithla excluded.
- Use localStorage only; no paid backend dependency.
- Export/import must be available so the family's data is not trapped in one browser.
- Vercel Hobby is personal/non-commercial and is not promised as permanently free by contract.

---

### Task 1: Static scaffold and data model
**Files:** `index.html`, `app.js`, `styles.css`, `package.json`, `tests/app.test.js`

- [x] Create a no-build static application so the family does not depend on a package install or paid backend.
- [x] Define starter data for family members, 30 days × 4 meal slots, 23 recipes, 38 shopping items and 8 prep tasks.
- [x] Implement versioned localStorage persistence, starter reset and JSON export/import.
- [x] Test the 30-day calendar span and static-server availability.

### Task 2: Application shell and Today dashboard
**Files:** `app.js`, `styles.css`

- [x] Create responsive shell with desktop sidebar and mobile bottom navigation.
- [x] Show today’s four meals, today’s prep tasks, shopping count and Vikas food-reaction caution.
- [x] Make meal cards open a matching recipe detail when available.

### Task 3: Calendar and recipe experience
**Files:** `app.js`, `styles.css`

- [x] Implement month selection and date selection.
- [x] Render four meal slots per day for the seeded 30-day period.
- [x] Add recipe search and detailed recipe cards with ingredients, method, time, oil and nutrition estimates.

### Task 4: Shopping, Prep, Family and Settings
**Files:** `app.js`, `styles.css`

- [x] Use native checkbox inputs for `Need to Buy`, `Purchased`, and `Done` actions.
- [x] Render shopping quantities and categories.
- [x] Render prep tasks and family reference cards.
- [x] Add JSON backup/import and reset-to-starter controls.

### Task 5: Accessibility, verification and deployment
**Files:** `public/manifest.webmanifest`, `public/icon.svg`, `vercel.json`, `README.md`

- [x] Add PWA metadata and branded icon.
- [x] Add focus states, labels, touch-sized controls, responsive layouts and reduced visual complexity.
- [x] Run `npm test` and `node --check app.js`.
- [x] Run a local static-server smoke test with HTTP 200 and expected app content.
- [ ] Deploy production to Vercel and verify the production URL.
- [ ] Produce a downloadable source archive from the final project directory.
