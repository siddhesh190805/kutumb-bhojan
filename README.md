# Kutumb Bhojan / कुटुंब भोजन

A mobile-first family nutrition and meal-planning web app built from the family's Notion system.

## Included
- 30 days × 4 meal slots (Sep 7–Oct 6, 2026)
- Family recipes, shopping and prep with shared Supabase sync
- Marathi + English UI
- Hybrid Health Guide: dashboard tips + full bilingual guidance
- Configurable household oil planning (stock + monthly target)
- Light / Dark / System theme
- Installable PWA with an offline application shell
- Local persistence and JSON backup/import
- Supabase anonymous family sessions — no email, password or OTP UI

## Run locally
Because this is a static app, no build step is required. Serve the folder with any static HTTP server, for example:

`python -m http.server 4173`

Then open `http://localhost:4173`.

## Cloud and content model
Supabase is the canonical shared data store. Meals, recipes, family members, shopping, prep, household settings and health content are read from the database when online. LocalStorage is used as a device cache/offline fallback and for device-specific theme preference.

Health content lives in `health_tips` and `health_targets`, so adding or editing a tip in Supabase does not require changing frontend JavaScript. Household planning values such as oil stock and monthly target live in `household_settings`.

If setting up Supabase from scratch, enable **Authentication → Sign In / Providers → Anonymous Sign-Ins** and apply the migrations under `supabase/migrations/`.

## Health guidance
The Health Guide is general public-health information, not medical advice or a prescription. Numeric references are stored with their source and context. The household oil target is deliberately configurable and is a planning tool, not a universal clinical limit.

## Hosting
Designed for Vercel Hobby personal/non-commercial use. Free hosting is not represented as a contractual forever guarantee; Vercel's current terms allow it to change or discontinue Hobby.

## Phase 2 — Recipe, nutrition, meal balance and shopping

Phase 2 extends the existing app with a canonical, language-neutral ingredient identity. Recipe ingredients can be represented as structured quantity/unit lines while the original legacy ingredient text remains available whenever normalization is uncertain. Supported units are `g`, `kg`, `ml`, `L`, `piece`, `tsp`, `tbsp`, and `cup`; only safe mass-to-mass and volume-to-volume conversions are performed.

Meal entries now support member-level assignments and explicit portion factors. The household rule for egg-containing recipes is deterministic: Siddhesh and Tejas are eligible; Vikas and Namrata receive an existing suitable vegetarian alternate when one is available. Alternate selection is ranked by meal role, dish/function similarity, vegetarian compatibility, nutrition role, and meal category. If no suitable existing alternate exists, the app shows that state rather than inventing a recipe. `Change for this day` creates a reversible assignment-only override and does not change the household rule.

Shopping quantities are derived from actual member assignments and canonical ingredients. Safe compatible units are aggregated; unsafe conversions remain separate. Manual shopping items remain distinct from generated meal-plan items.

Nutrition education is reusable and bilingual (English + Marathi) and covers practical concepts such as protein, fibre, carbohydrates, fat quality, vegetables, fruits, whole grains and legumes. Meal balance uses evidence indicators rather than a pseudo-precise health score. Phase 2 deliberately does not calculate or display calories as a nutrition metric; a full food-composition/calorie layer is deferred to Phase 3.
