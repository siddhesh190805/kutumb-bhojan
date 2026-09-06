# Kutumb Bhojan Phase 2 — Recipe, Nutrition, Meal Balance & Shopping Design

## Status
Approved architecture; written specification pending user review.

## Goal
Evolve the existing Kutumb Bhojan family meal-planning app into a structured meal-planning system where canonical recipe ingredients are the single foundation for member-specific meal assignments, practical nutrition education, meal-balance guidance, and shopping aggregation.

Phase 2 deliberately does not introduce calorie calculations or a comprehensive food-composition database. Those capabilities are reserved for Phase 3.

## Product principles
- Preserve the existing single Kutumb Bhojan application, anonymous shared-household model, Supabase canonical data model, bilingual UI and existing meal/recipe/shopping/prep workflows.
- Do not create parallel V2/V3 implementations or duplicate ingredient representations.
- Canonical ingredient identity is language-neutral and is the aggregation key for shopping and the future nutrition database.
- Recipe ingredients are structured data, not only free-form display text.
- Meal assignments represent the people who actually receive each recipe and their portion basis.
- Dietary eligibility is rule-driven; the first automatic rule is that egg-containing recipes are for Siddhesh and Tejas, while Vikas and Namrata receive a suitable vegetarian alternate.
- Automatic alternates use existing suitable recipes first. The system must never silently invent a recipe.
- A user may change an alternate for a particular day/meal only; that change does not alter the household default rule.
- Nutrition guidance is practical and educational, not medical diagnosis or prescription.
- Every user-facing nutrition explanation is English + Marathi.
- Calories are Phase 3.

## Scope
### Included in Phase 2
1. Canonical ingredient model and aliases.
2. Structured recipe ingredients with quantity/unit.
3. Initial unit catalog: g, kg, ml, L, piece/count, tsp, tbsp, cup.
4. Recipe servings, meal category and meal role.
5. Dietary characteristics sufficient for eligibility and alternate selection.
6. Member eligibility and portion-aware meal assignments.
7. Generic rule/constraint model with the egg rule as the first rule.
8. Automatic existing-recipe vegetarian alternate selection.
9. Day-level alternate override.
10. Practical nutrition attributes without calories.
11. Reusable bilingual nutrition education content.
12. Meal-balance indicators and explanations.
13. Shopping aggregation from actual meal assignments and canonical ingredients.
14. Tests and migrations preserving existing functionality.

### Explicitly deferred to Phase 3
- Calories.
- Comprehensive food/nutrition database.
- Standardized nutrient composition for canonical ingredients.
- Automated full nutrient calculation from food-composition data.
- Detailed micronutrient calculations.
- Clinical or disease-specific meal prescriptions.

## Domain model

### Ingredient
A canonical food/material identity used by recipes and downstream systems.

Fields conceptually include:
- id
- canonical_key
- name
- marathi_name
- aliases
- category
- default_unit
- active
- created_at / updated_at

`canonical_key` is language-neutral and stable. English, Marathi, plural and legacy spellings are display/lookup aliases, not separate ingredients.

Example:
- canonical_key: `onion`
- English: Onion
- Marathi: कांदा
- aliases: onions, कांदे

### Recipe
A household recipe definition.

Fields conceptually include:
- id
- household_id
- recipe_key
- name / marathi_name
- description / marathi_description
- meal_category
- meal_role
- servings
- cooking_method
- dietary_flags
- ingredients
- method
- practical nutrition metadata
- created_at / updated_at

Existing recipe records remain valid during migration. Structured fields are additive and should not require discarding current recipe instructions/content.

### RecipeIngredient
A structured recipe ingredient line.

Fields conceptually include:
- recipe_id
- ingredient_id
- quantity
- unit
- optional display_quantity/display_unit
- optional preparation note
- sort_order

Initial supported units:
- g
- kg
- ml
- L
- piece/count
- tsp
- tbsp
- cup

The unit model must be extensible. Do not encode unit logic as scattered UI-specific conditionals.

