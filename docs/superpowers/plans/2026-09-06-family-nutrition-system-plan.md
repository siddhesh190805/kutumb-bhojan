# Kutumb Bhojan Family Nutrition System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Kutumb Bhojan's existing calendar into a Supabase-backed family nutrition system with structured recipes, exact ingredients, seasonal planning, family-aware portions, and derived shopping/prep data.

**Architecture:** Keep the current static ES-module frontend and Supabase anonymous-household architecture. Add a structured nutrition/content layer in Postgres (`ingredients`, `recipes`, `recipe_ingredients`, `nutrition_targets`, `seasonal_ingredients`, `meal_plan`) and make the existing calendar, shopping and prep views consume those records through generic helpers instead of growing hard-coded arrays in `app.js`.

**Tech Stack:** Static HTML/CSS/ES modules, Supabase JS v2, PostgreSQL/RLS, Node built-in test runner, existing PWA/service-worker shell.

**Spec:** `docs/superpowers/specs/2026-09-06-kutumb-bhojan-content-health-webapp-design.md`

## Global Constraints

- Supabase remains canonical for shared household content/configuration.
- JavaScript remains generic reusable behavior/UI; recipe and calendar content must not become a new hard-coded frontend database.
- Existing meals, recipes, shopping, prep, anonymous auth, health/settings and realtime behavior must remain functional.
- Four daily slots are canonical: Breakfast, Lunch, Snack, Dinner.
- Exact named foods are required; no generic `fruit` or `vegetable` planner entries.
- Vegetarian household plan; eggs and protein powder are optional allowed items, with no other non-vegetarian foods.
- Weekdays favor quick recipes; soaking, fermentation, complex and batch recipes are primarily scheduled around weekends.
- Traditional foods remain first-class: khichdi, pithla, usal, bhakri, dashmi, idli, dosa, adai, thalipeeth and poha.
- Tejas must use growth/activity-aware planning, never adult calorie-restriction logic.
- Vikas's reported post-dal skin reaction is a family observation/constraint, not a diagnosis and not a reason to exclude every dal.
- Nutrition values use Indian Food Composition Tables / ICMR-NIN references where available; unavailable values remain explicitly unavailable rather than fabricated.
- Shopping and prep quantities have one source: structured recipe ingredients.
- New public tables require RLS and explicit grants; no service-role secrets in browser code.

---

### Task 1: Establish nutrition schema and migration contracts

**Files:**
- Create: `supabase/migrations/20260906010000_family_nutrition_system.sql`
- Modify: `supabase.schema.sql`
- Test: `tests/nutrition-schema.test.js`

**Interfaces:**
- Produces tables: `ingredients`, `recipes`, `recipe_ingredients`, `nutrition_targets`, `seasonal_ingredients`, `meal_plan`.
- Existing household/member identity and operational tables remain authoritative and are referenced rather than duplicated.

- [ ] **Step 1: Write failing structural tests** covering required tables, primary/foreign keys, unique recipe/ingredient identities, bilingual fields, nutrition fields, season fields, recipe timing/tag fields, meal-plan slot constraints, indexes and RLS/grants.
- [ ] **Step 2: Run `node --test tests/nutrition-schema.test.js` and verify the new contract tests fail because the schema does not exist yet.**
- [ ] **Step 3: Add the migration with idempotent-safe DDL, foreign keys, timestamps, indexes, check constraints and RLS policies.** Keep global content read-only to authenticated household users and meal-plan writes constrained to household membership.
- [ ] **Step 4: Mirror the final schema in `supabase.schema.sql` so a fresh database reproduces it.**
- [ ] **Step 5: Run the schema tests and the existing test suite; verify the new tests pass without changing existing behavior.**
- [ ] **Step 6: Commit `feat: add structured family nutrition schema`.**

---

### Task 2: Build canonical ingredient, recipe and seasonal seed data

**Files:**
- Create: `supabase/migrations/20260906011000_family_nutrition_seed.sql`
- Test: `tests/nutrition-data.test.js`

**Interfaces:**
- `ingredients` stores canonical English/Marathi food names, food group, unit, nutrient fields and practical metadata.
- `recipes` stores bilingual identity, serving basis, times, difficulty, slot compatibility, tags, method, storage and source attribution.
- `recipe_ingredients` stores exact quantities/units and preparation state.
- `seasonal_ingredients` stores Nashik/Maharashtra month/season tags with practical availability overrides.

