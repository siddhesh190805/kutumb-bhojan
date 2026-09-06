# Kutumb Bhojan Family Nutrition System Design

## Goal
Turn Kutumb Bhojan into the family's canonical, data-driven monthly nutrition planner. The app should plan breakfast, lunch, a light 5 PM snack, and dinner using exact foods and recipes; account for four family members' different ages/activity levels; integrate seasonal/local Nashik produce; generate shopping and batch-prep quantities; and keep nutrition content editable without hard-coding the planner in frontend code.

## Existing foundation
The current app already has a 30-day calendar, four meal slots, recipe lookup, Supabase anonymous household sync, health/settings content, PWA shell, and recipe coverage tests. The new work extends that foundation rather than creating a parallel planner or replacing existing sync behavior.

## Product decisions
- Four daily slots are canonical: Breakfast, Lunch, Snack (around 5 PM), Dinner.
- Exact named foods are required. Planner entries must not use generic labels such as "fruit" or "vegetable".
- Vegetarian household plan. Eggs and protein powder are optional allowed items; no other non-vegetarian foods.
- Weekdays favor quick recipes; longer/soaking/fermented recipes and batch cooking are scheduled primarily on weekends.
- Traditional foods remain first-class: khichdi, pithla, usal, bhakri, dashmi, idli, dosa, adai, thalipeeth, poha and similar regional foods.
- Recipe inspiration from reputable Indian recipe sources may be imported into the internal recipe library, but nutrient claims are normalized by the app's ingredient data rather than copied blindly from recipe pages/reels.
- Nutrition guidance follows general ICMR-NIN/public-health principles: dietary variety, multiple food groups, whole grains/millets, pulses/beans, nuts/seeds, vegetables, fruits and dairy; it is not a medical prescription.
- Tejas is 14 and must be treated as a growth/activity case, not an adult calorie-restriction case. Recurring fatigue/sickness is a health follow-up, not a reason to underfeed him.
- Vikas's reported post-dal skin reaction is stored only as a family-specific observation/constraint. The app must not diagnose it or declare all dal unsafe.
- Household oil planning is configurable and explicitly separate from a clinical limit.

## Architecture
Supabase remains canonical for shared household content/configuration; JavaScript remains generic reusable behavior/UI. Recipe, ingredient, nutrition, seasonal and calendar data must be stored as structured records, not as a growing hard-coded array in `app.js`.

Existing meal/recipe/shopping/prep tables and realtime behavior remain intact. The new nutrition layer should connect to those existing records through stable recipe/ingredient IDs and preserve backwards compatibility for current calendar entries.

### Core entities
1. `ingredients`: canonical food ingredients with English/Marathi names, food group, unit metadata, nutrient values per standard quantity, season tags, local-availability/practicality tags and substitution metadata.
2. `recipes`: bilingual recipe identity, meal-slot compatibility, servings, active/cook/total time, difficulty, weekday/weekend/batch classification, dietary tags, traditional/high-protein tags, family notes, storage notes and source attribution.
3. `recipe_ingredients`: exact ingredient quantity/unit plus optional preparation state, enabling nutrition and shopping calculations.
4. `nutrition_targets`: household-member reference targets/attributes where appropriate; growth-stage members must use age-appropriate references rather than adult weight-loss logic.
5. `seasonal_ingredients`: month/season availability for Nashik/Maharashtra, with local-practicality metadata rather than claiming exact harvest dates when evidence is uncertain.
6. `meal_plan`: date + slot + recipe/food composition, with optional serving multiplier per family member.
7. Existing shopping/prep structures are extended to consume structured recipe ingredients rather than maintaining a second manually-entered grocery system.

## Recipe library
Initial content should cover the approved family recipe set and then grow without frontend changes. Seed the first release with the already-developed practical recipes, including:
- moong-vegetable chilla; besan-vegetable chilla; moong-paneer chilla
- protein poha; protein upma; sprouts poha
- mixed-dal adai; idli + high-protein sambar; ragi dosa; pesarattu; vegetable uttapam
- moong khichdi; millet-moong khichdi
- matki usal; chana usal; mixed bean curry; chole; lobia curry; rajma rice; matki misal
- pithla 2.0 with suitable vegetable/peanut upgrades
- paneer bhurji; palak paneer; paneer vegetable curry/tikka; tofu bhurji/vegetable curry
- soy-paneer keema using minced/granulated soy to avoid the disliked soy-chunk texture
- methi dashmi; protein thalipeeth; handvo; bharli vangi
- chana/sprouted-moong chaat; curd-fruit-seed bowls; roasted chana/peanut snacks; optional egg chaat/egg bhurji
- peanut-flax-sesame-roasted-chana chutney/seed mix as a reusable component.

Every recipe must have exact ingredients and quantities, serving basis, preparation method, time class, storage/batch notes and bilingual naming. Recipes should be tagged as quick, normal, weekend, batch, egg-optional, protein-focused, traditional and/or seasonal where applicable.

## Meal-planning rules
Each meal is built from a protein anchor plus appropriate grain/starch, vegetables/fresh produce, and dairy/seed/nut components where suitable. The planner should avoid a cereal-heavy pattern and should rotate protein sources rather than repeating one pulse every day.