### Recipe eligibility / dietary characteristics
Recipes expose structured characteristics sufficient to answer questions such as:
- contains_egg
- vegetarian
- protein_role
- other future dietary flags

Egg presence is derived from canonical ingredient identity/structured ingredient data where possible, rather than relying only on recipe title text.

### Household dietary rule
A generic rule/constraint concept determines whether a family member can receive a recipe.

The first rule is:
- Recipes containing eggs are eligible for Siddhesh and Tejas.
- Recipes containing eggs are not eligible for Vikas and Namrata.

The architecture must permit future rules without creating separate code paths for each dietary constraint.

### Meal assignment
A meal calendar entry identifies the planned meal/date/slot, while assignments identify which members receive which recipe and how many portions are planned.

Conceptually:
- meal_entry_id
- member_id
- recipe_id
- portion_count / portion_factor
- assignment_source (`automatic`, `manual`, or equivalent)
- override metadata where applicable

The exact physical schema should preserve the current meal-entry compatibility while introducing member-level assignment data.

## Automatic alternate selection

When a recipe is ineligible for one or more members, the planner selects an existing suitable alternate recipe.

Ranking should prioritize:
1. Same meal role.
2. Similar dish/function.
3. Vegetarian compatibility.
4. Similar protein/nutrition role.
5. Same meal category.
6. Other suitable vegetarian fallback.

The engine should expose why an alternate was selected where practical.

If no suitable existing recipe exists:
- do not fabricate one;
- flag the meal as needing an alternate;
- allow a future content workflow to add an appropriate recipe.

## Day-level override

The automatic alternate is a default proposal for each meal.

The UI provides a clear action such as `Change for this day`.

A manual choice:
- applies only to that date/meal/member assignment;
- does not change the household default rule;
- is included in nutrition/balance calculations;
- is included in shopping aggregation;
- can be reverted to the automatic suggestion.

The mechanism is generic and is not named or implemented as an egg-only exception.

## Nutrition model

Phase 2 uses practical nutrition/meal-balance attributes rather than pretending to have precise nutrient calculations.

Initial concepts:
- protein
- fibre
- carbohydrates
- fat/fat quality
- oil
- vegetables
- fruits
- whole grains
- legumes/pulses
- main protein source

Calories are intentionally absent from Phase 2 calculations and UI metrics.

### Nutrition education
Each major nutrition concept has reusable bilingual content containing, where appropriate:
- What it is.
- Where it is used in the body.
- What it does.
- Why it matters in everyday meals.
- Useful food sources.

English and Marathi are stored/presented as paired content. Canonical identifiers remain language-neutral.

The content must use general public-health language and avoid diagnosis, treatment claims, or individualized medical prescriptions.

## Meal balance engine

The first balance engine is rule/indicator based, not a pseudo-precise numerical health score.

For a meal it can report indicators such as:
- protein source present
- vegetable component present
- pulse/legume present
- whole-grain component present
- fruit component present where relevant
- oil consideration

The UI should show the evidence behind a balance message instead of presenting an unexplained score.

Meal balance is evaluated against the actual recipe assignments for the relevant members.

## Shopping intelligence

Shopping is derived from actual planned meal assignments:

`Meal calendar → member assignments → portions → recipes → structured ingredients → canonical ingredient aggregation`

Example:
- Recipe A: 250 g onion
- Recipe B: 150 g onion
- Recipe C: 100 g onion

Aggregated result:
- Onion / कांदा: 500 g

The shopping layer must not maintain a second ingredient identity table.

Where unit conversion is not safely supported, the system should preserve separate unit buckets rather than silently producing an incorrect conversion.

## Existing-data migration

Existing recipes currently contain free-form ingredient arrays/text and existing nutrition strings. Phase 2 should migrate/enrich them incrementally.

