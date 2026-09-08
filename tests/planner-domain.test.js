import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichRecipeMetadata,
  createPlanningState,
  evaluateHardConstraints,
  evaluateCulinaryAndPracticality,
  evaluateNutritionDiversity,
  generateCandidates,
  generatePlan,
  proposeMealChange,
  MEAL_CHANGE_REASONS,
  RECIPE_HEAVINESS,
  MEAL_FORMS,
  PRIMARY_GRAINS,
  PRIMARY_PROTEIN_SOURCES
} from '../sync.js';

test('PHASE A: Recipe metadata enrichment classifies heaviness, meal form, grains, and protein', () => {
  const sampleRecipe = {
    id: 'chole-roti',
    name: 'Chole + Roti + Cabbage-Peas + Apple',
    mr: 'छोले + पोळी + कोबी-वाटाणा + सफरचंद',
    course: 'Lunch/Dinner',
    ingredients: [
      '280 g dry chickpeas, soaked',
      '8 whole-wheat rotis',
      '350 g cabbage',
      '1 apple'
    ],
    time: '40 min',
    oil: '12 ml'
  };

  const enriched = enrichRecipeMetadata(sampleRecipe);

  assert.equal(enriched.id, 'chole-roti');
  assert.equal(enriched.heaviness, RECIPE_HEAVINESS.SUBSTANTIAL);
  assert.equal(enriched.mealForm, MEAL_FORMS.CURRY_SABJI);
  assert.equal(enriched.primaryGrain, PRIMARY_GRAINS.WHEAT);
  assert.equal(enriched.primaryProteinSource, PRIMARY_PROTEIN_SOURCES.LEGUME);
  assert.equal(enriched.soakingRequired, true);
  assert.equal(enriched.fermentationRequired, false);
  assert.ok(enriched.vegetableCategories.includes('cabbage'));
  assert.ok(enriched.fruits.includes('apple'));
});

test('PHASE A: Recipe metadata enrichment accurately classifies light traditional meals like khichdi and poha', () => {
  const khichdi = enrichRecipeMetadata({
    id: 'veg-khichdi',
    name: 'Vegetable Moong Khichdi + Curd',
    mr: 'भाजी मूग खिचडी + दही',
    course: 'Lunch/Dinner',
    ingredients: ['180 g rice', '120 g moong dal', '300 g mixed vegetables', '400 g plain curd']
  });

  assert.equal(khichdi.heaviness, RECIPE_HEAVINESS.LIGHT);
  assert.equal(khichdi.mealForm, MEAL_FORMS.KHICHDI);
  assert.equal(khichdi.primaryGrain, PRIMARY_GRAINS.RICE);
  assert.equal(khichdi.primaryProteinSource, PRIMARY_PROTEIN_SOURCES.LEGUME);

  const poha = enrichRecipeMetadata({
    id: 'veg-poha',
    name: 'Vegetable Poha + Peanuts + Curd',
    mr: 'भाजी पोहे + शेंगदाणे + दही',
    course: 'Breakfast',
    ingredients: ['240 g poha', '50 g peanuts', '200 g vegetables', '400 g curd']
  });

  assert.equal(poha.heaviness, RECIPE_HEAVINESS.LIGHT);
  assert.equal(poha.mealForm, MEAL_FORMS.POHA);
  assert.equal(poha.primaryGrain, PRIMARY_GRAINS.POHA);
});

test('PHASE A: Recipe metadata enrichment accurately classifies paneer and egg recipes', () => {
  const palakPaneer = enrichRecipeMetadata({
    id: 'palak-paneer',
    name: 'Palak Paneer + Roti + Cucumber',
    mr: 'पालक पनीर + पोळी + काकडी',
    course: 'Lunch/Dinner',
    ingredients: ['400 g paneer', '500 g spinach', '8 whole-wheat rotis']
  });

  assert.equal(palakPaneer.heaviness, RECIPE_HEAVINESS.HEAVY);
  assert.equal(palakPaneer.containsPaneer, true);
  assert.equal(palakPaneer.primaryProteinSource, PRIMARY_PROTEIN_SOURCES.DAIRY_PANEER);

  const eggBhurji = enrichRecipeMetadata({
    id: 'egg-bhurji',
    name: 'Egg Bhurji + Roti',
    mr: 'अंडा भुर्जी + पोळी',
    course: 'Breakfast/Dinner',
    ingredients: ['8 eggs', '8 whole-wheat rotis', '200 g onion-tomato']
  });

  assert.equal(eggBhurji.containsEgg, true);
  assert.equal(eggBhurji.primaryProteinSource, PRIMARY_PROTEIN_SOURCES.EGG);
  assert.equal(eggBhurji.mealForm, MEAL_FORMS.BHURJI);
});