The monthly plan should:
- cover 30/31 days without generic placeholders;
- use exact fruits such as guava, banana, papaya, pomegranate, mosambi, apple, etc.;
- rotate vegetables using season/local availability;
- keep a light, quick 5 PM snack rather than allowing the family to arrive at dinner very hungry;
- vary grains: whole wheat, jowar, ragi and other practical millets where appropriate;
- schedule soaking/sprouting/fermentation-dependent foods around batch-prep capacity;
- provide family-specific serving adjustments rather than four separate menus;
- keep Tejas's portions growth/activity-aware and Siddhesh's portions adjustable for calisthenics days.

Recommended default timing is approximately 8:30–9:00 breakfast, 1:30–2:00 lunch, 5:00–5:30 snack and 8:00–8:30 dinner for adults/Siddhesh, with Tejas's breakfast/lunch shifted later when school requires it. The exact times remain household-configurable.

## Nutrition model
Use Indian Food Composition Tables / ICMR-NIN references as the baseline source for ingredient nutrient values. Store enough structured nutrition data to calculate at least protein, carbohydrate, fat, fibre and key micronutrient fields needed by the planner. Where exact nutrient data are unavailable, mark the value as unavailable rather than inventing precision.

The UI should show useful summaries rather than false precision: protein/fibre emphasis, food-group coverage and selected micronutrient highlights. Detailed nutrient values can be expanded later without changing the recipe model.

Seeds/nuts are used deliberately: flax/chia/walnuts for plant omega-3 contribution; sesame/ragi/dairy for calcium contribution; peanuts/other nuts/seeds for protein, magnesium and zinc contribution; fruit/vegetable pairings for vitamin C and carotenoid diversity. Dried fruit is treated as a small complementary food, not a protein substitute.

## Seasonal/local system
Use Nashik/Maharashtra availability data to tag ingredients by practical season. September planning should favor currently practical local produce such as gourds, okra, brinjal, cabbage, cauliflower, beans, carrot, cucumber, capsicum, tomato and coriander where available, while later months rotate in locally appropriate fruits/vegetables. The system must permit availability overrides because market availability varies.

## Shopping and batch prep
Recipe ingredient quantities are the single source for grocery calculations. Weekly shopping should aggregate quantities by ingredient and unit, deduplicate equivalent ingredients, and group them by category. Batch-prep should derive from recipe metadata: soaking pulses, sprouting matki/moong, preparing batter, roasting seed/nut mixes, cooking beans, chopping/storing suitable vegetables, preparing chutney and optional egg batches.

## UI
Add/extend:
- **Today**: current meal, snack and prep/shopping status plus a concise nutrition cue.
- **Calendar**: monthly 4-slot plan with exact foods, bilingual names, family serving controls and day/week navigation.
- **Recipes**: searchable/filterable library by meal slot, quick/weekend, traditional, protein-focused, seasonal and dietary tags; recipe detail with ingredients, method, nutrition and prep/storage.
- **Nutrition**: household member cards, food-group coverage, protein/fibre overview and non-clinical guidance.
- **Prep**: derived weekly batch-prep checklist.
- **Shopping**: derived weekly/monthly ingredient totals.
- **Health/Settings**: preserve the existing hybrid Health Guide, household oil planning and theme/PWA controls.

## Data flow
`Ingredients + Nutrition + Seasonality → Recipes → Meal Plan → Family Portions → Shopping + Prep + Nutrition Summary`.

No second copy of recipe ingredients should exist in shopping or prep. No second meal planner should coexist with the current calendar. Existing hard-coded calendar/recipe data should be migrated into the canonical tables and retained only as a controlled fallback/migration source if needed.

## Safety and health boundaries
- No diagnosis, treatment recommendation or medical prescription in the app.
- Family observations are labeled as observations, not diagnoses.
- Do not automatically exclude all dals because of one person's reported reaction; support per-person notes/exclusions and clinician follow-up.
- Do not use adult calorie restriction for the 14-year-old.
- Keep food safety/storage instructions practical and conservative.

## Testing and migration
Tests must cover schema/data contracts, recipe ingredient calculations, bilingual recipe coverage, exact calendar-to-recipe resolution, season filtering, serving aggregation, shopping/prep aggregation, health-setting compatibility and preservation of existing sync/realtime behavior. Migration must be idempotent and preserve existing meal/recipe records.

## Success criteria
1. The complete monthly family plan is represented in Supabase-backed structured data, not an expanding frontend array.
2. Every calendar meal resolves to an exact bilingual recipe/food record with ingredients and quantities.
3. 5 PM snacks are present and quick/light.
4. Shopping and prep quantities are derived from recipe ingredients.
5. Recipes can be added/edited without changing frontend code.
6. Seasonal/local tags influence planning without making brittle availability claims.
7. Family-specific serving adjustments and constraints work without duplicating menus.
8. Existing health, settings, anonymous auth, PWA, meals, recipes, shopping, prep and realtime behavior remain functional.
9. Automated tests verify the new data contracts and aggregation behavior.
10. The system is extensible to a substantially larger recipe library without architectural duplication.