Migration strategy:
1. Preserve existing recipe names, methods and display content.
2. Introduce canonical ingredient records.
3. Map known existing ingredients to canonical identities.
4. Add structured recipe-ingredient rows/data.
5. Add servings/category/role metadata.
6. Mark dietary characteristics from structured ingredients.
7. Populate practical nutrition metadata where trustworthy.
8. Keep unmapped legacy ingredient text visible until safely normalized.

No existing recipe should disappear merely because it is not yet fully normalized.

## UI design

### Recipe detail
Show:
- bilingual recipe name
- servings
- meal role/category
- structured ingredient list with quantities/units
- method
- practical nutrition indicators
- expandable nutrition explanations
- dietary/eligibility information where relevant

### Meal calendar
For meals requiring different recipes by member:
- show the primary recipe;
- show member assignments clearly;
- show the automatic alternate for excluded members;
- expose `Change for this day`;
- show a warning when no suitable alternate exists.

### Health / nutrition education
Extend the existing Health Guide with reusable nutrition concept cards/details. Do not duplicate explanatory copy inside every recipe.

### Shopping
Display aggregated canonical ingredients with bilingual names, quantities and categories. Shopping should reflect day-level alternate choices.

## Data integrity rules
- Canonical ingredient identity is unique within the global ingredient catalog.
- Recipe ingredient quantities must be non-negative and use supported canonical units.
- Recipe servings must be positive.
- Member assignments must reference household members belonging to the same household.
- Recipes referenced by a household meal assignment must belong to that household unless explicitly supported as shared content later.
- Day-level overrides must not mutate the household dietary rule.
- Shopping aggregation must operate from assignments, not from the original unmodified meal recipe when an override exists.

## Security
- Continue using Supabase RLS.
- Household-specific recipe, ingredient usage, meal assignment and shopping data must remain household-scoped.
- Global educational content may be authenticated-read where appropriate.
- Anonymous shared-household authentication remains unchanged.
- No service-role secret may enter browser code.

## Backward compatibility
- Existing 30-day/meal calendar behavior must continue to work.
- Existing recipe browsing/search must continue to work.
- Existing shopping and prep workflows must continue to work.
- Existing anonymous cloud initialization must continue to work.
- Existing health/settings/PWA functionality must continue to work.
- Existing local backup/import behavior must be extended carefully so new structured state is not lost.

## Testing strategy
Tests must cover:
1. Canonical ingredient identity and alias normalization.
2. Unit validation and unit aggregation behavior.
3. Recipe structured ingredient mapping.
4. Egg detection from canonical ingredients.
5. Automatic eligibility for Siddhesh/Tejas and ineligibility for Vikas/Namrata.
6. Existing-recipe alternate ranking.
7. No-alternate warning behavior.
8. Day-level override isolation.
9. Portion-aware meal assignments.
10. Nutrition education bilingual mapping/rendering.
11. Meal-balance indicators.
12. Shopping aggregation from actual assignments.
13. Shopping changes after a day-level alternate override.
14. Existing application regression tests.
15. Supabase RLS/migration contracts.

## Acceptance scenario
Given a four-person household and an egg-containing breakfast recipe:

- Siddhesh receives the egg recipe.
- Tejas receives the egg recipe.
- Vikas receives the best suitable existing vegetarian alternate.
- Namrata receives the same suitable alternate unless a future rule differentiates them.
- The planner shows the assignment transparently.
- The user can choose another existing vegetarian recipe with `Change for this day`.
- The alternate change affects only that date/meal.
- Nutrition/balance reflects each member's actual recipe assignment.
- Shopping contains eggs for two portions and the alternate ingredients for two portions.
- Canonically identical ingredients aggregate into one shopping item.
- No calories are displayed or calculated by Phase 2.

## Phase 3 compatibility
Phase 3 attaches a comprehensive food-composition database to canonical ingredient identities. The Phase 2 recipe/ingredient/assignment model should therefore remain stable while nutrient values become authoritative and calculations become more granular.

Target evolution:

`Recipe → Canonical Ingredient → Nutrition database → Recipe nutrition → Member portion nutrition`

This is an extension of Phase 2, not a replacement architecture.