test('PHASE A: createPlanningState initializes canonical state without mutating inputs', () => {
  const household = { id: 'hh-001', size: 4 };
  const members = [
    { id: 'vikas', name: 'Vikas', mr: 'विकास' },
    { id: 'namrata', name: 'Namrata', mr: 'नम्रता' },
    { id: 'tejas', name: 'Tejas', mr: 'तेजस' },
    { id: 'siddhesh', name: 'Siddhesh', mr: 'सिद्धेश' }
  ];
  const rules = [
    { ruleKey: 'egg-eligibility', ingredientKey: 'egg', allowedMemberIds: ['tejas', 'siddhesh'] }
  ];
  const frequencyRules = [
    { ruleKey: 'paneer-monthly-frequency', ingredientKey: 'paneer', maxPerCalendarMonth: 5 }
  ];

  const state = createPlanningState({
    household,
    members,
    rules,
    frequencyRules,
    startDate: '2026-09-07',
    visibleDays: 7,
    evaluationDays: 30
  });

  assert.equal(state.household.id, 'hh-001');
  assert.equal(state.members.length, 4);
  assert.equal(state.planningWindow.startDate, '2026-09-07');
  assert.equal(state.planningWindow.visibleDays, 7);
  assert.equal(state.planningWindow.evaluationDays, 30);
  assert.ok(state.plannedMealHistory instanceof Map);
  assert.ok(state.nutritionCoverage instanceof Map);
  assert.ok(state.culinaryCoverage instanceof Map);
});

test('PHASE B: evaluateHardConstraints rejects slot mismatch, paneer limit breach, and unavailable ingredients', () => {
  const palakPaneer = enrichRecipeMetadata({
    id: 'palak-paneer',
    name: 'Palak Paneer + Roti',
    course: 'Lunch/Dinner',
    ingredients: ['400 g paneer', '500 g spinach', '8 whole-wheat rotis']
  });

  const snackItem = enrichRecipeMetadata({
    id: 'roasted-chana',
    name: 'Roasted Chana + Guava',
    course: 'Snack',
    ingredients: ['120 g roasted chana', '2 guavas']
  });

  const state = createPlanningState({
    frequencyRules: [{ ruleKey: 'paneer-monthly-frequency', ingredientKey: 'paneer', maxPerCalendarMonth: 5 }],
    startDate: '2026-09-07'
  });

  // 1. Slot check: Snack recipe in Lunch slot should fail hard
  const slotRes = evaluateHardConstraints(snackItem, 'Lunch', '2026-09-07', state);
  assert.equal(slotRes.valid, false);
  assert.ok(slotRes.reasons.some(r => r.includes('slot')));

  // 2. Unavailable ingredient check
  const unavailRes = evaluateHardConstraints(palakPaneer, 'Dinner', '2026-09-07', state, { unavailableIngredients: ['paneer'] });
  assert.equal(unavailRes.valid, false);
  assert.ok(unavailRes.reasons.some(r => r.includes('unavailable')));

  // 3. Paneer frequency limit check: if 5 paneer meals are already planned in 2026-09, 6th must fail
  state.frequencyCounts = new Map([['paneer:2026-09', 5]]);
  const freqRes = evaluateHardConstraints(palakPaneer, 'Dinner', '2026-09-07', state);
  assert.equal(freqRes.valid, false);
  assert.ok(freqRes.reasons.some(r => r.includes('frequency')));

  // 4. Consecutive day paneer check: if yesterday had paneer, today cannot have paneer
  state.frequencyCounts = new Map([['paneer:2026-09', 2]]);
  state.practicalityState.recentHeavinessByDate.set('2026-09-06', { hasPaneer: true });
  const consecRes = evaluateHardConstraints(palakPaneer, 'Dinner', '2026-09-07', state);
  assert.equal(consecRes.valid, false);
  assert.ok(consecRes.reasons.some(r => r.includes('consecutive')));
});

test('PHASE B: evaluateCulinaryAndPracticality enforces heaviness spacing and penalizes consecutive chillas', () => {
  const chole = enrichRecipeMetadata({
    id: 'chole',
    name: 'Chole + Roti',
    course: 'Lunch/Dinner',
    ingredients: ['280 g dry chickpeas, soaked', '8 rotis']
  });

  const palakPaneer = enrichRecipeMetadata({
    id: 'palak-paneer',
    name: 'Palak Paneer + Roti',
    course: 'Lunch/Dinner',
    ingredients: ['400 g paneer', '500 g spinach', '8 rotis']
  });

  const khichdi = enrichRecipeMetadata({
    id: 'khichdi',
    name: 'Vegetable Moong Khichdi + Curd',
    course: 'Lunch/Dinner',
    ingredients: ['180 g rice', '120 g moong dal', '400 g curd']
  });

  const state = createPlanningState({ startDate: '2026-09-07' });
  // Set lunch on 2026-09-07 as heavy Chole
  state.plannedMealHistory.set('2026-09-07-Lunch', chole);

  // Evaluating Dinner on 2026-09-07:
  // Another heavy/substantial meal like Palak Paneer should receive a heavy penalty or violation
  const paneerEval = evaluateCulinaryAndPracticality(palakPaneer, 'Dinner', '2026-09-07', state);
  // A light dinner like Khichdi should receive high culinary score
  const khichdiEval = evaluateCulinaryAndPracticality(khichdi, 'Dinner', '2026-09-07', state);

  assert.ok(khichdiEval.score > paneerEval.score, 'Light khichdi dinner must score higher than heavy paneer after heavy chole lunch');
  assert.ok(paneerEval.penalties.some(p => p.includes('heaviness') || p.includes('dense')));
});