- [ ] **Step 1: Write failing data-contract tests requiring the initial recipe set, bilingual names, exact ingredient quantities, valid slot tags, and seasonal tags for the September plan.**
- [ ] **Step 2: Run the targeted tests and confirm failure because the seed records are absent.**
- [ ] **Step 3: Seed the approved initial library, including moong-vegetable chilla, besan-vegetable chilla, moong-paneer chilla, protein poha/upma, sprouts poha, mixed-dal adai, idli+sambar, ragi dosa, pesarattu, uttapam, khichdi variants, matki/chana usal, mixed beans, chole, lobia, rajma rice, matki misal, pithla 2.0, paneer/tofu dishes, soy-paneer keema, methi dashmi, protein thalipeeth, handvo, bharli vangi, chaat/snack recipes and reusable seed/chutney components.**
- [ ] **Step 4: Encode the exact quantities from the approved recipe library, normalized to a defined recipe serving basis.** Do not copy third-party macro claims; nutrient values come from ingredient records/calculation inputs.
- [ ] **Step 5: Add September–December practical season tags and availability overrides for Nashik/Maharashtra produce without asserting brittle harvest dates.**
- [ ] **Step 6: Run data-contract tests plus the existing recipe coverage tests and verify every current calendar title has a canonical recipe mapping or a deliberate migration alias.**
- [ ] **Step 7: Commit `feat: seed canonical family recipe library`.**

---

### Task 3: Add nutrition calculations and family serving rules

**Files:**
- Create: `nutrition.js`
- Modify: `app.js`
- Modify: `sync.js`
- Test: `tests/nutrition.test.js`

**Interfaces:**
- `calculateRecipeNutrition(recipe, ingredients)` returns a deterministic nutrition summary based on exact ingredient quantities.
- `scaleRecipeIngredients(recipe, householdMember)` returns serving-adjusted ingredient quantities using member configuration rather than duplicating recipes.
- `getFamilyNutritionProfile(memberId)` returns the stored age/activity/reference profile and non-diagnostic family constraints.

- [ ] **Step 1: Write failing unit tests for quantity scaling, nutrient aggregation, missing nutrient fields, family serving multipliers, Tejas growth-safe handling and Vikas per-person dal observation handling.**
- [ ] **Step 2: Run `node --test tests/nutrition.test.js` and verify the expected missing-function failures.**
- [ ] **Step 3: Implement pure calculation helpers with no DOM or Supabase dependencies.** Use numeric nutrient values only when the ingredient record supplies them; preserve `null`/unavailable fields instead of inventing precision.
- [ ] **Step 4: Wire the helpers into the existing state mapping so family profiles and structured recipes are available to the UI.**
- [ ] **Step 5: Run nutrition tests and existing sync/app tests; refactor only while all tests stay green.**
- [ ] **Step 6: Commit `feat: add family nutrition calculations`.**

---

### Task 4: Migrate the monthly calendar to structured meal-plan records

**Files:**
- Modify: `supabase/migrations/20260906012000_family_monthly_plan.sql`
- Modify: `app.js`
- Modify: `sync.js`
- Test: `tests/meal-plan.test.js`
- Modify: `tests/recipe-coverage.test.js`

**Interfaces:**
- `meal_plan` stores `date`, `slot`, `recipe_id` and optional member serving multipliers/notes.
- `resolveMealPlanEntry(date, slot)` returns the canonical recipe and exact food composition.
- Existing UI lookup remains compatible with legacy meal titles during migration, but the canonical source becomes `meal_plan` + `recipes`.

- [ ] **Step 1: Write failing tests requiring 30 days × 4 slots, exact recipe IDs, exact named fruits/vegetables, a quick 5 PM snack each day, no generic placeholders and valid bilingual recipe resolution.**
- [ ] **Step 2: Run the targeted tests and confirm the current hard-coded calendar does not satisfy the structured-record contract.**
- [ ] **Step 3: Seed the September 7–October 6 monthly plan from the approved 30-day meal system, preserving the intended traditional/high-protein rotation and adding exact family serving defaults.**
- [ ] **Step 4: Replace the growing frontend calendar array with a generic Supabase-backed plan loader and a controlled legacy-title migration fallback.**
- [ ] **Step 5: Preserve the current calendar UI while making it render recipe IDs, bilingual names, ingredients and member portions from canonical records.**
- [ ] **Step 6: Run calendar, recipe coverage, app and sync tests and verify no unrelated fallback dish can satisfy an exact recipe lookup.**
- [ ] **Step 7: Commit `feat: migrate calendar to canonical meal plans`.**

---

### Task 5: Derive shopping and weekend batch-prep from recipe ingredients

**Files:**
- Modify: `app.js`
- Modify: `sync.js`
- Test: `tests/shopping-prep.test.js`

**Interfaces:**
- `aggregateShoppingIngredients(mealPlan, recipes, familyPortions, range)` returns deduplicated ingredient totals grouped by grocery category/unit.
- `deriveBatchPrep(mealPlan, recipes, range)` returns soaking, sprouting, batter, bean-cooking, chutney/seed-mix, vegetable-prep and optional egg-prep actions.

