# Kutumb Bhojan Phase 2 — Recipe, Nutrition, Meal Balance & Shopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing Kutumb Bhojan app from free-form recipe ingredients into a canonical ingredient, member-assignment, alternate-selection and portion-aware shopping system while adding reusable bilingual nutrition education and rule-based meal-balance indicators, without introducing calorie calculations.

**Architecture:** Extend the existing single-app architecture rather than creating a parallel implementation. Supabase remains the canonical persistence layer; canonical ingredients become the one identity used by recipe ingredients, eligibility, assignments, and shopping aggregation. The browser keeps the current state/rendering model and adds pure domain helpers for normalization, eligibility, alternate ranking, portions, balance, and shopping so the existing UI can adopt the new model incrementally.

**Tech Stack:** Static HTML/CSS/ES modules, browser JavaScript, Supabase JS v2, PostgreSQL/Supabase migrations and RLS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-06-kutumb-bhojan-recipe-nutrition-shopping-design.md`

## Global Constraints

- Preserve the existing single Kutumb Bhojan application and one canonical Vercel project.
- Preserve anonymous shared-household authentication and existing Supabase RLS boundaries.
- Do not create parallel V2/V3 implementations or duplicate ingredient identity tables.
- Canonical ingredient identity is language-neutral and is the aggregation key for shopping and future nutrition data.
- Initial units are `g`, `kg`, `ml`, `L`, `piece`, `tsp`, `tbsp`, and `cup`; unit logic must be centralized and extensible.
- Existing recipe names, methods, display content, calendar behavior, shopping, prep, Health Guide, settings, theme, and PWA behavior must remain usable.
- Egg eligibility is determined from structured canonical ingredient data; Siddhesh and Tejas are eligible, Vikas and Namrata are ineligible.
- Automatic alternates must prefer existing suitable recipes and must never silently invent recipes.
- Day-level alternate overrides affect only the selected date/meal/member assignment and are reversible.
- Nutrition Phase 2 uses practical attributes only; calories are not calculated or displayed as Phase 2 metrics.
- Nutrition education is reusable and bilingual English + Marathi, with general public-health wording rather than diagnosis or individualized prescription.
- Shopping is derived from actual member assignments and canonical recipe ingredients, including day-level overrides.
- Unsafe unit conversions remain separate unit buckets rather than being silently converted.
- Existing recipes are enriched incrementally; unmapped legacy ingredient text remains visible until safely normalized.
- Every code change must have automated regression coverage and a passing full test suite before completion.

---

## File Map

### Existing files to modify
- `app.js` — integrate the new domain model into remote loading, recipe detail, calendar assignments, alternate selection, Health Guide, shopping, backup/import/reset, and rendering.
- `sync.js` — add deterministic mapping/serialization helpers for canonical ingredients, structured recipe ingredients, assignments, nutrition education, and the new persisted state.
- `styles.css` — add assignment/alternate states, structured ingredient rows, balance indicators, shopping quantities/categories, and mobile-friendly controls while preserving the existing visual system.
- `index.html` — only if new semantic containers or accessibility metadata are required by the implemented UI; preserve the current theme bootstrap and PWA shell.
- `supabase.schema.sql` — document the final Phase 2 schema, RLS policies, grants, constraints, and compatibility fields.
- `tests/*.test.js` — extend the existing Node test suite with pure domain, mapping, rendering-marker, and schema-contract coverage.
- `README.md` — document the Phase 2 data model, assignment behavior, shopping derivation, and calorie deferral.

### New files to create
- `supabase/migrations/20260906_recipe_nutrition_shopping.sql` — canonical ingredient, structured recipe ingredient, rule, meal assignment, and nutrition metadata schema plus seed/compatibility migrations.
- `supabase/migrations/20260906_recipe_nutrition_seed.sql` — deterministic canonical ingredient aliases, enriched recipe mappings, nutrition education content, and safe legacy migration data if separated from the schema migration.
- `tests/recipe-nutrition-domain.test.js` — pure-domain tests for units, aliases, egg detection, eligibility, alternate ranking, portions, balance, and shopping aggregation.

The implementation should keep the domain logic in existing `app.js`/`sync.js` unless a new module is demonstrably necessary; do not introduce a second application entry point or duplicate state model.

---

### Task 1: Establish canonical ingredient and unit domain contracts

**Files:**
- Create: `tests/recipe-nutrition-domain.test.js`
- Modify: `sync.js`
- Modify: `app.js`

**Interfaces:**
- Produces `SUPPORTED_UNITS` containing `g`, `kg`, `ml`, `L`, `piece`, `tsp`, `tbsp`, `cup`.
- Produces `normalizeIngredientAlias(value, aliases)` returning a stable canonical key or `null` for an unknown alias.
- Produces `normalizeUnit(value)` returning a supported unit or `null`.
- Produces `canAggregateUnits(unitA, unitB)` and `convertQuantity(quantity, fromUnit, toUnit)` only for explicitly safe conversions.
- Produces `aggregateIngredientLines(lines)` which groups by canonical ingredient and compatible unit, preserving separate buckets when conversion is unsafe.

- [ ] **Step 1: Write failing tests for unit normalization and alias identity.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIngredientAlias, normalizeUnit, convertQuantity, aggregateIngredientLines } from '../sync.js';

test('normalizes English, plural, and Marathi aliases to one canonical ingredient', () => {
  const aliases = {
    onion: ['onion', 'onions', 'कांदा', 'कांदे']
  };
  assert.equal(normalizeIngredientAlias('कांदे', aliases), 'onion');
  assert.equal(normalizeIngredientAlias('onions', aliases), 'onion');
});

test('accepts only the Phase 2 unit catalog', () => {
  assert.equal(normalizeUnit('kg'), 'kg');
  assert.equal(normalizeUnit('count'), 'piece');
  assert.equal(normalizeUnit('handful'), null);
});

test('converts mass and volume only within safe dimensions', () => {
  assert.equal(convertQuantity(1, 'kg', 'g'), 1000);
  assert.equal(convertQuantity(1, 'L', 'ml'), 1000);
  assert.equal(convertQuantity(1, 'kg', 'ml'), null);
});

test('keeps unsafe unit buckets separate during shopping aggregation', () => {
  const result = aggregateIngredientLines([
    { ingredientKey: 'onion', quantity: 500, unit: 'g' },
    { ingredientKey: 'onion', quantity: 1, unit: 'piece' }
  ]);
  assert.deepEqual(result, [
    { ingredientKey: 'onion', quantity: 500, unit: 'g' },
    { ingredientKey: 'onion', quantity: 1, unit: 'piece' }
  ]);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the new domain helpers are absent.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL on the imported helper names.

- [ ] **Step 3: Implement the centralized unit and alias helpers.**

Use explicit conversion maps for `kg↔g` and `L↔ml`; do not add density assumptions for food volume-to-mass conversion. Normalize `count` to `piece` and normalize aliases by trimmed, case-folded string comparison while preserving canonical keys as language-neutral values.

- [ ] **Step 4: Run the focused domain test.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: PASS.

- [ ] **Step 5: Run the existing full test suite to verify no regression from exports/state helpers.**

Run: `node --test tests/*.test.js`
Expected: all existing tests plus the new focused tests pass.

---

### Task 2: Add the canonical ingredient and structured recipe-ingredient schema

**Files:**
- Create: `supabase/migrations/20260906_recipe_nutrition_shopping.sql`
- Modify: `supabase.schema.sql`
- Modify: `README.md`

**Interfaces:**
- Produces global `public.ingredients` with unique `canonical_key`, bilingual names, aliases, category, default unit, active flag, and timestamps.
- Produces household-scoped `public.recipe_ingredients` referencing `recipes.id` and `ingredients.id`, with non-negative quantity, supported unit, optional display/preparation fields, and stable ordering.
- Extends `public.recipes` with additive Phase 2 fields for description, meal category, meal role, servings, cooking method, dietary flags, and practical nutrition metadata without removing legacy columns.
- Existing legacy `recipes.ingredients` JSON remains readable during migration.

- [ ] **Step 1: Write schema-contract tests before migration changes.**

```js
test('Phase 2 schema exposes canonical ingredient and structured recipe ingredient contracts', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260906_recipe_nutrition_shopping.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.ingredients/i);
  assert.match(sql, /canonical_key text not null unique/i);
  assert.match(sql, /create table if not exists public\.recipe_ingredients/i);
  assert.match(sql, /quantity numeric.*check.*quantity >= 0/is);
  assert.match(sql, /recipe_id uuid.*references public\.recipes/i);
  assert.match(sql, /ingredient_id uuid.*references public\.ingredients/i);
});
```

- [ ] **Step 2: Run the contract test and confirm it fails because the migration does not yet exist.**

Run: `node --test tests/*.test.js`
Expected: FAIL only for the new schema-contract assertions.

- [ ] **Step 3: Implement the migration with explicit constraints and indexes.**

Create the tables with RLS enabled. Enforce canonical-key uniqueness globally, recipe/ingredient foreign keys, non-negative quantities, supported units, positive recipe servings, and household ownership checks. Use RLS policies based on the existing `is_household_member` security-definer function and the same `(select ...)` init-plan optimization pattern already used in the project.

- [ ] **Step 4: Extend `supabase.schema.sql` to match the migration.**

Keep the schema file reproducible and aligned with production migrations, including grants, RLS, indexes, and compatibility columns.

- [ ] **Step 5: Update README data-model documentation and run schema-contract tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 6: Apply the migration to the dedicated Supabase project before UI integration.**

Verify table creation, RLS enabled state, grants, and constraints using the connected Supabase tooling. Do not expose a service-role key in source files.

---

### Task 3: Normalize existing recipes incrementally without losing legacy content

**Files:**
- Create: `supabase/migrations/20260906_recipe_nutrition_seed.sql`
- Modify: `sync.js`
- Modify: `app.js`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `mapIngredients`, `mapRecipeIngredients`, and `serializeRecipeIngredients` helpers.
- Produces a recipe state shape containing both `legacyIngredients` and normalized `ingredients` where available.
- Preserves legacy ingredient display text whenever a line cannot be safely mapped.

- [ ] **Step 1: Add failing tests for known recipe ingredient mapping and unmapped preservation.**

```js
test('maps known recipe ingredient aliases to canonical identities', () => {
  const recipe = {
    ingredients: ['250 g onion', '1 tsp turmeric']
  };
  const catalog = [
    { canonicalKey: 'onion', aliases: ['onion', 'onions', 'कांदा', 'कांदे'] },
    { canonicalKey: 'turmeric', aliases: ['turmeric', 'haldi', 'हळद'] }
  ];
  const mapped = mapLegacyRecipeIngredients(recipe, catalog);
  assert.equal(mapped.structured.length, 2);
  assert.equal(mapped.structured[0].ingredientKey, 'onion');
  assert.equal(mapped.legacyUnmapped.length, 0);
});

test('keeps an unmapped legacy line visible instead of dropping it', () => {
  const result = mapLegacyRecipeIngredients({ ingredients: ['1 handful unknown greens'] }, []);
  assert.equal(result.structured.length, 0);
  assert.deepEqual(result.legacyUnmapped, ['1 handful unknown greens']);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because `mapLegacyRecipeIngredients` is not implemented.

- [ ] **Step 3: Implement deterministic parsing for the supported unit catalog and alias lookup.**

Parse only unambiguous leading quantity/unit patterns, map aliases through canonical catalog data, and retain any unparsed line in `legacyUnmapped`. Never infer an ingredient identity solely from an uncertain recipe title.

- [ ] **Step 4: Seed the canonical catalog and enrich existing recipes incrementally.**

Use the existing recipe content as the source for known ingredients. Preserve names, methods, and display strings. Add structured lines only where identity and unit are sufficiently reliable. Do not delete or blank the legacy ingredient array.

- [ ] **Step 5: Run the domain and full regression tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 4: Add structured meal metadata, dietary characteristics, and generic eligibility rules

**Files:**
- Modify: `supabase/migrations/20260906_recipe_nutrition_shopping.sql`
- Modify: `supabase.schema.sql`
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `deriveRecipeDietaryFlags(recipe, recipeIngredients, ingredientCatalog)` with `containsEgg` and `vegetarian` at minimum.
- Produces generic `evaluateRecipeEligibility(member, recipe, rules)` returning `{ eligible, reasons }`.
- Produces the first rule configuration for Siddhesh, Tejas, Vikas, and Namrata without hard-coding separate UI branches for each member.

- [ ] **Step 1: Write failing egg-detection and eligibility tests.**

```js
test('derives egg presence from canonical ingredient identity', () => {
  const flags = deriveRecipeDietaryFlags({ ingredients: [
    { ingredientKey: 'egg', quantity: 2, unit: 'piece' }
  ]});
  assert.equal(flags.containsEgg, true);
  assert.equal(flags.vegetarian, false);
});

test('applies the first household eligibility rule to all four members', () => {
  const recipe = { dietaryFlags: { containsEgg: true } };
  assert.equal(evaluateRecipeEligibility({ name: 'Siddhesh' }, recipe, DEFAULT_DIETARY_RULES).eligible, true);
  assert.equal(evaluateRecipeEligibility({ name: 'Tejas' }, recipe, DEFAULT_DIETARY_RULES).eligible, true);
  assert.equal(evaluateRecipeEligibility({ name: 'Vikas' }, recipe, DEFAULT_DIETARY_RULES).eligible, false);
  assert.equal(evaluateRecipeEligibility({ name: 'Namrata' }, recipe, DEFAULT_DIETARY_RULES).eligible, false);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because the new functions/rules do not yet exist.

- [ ] **Step 3: Implement canonical egg detection and generic rule evaluation.**

Treat canonical ingredient `egg` as authoritative. The rule engine consumes member attributes and structured rule definitions; it must not contain separate `if (member === ...)` branches scattered through calendar rendering.

- [ ] **Step 4: Add meal category, role, servings, cooking method, and practical dietary/nutrition metadata to existing recipe records.**

Use additive fields and preserve current legacy `course`, `protein`, `fibre`, `oil`, and other display data until their normalized replacements are populated.

- [ ] **Step 5: Run all tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 5: Implement existing-recipe vegetarian alternate ranking

**Files:**
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `rankAlternateRecipes(ineligibleRecipe, member, candidateRecipes)` returning candidates ordered by: same meal role, similar dish/function, vegetarian compatibility, similar protein/nutrition role, same meal category, then other suitable fallback.
- Produces `selectAutomaticAlternate(ineligibleRecipe, member, candidateRecipes)` returning `{ recipe, reason }` or `{ recipe: null, reason }`.

- [ ] **Step 1: Write failing tests for ranking and no-alternate behavior.**

```js
test('prefers an existing vegetarian recipe with the same meal role and function', () => {
  const candidates = [
    { id: 'a', mealRole: 'main', mealCategory: 'breakfast', dietaryFlags: { vegetarian: true }, dishFunction: 'savory-main', nutrition: { proteinRole: 'legume' } },
    { id: 'b', mealRole: 'side', mealCategory: 'breakfast', dietaryFlags: { vegetarian: true }, dishFunction: 'savory-main', nutrition: { proteinRole: 'legume' } }
  ];
  const ranked = rankAlternateRecipes({ mealRole: 'main', mealCategory: 'breakfast', dishFunction: 'savory-main', nutrition: { proteinRole: 'legume' } }, { name: 'Vikas' }, candidates);
  assert.equal(ranked[0].id, 'a');
});

test('returns an explicit no-alternate result instead of fabricating a recipe', () => {
  const result = selectAutomaticAlternate({ dietaryFlags: { containsEgg: true } }, { name: 'Vikas' }, []);
  assert.equal(result.recipe, null);
  assert.match(result.reason, /no suitable/i);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL on missing ranking functions.

- [ ] **Step 3: Implement deterministic scoring with the specified priority order.**

Use stable tie-breaking by recipe name/id after the required criteria. Filter out ineligible candidates before ranking. Never construct a new recipe object as an alternate.

- [ ] **Step 4: Run the focused and full suites.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 6: Add member-level meal assignments, portions, and day-level override persistence

**Files:**
- Modify: `supabase/migrations/20260906_recipe_nutrition_shopping.sql`
- Modify: `supabase.schema.sql`
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `public.meal_assignments` keyed by meal entry, member, and recipe, with portion count/factor, assignment source, automatic-recipe reference, override metadata, and household ownership validation.
- Produces `buildAutomaticAssignments(mealEntry, members, recipes, rules)`.
- Produces `applyDayLevelOverride(assignments, memberId, recipeId)` and `revertDayLevelOverride(assignments, memberId)`.
- An override never mutates the household rule definition.

- [ ] **Step 1: Write failing tests for automatic assignments, portions, override isolation, and revert.**

```js
test('egg meal assigns the egg recipe to Siddhesh and Tejas and a vegetarian alternate to Vikas and Namrata', () => {
  const assignments = buildAutomaticAssignments(mealEntry, members, recipes, DEFAULT_DIETARY_RULES);
  assert.equal(recipeFor(assignments, 'Siddhesh'), 'egg-recipe');
  assert.equal(recipeFor(assignments, 'Tejas'), 'egg-recipe');
  assert.equal(recipeFor(assignments, 'Vikas'), 'veg-alternate');
  assert.equal(recipeFor(assignments, 'Namrata'), 'veg-alternate');
});

test('day-level override changes only the selected assignment and can be reverted', () => {
  const original = buildAutomaticAssignments(mealEntry, members, recipes, DEFAULT_DIETARY_RULES);
  const changed = applyDayLevelOverride(original, 'vikas-id', 'another-veg');
  assert.equal(recipeFor(changed, 'vikas-id'), 'another-veg');
  assert.equal(recipeFor(changed, 'namrata-id'), 'veg-alternate');
  assert.equal(recipeFor(changed, 'siddhesh-id'), 'egg-recipe');
  const reverted = revertDayLevelOverride(changed, 'vikas-id');
  assert.equal(recipeFor(reverted, 'vikas-id'), 'veg-alternate');
});
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because assignment functions/schema do not yet exist.

- [ ] **Step 3: Implement the `meal_assignments` migration with household/member/recipe integrity constraints.**

Require the referenced member and recipe to belong to the same household as the meal entry. Store assignment source (`automatic` or `manual`), the automatic recipe id, and override metadata so the UI can revert to the automatic proposal without changing the default rule.

- [ ] **Step 4: Implement assignment construction and override helpers.**

Use the eligibility engine and alternate selector from Tasks 4–5. Portion count is explicit per assignment and defaults to one logical portion factor per assigned member unless the meal plan provides a different value.

- [ ] **Step 5: Integrate assignments into remote load/save and realtime handling.**

Load assignments with meal entries, serialize only household-scoped rows, subscribe to assignment changes alongside the existing meal-entry subscription, and preserve backward compatibility for existing meal entries that have no assignments yet by generating deterministic assignments in memory until persisted.

- [ ] **Step 6: Run all tests and schema contracts.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 7: Add practical nutrition metadata and reusable bilingual education

**Files:**
- Modify: `supabase/migrations/20260906_recipe_nutrition_seed.sql`
- Modify: `sync.js`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces recipe-level practical attributes: protein, fibre, carbohydrates, fat/fat quality, oil, vegetables, fruits, whole grains, legumes/pulses, and main protein source as structured metadata where trustworthy.
- Produces reusable bilingual nutrition education records for those concepts with `what`, `body_use`, `function`, `why_it_matters`, and `food_sources` in English and Marathi.
- Produces `mapNutritionEducation` and `getNutritionEducation(conceptKey)`.

- [ ] **Step 1: Write failing tests for bilingual mapping and calorie exclusion.**

```js
test('maps reusable nutrition education as paired English and Marathi content', () => {
  const mapped = mapNutritionEducation([{
    concept_key: 'protein',
    title: 'Protein', marathi_title: 'प्रथिने',
    what: 'A nutrient used to build and repair body tissues.',
    marathi_what: 'शरीराच्या ऊती तयार करण्यासाठी आणि दुरुस्तीसाठी उपयोगी पोषक घटक.',
    active: true
  }]);
  assert.equal(mapped[0].title, 'Protein');
  assert.equal(mapped[0].marathiTitle, 'प्रथिने');
  assert.equal('calories' in mapped[0], false);
});
```

- [ ] **Step 2: Run the focused test and confirm failure.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because the mapper is not implemented.

- [ ] **Step 3: Seed reusable bilingual education content for the Phase 2 concepts.**

Keep explanatory copy centralized rather than duplicating it in every recipe. Use general public-health wording and explicitly avoid disease treatment claims, diagnostic language, or individualized targets.

- [ ] **Step 4: Map and render the content through the existing Health Guide.**

Add expandable concept explanations to recipe details and Health Guide cards. Remove calories from Phase 2 nutrition metrics even where legacy recipe records contain a `cal`/`calories` display field; do not calculate or replace it with a new estimate.

- [ ] **Step 5: Run the full test suite.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 8: Implement rule-based meal balance indicators

**Files:**
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `styles.css`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `evaluateMealBalance(assignments, recipes)` returning explicit evidence indicators rather than a numerical health score.
- Indicators include protein source present, vegetable component present, pulse/legume present, whole-grain component present, fruit component where relevant, and oil consideration.
- Each indicator includes a bilingual label and evidence recipe/member assignment where applicable.

- [ ] **Step 1: Write failing tests for evidence-based balance indicators.**

```js
test('meal balance reports evidence instead of a pseudo-precise score', () => {
  const result = evaluateMealBalance(assignments, recipes);
  assert.equal(result.score, undefined);
  assert.equal(result.indicators.some(item => item.key === 'protein_source'), true);
  assert.equal(result.indicators.some(item => item.key === 'vegetable_component'), true);
});
```

- [ ] **Step 2: Run the focused test and confirm failure.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because `evaluateMealBalance` is absent.

- [ ] **Step 3: Implement deterministic indicator evaluation from actual assignments.**

Do not infer a numeric health score. Show which recipe/ingredient metadata supports each indicator and distinguish “present”, “not detected”, and “not relevant” where appropriate.

- [ ] **Step 4: Integrate balance evidence into calendar and recipe views.**

Render compact bilingual indicators with an expandable evidence explanation. Ensure member-specific alternate assignments are the inputs to balance evaluation.

- [ ] **Step 5: Run all tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 9: Replace shopping derivation with assignment-aware canonical aggregation

**Files:**
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `styles.css`
- Modify: `tests/recipe-nutrition-domain.test.js`

**Interfaces:**
- Produces `buildShoppingFromAssignments(assignments, recipes, recipeIngredients, ingredientCatalog)`.
- Shopping quantities are multiplied by assignment portion factor/count.
- Aggregation groups by canonical ingredient and safely compatible unit.
- Manual day-level overrides replace the automatic assignment for that member/date/meal in shopping output.

- [ ] **Step 1: Write failing tests for portion-aware canonical aggregation and override impact.**

```js
test('aggregates the same canonical ingredient across assigned recipes', () => {
  const shopping = buildShoppingFromAssignments(assignments, recipes, recipeIngredients, ingredientCatalog);
  const onion = shopping.find(item => item.canonicalKey === 'onion' && item.unit === 'g');
  assert.equal(onion.quantity, 500);
});

test('shopping follows the selected day-level alternate instead of the original recipe', () => {
  const shopping = buildShoppingFromAssignments(overriddenAssignments, recipes, recipeIngredients, ingredientCatalog);
  assert.equal(shopping.some(item => item.canonicalKey === 'egg'), false);
  assert.equal(shopping.some(item => item.canonicalKey === 'paneer'), true);
});
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `node --test tests/recipe-nutrition-domain.test.js`
Expected: FAIL because the assignment-aware shopping builder is absent.

- [ ] **Step 3: Implement shopping aggregation from assignments only.**

For every assignment, multiply each structured recipe ingredient by the assignment portion factor/count, then aggregate by canonical ingredient and safe unit. Keep incompatible units separate. Do not read the original meal-entry title as a shopping source once assignments exist.

- [ ] **Step 4: Integrate the builder with the existing Shopping view and persistence.**

Preserve manually added shopping items as a separate explicit user list if the current app supports them; generated meal-derived items must have a distinguishable source so regeneration does not delete unrelated manual items.

- [ ] **Step 5: Verify shopping changes after an override and run all tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 10: Update calendar, recipe, and health UI for transparent assignments and overrides

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `index.html` if semantic structure requires it
- Modify: `tests/*.test.js`

**Interfaces:**
- Calendar renders primary recipe plus member-specific assignments.
- Ineligible members show the automatic vegetarian alternate and its selection reason.
- `Change for this day` opens a constrained list of existing suitable recipes.
- `Revert to automatic` restores the stored automatic recipe.
- No-alternate state is visibly flagged and never replaced by invented content.

- [ ] **Step 1: Add failing implementation-marker tests for the new controls.**

```js
test('calendar source contains transparent alternate controls', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /Change for this day/);
  assert.match(source, /Revert to automatic/);
  assert.match(source, /no suitable/i);
});
```

- [ ] **Step 2: Run the marker test and confirm failure.**

Run: `node --test tests/*.test.js`
Expected: FAIL for the missing UI markers.

- [ ] **Step 3: Implement the calendar assignment UI using existing render/bind patterns.**

Keep the mobile calendar compact: primary meal title first, member assignment rows underneath, then alternate action. Use bilingual labels and preserve existing 30-day/4-slot behavior.

- [ ] **Step 4: Implement recipe detail structured ingredient and nutrition sections.**

Show bilingual name, servings, meal role/category, structured quantity/unit lines, method, practical nutrition indicators, expandable education, and eligibility information where relevant. Legacy unmapped ingredient text remains visible.

- [ ] **Step 5: Update styles for mobile/tablet/desktop and accessibility.**

Ensure buttons have clear labels, alternate states are visually distinguishable without relying on color alone, and long bilingual text wraps safely on phone widths.

- [ ] **Step 6: Run all tests and a static smoke test.**

Run: `node --test tests/*.test.js`
Run a local static server and verify `/`, `/app.js`, `/sync.js`, `/styles.css`, `/manifest.webmanifest`, and `/service-worker.js` return HTTP 200.
Expected: all tests pass and all shell assets return 200.

---

### Task 11: Extend backup/import/reset and remote synchronization for new structured state

**Files:**
- Modify: `app.js`
- Modify: `sync.js`
- Modify: `tests/*.test.js`

**Interfaces:**
- Backup JSON includes canonical ingredient references used by the household, structured recipe ingredients, assignments, nutrition metadata references, and household settings without duplicating the global canonical catalog unnecessarily.
- Import validates versioned structured state and preserves legacy recipe content.
- Reset restores starter state and calls both operational save and `saveHouseholdSettings()` so remote settings are not left stale.

- [ ] **Step 1: Add failing regression tests for backup/import/reset preservation.**

```js
test('backup state contains structured recipe ingredients and meal assignments', () => {
  const backup = buildBackupPayload(state);
  assert.ok(Array.isArray(backup.recipes));
  assert.ok(Array.isArray(backup.mealAssignments));
  assert.ok(backup.version);
});

test('reset path persists default household settings remotely', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /saveHouseholdSettings\(\)/);
});
```

- [ ] **Step 2: Run the tests and confirm failure for the new backup/reset assertions.**

Run: `node --test tests/*.test.js`
Expected: FAIL only for new assertions not yet implemented.

- [ ] **Step 3: Extend backup/import with an explicit schema version and structured state sections.**

Do not serialize redundant copies of global nutrition education. Store stable keys/records needed to restore household state and keep imported legacy data visible.

- [ ] **Step 4: Fix reset and import synchronization paths.**

After local state restoration, persist household settings separately from the operational table save. Ensure assignment/recipe structured state is synchronized without creating duplicate rows.

- [ ] **Step 5: Run all tests.**

Run: `node --test tests/*.test.js`
Expected: PASS.

---

### Task 12: Production-schema verification, documentation, and final regression gate

**Files:**
- Modify: `README.md`
- Modify: `supabase.schema.sql`
- Modify: `tests/*.test.js`

**Interfaces:**
- Production database contains the Phase 2 tables/columns, RLS policies, grants, constraints, canonical seed data, and assignment integrity rules.
- README accurately describes the deployed architecture without mentioning a parallel V2/V3 app or calorie calculation.

- [ ] **Step 1: Run the complete local test suite.**

Run: `node --test tests/*.test.js`
Expected: all tests pass with zero failures.

- [ ] **Step 2: Run JavaScript syntax checks.**

Run: `node --check app.js && node --check sync.js`
Expected: both commands exit successfully.

- [ ] **Step 3: Run the static application smoke test and inspect the generated source archive.**

Verify all shell assets return HTTP 200 and that the ZIP contains the root app files, `public/` assets, `supabase/migrations/`, tests, and Phase 2 docs without stale nested application copies.

- [ ] **Step 4: Verify Supabase production contracts.**

Confirm the Phase 2 tables, row counts, RLS enabled state, grants, foreign keys, and migration history using Supabase tooling. Confirm anonymous authentication remains unchanged and no browser source contains a service-role secret.

- [ ] **Step 5: Re-run security/performance advisors and distinguish intentional warnings from regressions.**

Do not weaken the existing security-definer bootstrap/member functions merely to silence intentional warnings. Investigate any new warning caused by Phase 2 policies.

- [ ] **Step 6: Update README with final Phase 2 behavior and Phase 3 boundary.**

Document the canonical ingredient flow, member assignment/alternate rules, day-level override behavior, shopping derivation, bilingual nutrition education, and explicit calorie deferral.

- [ ] **Step 7: Create the final source ZIP only after all verification passes.**

The ZIP must be generated from the modified canonical source tree and its exact runtime path must be verified before providing the download link.

---

## Final Acceptance Checklist

- [ ] Canonical ingredient identity is unique and alias-aware.
- [ ] Structured recipe ingredients coexist safely with legacy ingredient text.
- [ ] Units are centralized and unsafe conversions remain separate.
- [ ] Recipe servings/category/role/dietary metadata are available.
- [ ] Egg detection comes from canonical ingredient identity.
- [ ] Siddhesh and Tejas receive egg recipes; Vikas and Namrata receive existing suitable vegetarian alternates.
- [ ] Alternate ranking follows the approved priority order.
- [ ] No suitable alternate produces an explicit warning rather than invented content.
- [ ] `Change for this day` affects only that date/meal/member and can be reverted.
- [ ] Portion-aware assignments drive nutrition/balance and shopping.
- [ ] Nutrition education is reusable and bilingual.
- [ ] Meal balance is evidence-based and has no pseudo-precise score.
- [ ] Shopping aggregates canonical ingredients from actual assignments and follows overrides.
- [ ] Existing shopping/prep/calendar/recipe/health/settings/PWA behavior remains functional.
- [ ] Backup/import/reset preserves the new structured state.
- [ ] No Phase 2 calories are calculated or displayed as nutrition metrics.
- [ ] Supabase RLS remains household-scoped and anonymous shared-household auth remains intact.
- [ ] Full automated tests, syntax checks, static smoke tests, and database verification pass before claiming completion.