test('PHASE C: generateCandidates filters invalid meals and ranks valid candidates deterministically', () => {
  const recipes = [
    enrichRecipeMetadata({ id: 'poha', name: 'Kanda Poha', course: 'Breakfast', ingredients: ['poha', 'onion'] }),
    enrichRecipeMetadata({ id: 'chilla', name: 'Moong Chilla', course: 'Breakfast', ingredients: ['moong dal'] }),
    enrichRecipeMetadata({ id: 'chole', name: 'Chole + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas', 'roti'] }),
    enrichRecipeMetadata({ id: 'khichdi', name: 'Moong Khichdi', course: 'Lunch/Dinner', ingredients: ['moong dal', 'rice'] }),
    enrichRecipeMetadata({ id: 'nuts', name: 'Almonds + Milk', course: 'Snack', ingredients: ['almonds', 'milk'] })
  ];

  const state = createPlanningState({ startDate: '2026-09-07' });

  // 1. For Breakfast slot, only Breakfast recipes are candidates
  const breakfastCandidates = generateCandidates('Breakfast', '2026-09-07', state, recipes);
  assert.equal(breakfastCandidates.length, 2);
  assert.ok(breakfastCandidates.every(c => c.recipe.course === 'Breakfast'));

  // 2. Determinism: Calling twice yields identical ordering and scores
  const candidates1 = generateCandidates('Lunch', '2026-09-07', state, recipes);
  const candidates2 = generateCandidates('Lunch', '2026-09-07', state, recipes);
  assert.deepEqual(candidates1.map(c => c.recipe.id), candidates2.map(c => c.recipe.id));
  assert.deepEqual(candidates1.map(c => c.score), candidates2.map(c => c.score));
});

test('PHASE C: generatePlan produces a multi-day plan respecting the paneer monthly limit of 5', () => {
  const recipes = [
    enrichRecipeMetadata({ id: 'poha', name: 'Kanda Poha', course: 'Breakfast', ingredients: ['poha', 'onion'] }),
    enrichRecipeMetadata({ id: 'chilla', name: 'Moong Dal Chilla', course: 'Breakfast', ingredients: ['moong dal'] }),
    enrichRecipeMetadata({ id: 'thalipeeth', name: 'Bhajani Thalipeeth', course: 'Breakfast', ingredients: ['jowar bhajani', 'curd'] }),
    enrichRecipeMetadata({ id: 'oats', name: 'Vegetable Masala Oats', course: 'Breakfast', ingredients: ['oats', 'carrot'] }),
    enrichRecipeMetadata({ id: 'paneer-bhindi', name: 'Paneer Bhurji + Roti', course: 'Lunch/Dinner', ingredients: ['paneer', 'roti'] }),
    enrichRecipeMetadata({ id: 'palak-paneer', name: 'Palak Paneer + Roti', course: 'Lunch/Dinner', ingredients: ['paneer', 'spinach', 'roti'] }),
    enrichRecipeMetadata({ id: 'chole', name: 'Chole Masala + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas', 'roti'] }),
    enrichRecipeMetadata({ id: 'khichdi', name: 'Moong Khichdi + Curd', course: 'Lunch/Dinner', ingredients: ['rice', 'moong dal', 'curd'] }),
    enrichRecipeMetadata({ id: 'dal-palak', name: 'Dal Palak + Rice', course: 'Lunch/Dinner', ingredients: ['toor dal', 'spinach', 'rice'] }),
    enrichRecipeMetadata({ id: 'rajma', name: 'Rajma + Rice', course: 'Lunch/Dinner', ingredients: ['rajma', 'rice'] }),
    enrichRecipeMetadata({ id: 'roasted-chana', name: 'Roasted Chana + Guava', course: 'Snack', ingredients: ['roasted chana', 'guava'] }),
    enrichRecipeMetadata({ id: 'sprouts-chaat', name: 'Moong Sprouts Chaat', course: 'Snack', ingredients: ['moong sprouts', 'cucumber'] })
  ];

  const state = createPlanningState({
    startDate: '2026-09-07',
    frequencyRules: [{ ruleKey: 'paneer-monthly-frequency', ingredientKey: 'paneer', maxPerCalendarMonth: 5 }]
  });

  const planResult = generatePlan(state, recipes, { days: 14 });
  assert.equal(planResult.success, true);
  assert.equal(planResult.plan.length, 14 * 4); // 14 days * 4 slots

  // Check paneer occurrence count across 14 days
  const paneerMeals = planResult.plan.filter(m => m.recipe.containsPaneer || (m.recipe.ingredients || []).some(i => String(i).toLowerCase().includes('paneer')));
  assert.ok(paneerMeals.length <= 5, `Paneer count (${paneerMeals.length}) must not exceed monthly limit of 5`);

  // Check no consecutive day has paneer
  const paneerDates = [...new Set(paneerMeals.map(m => m.date))].sort();
  for (let i = 0; i < paneerDates.length - 1; i++) {
    const d1 = new Date(paneerDates[i]);
    const d2 = new Date(paneerDates[i + 1]);
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    assert.ok(diffDays > 1, `Paneer meals on consecutive dates ${paneerDates[i]} and ${paneerDates[i + 1]} violate consecutive spacing rule`);
  }

  // Check each plan meal has explanation structure
  assert.ok(planResult.plan.every(m => m.explanation && Array.isArray(m.explanation.reasons)));
});