- [ ] **Step 1: Write failing tests for weekly aggregation, unit normalization, duplicate ingredient merging, family serving scaling and batch-prep extraction from recipe metadata.**
- [ ] **Step 2: Run the targeted tests and confirm no canonical aggregation implementation exists.**
- [ ] **Step 3: Implement pure aggregation helpers and explicit unit-normalization rules; do not create a second ingredient list in shopping/prep state.**
- [ ] **Step 4: Replace manual shopping/prep quantities with derived values while retaining existing checked/completed state where possible.**
- [ ] **Step 5: Add Sunday/weekend preparation cues for soaking, sprouting, fermentation and batch components, with weekday recipes biased toward quick preparation.**
- [ ] **Step 6: Run shopping/prep, app, sync and recipe tests and verify totals against deterministic fixtures.**
- [ ] **Step 7: Commit `feat: derive shopping and batch prep from recipes`.**

---

### Task 6: Add the Nutrition and Recipes experiences without duplicating the planner

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/app.test.js`

**Interfaces:**
- Nutrition view consumes canonical family profiles, meal-plan records and recipe nutrition helpers.
- Recipes view consumes canonical recipe records and filters by slot, timing, traditional/protein/seasonal tags.
- Existing Health/Settings/PWA views remain intact.

- [ ] **Step 1: Write failing UI-contract tests for Nutrition navigation, family cards, protein/fibre/food-group summaries, Recipes search/filter/detail, exact ingredients and bilingual recipe names.**
- [ ] **Step 2: Run the targeted tests and verify the new UI contracts fail.**
- [ ] **Step 3: Add generic renderers for family nutrition cards and recipe cards/details; keep all recipe content in Supabase data.**
- [ ] **Step 4: Add recipe detail sections for ingredients, method, active/cook/total time, quick/weekend/batch classification, storage, nutrition summary and source attribution.**
- [ ] **Step 5: Add member portion controls that adjust quantities without creating separate recipe copies.**
- [ ] **Step 6: Run all app/UI tests and inspect the generated HTML/CSS markers for accessibility and responsive layout compatibility.**
- [ ] **Step 7: Commit `feat: add nutrition and recipe views`.**

---

### Task 7: Integration verification, Supabase migration and release

**Files:**
- Modify: `README.md`
- Modify: `tests/*.test.js`
- Modify: `docs/superpowers/plans/2026-09-06-family-nutrition-system-plan.md`

**Interfaces:**
- All existing and new tests must pass together.
- Production Supabase schema must match committed migrations.
- Vercel deployment must serve the canonical branch result without breaking anonymous auth or PWA shell behavior.

- [ ] **Step 1: Run `node --check app.js` and `node --check nutrition.js`.**
- [ ] **Step 2: Run `node --test tests/*.test.js` and require zero failures.**
- [ ] **Step 3: Inspect the final migration/schema diff for accidental service-role credentials, permissive RLS, duplicate planner/storage structures or hard-coded recipe databases.**
- [ ] **Step 4: Apply the new Supabase migrations through the project's existing migration workflow and verify table/policy presence and seeded row counts.**
- [ ] **Step 5: Verify the branch deployment on Vercel and exercise anonymous household loading, calendar, Recipes, Nutrition, Shopping, Prep, Health and Settings flows.**
- [ ] **Step 6: Update README with the canonical nutrition architecture, recipe-content workflow and migration/deployment notes.**
- [ ] **Step 7: Commit `chore: verify family nutrition release` and open a PR from `feat/family-nutrition-system` into `main`.**

## Verification Matrix

| Area | Required verification |
| --- | --- |
| Schema | Tables, constraints, indexes, RLS and grants match the design |
| Recipes | Initial library has exact quantities, bilingual names and no generic placeholders |
| Nutrition | Ingredient-based deterministic calculations; unavailable values stay unavailable |
| Family | Four members use shared recipes with member-specific serving adjustments; Tejas is growth-safe |
| Vikas | Dal reaction is represented only as an observation/constraint |
| Calendar | 30 days × 4 slots; exact recipe resolution; daily quick snack |
| Seasonality | Nashik/Maharashtra practical tags and month overrides |
| Shopping | Derived only from recipe ingredients; deduplicated totals |
| Prep | Derived batch actions; weekend emphasis for soaking/sprouting/fermentation |
| UI | Calendar, Recipes, Nutrition, Shopping, Prep, Health and Settings coexist without duplicate planners |
| Security | No service-role secret in browser; new tables protected by RLS |
| Regression | Existing auth, realtime sync, PWA and current tests remain green |
| Release | Supabase migration and Vercel deployment verified |