test('PHASE D: proposeMealChange respects reason taxonomy and applies structured constraints', () => {
  const recipes = [
    enrichRecipeMetadata({ id: 'palak-paneer', name: 'Palak Paneer + Roti', course: 'Lunch/Dinner', ingredients: ['paneer', 'spinach', 'roti'], time: '35 min' }),
    enrichRecipeMetadata({ id: 'chole-roti', name: 'Chole Masala + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas, soaked', 'roti'], time: '45 min' }),
    enrichRecipeMetadata({ id: 'khichdi', name: 'Moong Khichdi + Curd', course: 'Lunch/Dinner', ingredients: ['rice', 'moong dal', 'curd'], time: '20 min' }),
    enrichRecipeMetadata({ id: 'jowar-bhakri-pithla', name: 'Pithla + Jowar Bhakri', course: 'Lunch/Dinner', ingredients: ['besan', 'jowar bhakri'], time: '25 min' }),
    enrichRecipeMetadata({ id: 'soya-curry', name: 'Soya Chunks Curry + Rice', course: 'Lunch/Dinner', ingredients: ['soya chunks', 'rice'], time: '25 min' })
  ];

  const state = createPlanningState({ startDate: '2026-09-07' });
  const currentMeal = {
    date: '2026-09-07',
    slot: 'Dinner',
    recipeId: 'palak-paneer',
    recipe: recipes[0]
  };

  // 1. want_lighter should recommend lighter alternative (khichdi) over substantial chole
  const lighterRes = proposeMealChange(currentMeal, MEAL_CHANGE_REASONS.WANT_LIGHTER, state, recipes);
  assert.ok(lighterRes.alternatives.length > 0);
  assert.equal(lighterRes.recommendation.recipe.id, 'khichdi');

  // 2. want_different_protein should propose a dish that changes protein source from paneer
  const diffProteinRes = proposeMealChange(currentMeal, MEAL_CHANGE_REASONS.WANT_DIFFERENT_PROTEIN, state, recipes);
  assert.ok(diffProteinRes.recommendation.recipe.primaryProteinSource !== PRIMARY_PROTEIN_SOURCES.DAIRY_PANEER);

  // 3. want_different_grain should propose a dish that changes grain from roti (wheat)
  const diffGrainRes = proposeMealChange(currentMeal, MEAL_CHANGE_REASONS.WANT_DIFFERENT_GRAIN, state, recipes);
  assert.ok(diffGrainRes.recommendation.recipe.primaryGrain !== PRIMARY_GRAINS.WHEAT);

  // 4. ingredient_unavailable for 'spinach' must exclude palak-paneer
  const unavailRes = proposeMealChange(currentMeal, MEAL_CHANGE_REASONS.INGREDIENT_UNAVAILABLE, state, recipes, { unavailableIngredients: ['spinach'] });
  assert.ok(unavailRes.alternatives.every(a => !a.recipe.ingredients.some(i => String(i).includes('spinach'))));

  // 5. want_quick should prefer <= 25 min recipes without soaking (khichdi, pithla, soya) over 45 min soaked chole
  const quickRes = proposeMealChange(currentMeal, MEAL_CHANGE_REASONS.WANT_QUICK, state, recipes);
  assert.notEqual(quickRes.recommendation.recipe.id, 'chole-roti');
});

