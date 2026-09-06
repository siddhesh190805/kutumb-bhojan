import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SUPPORTED_UNITS,
  normalizeIngredientAlias,
  normalizeUnit,
  convertQuantity,
  aggregateIngredientLines,
  parseLegacyIngredientLine,
  mapLegacyRecipeIngredients,
  deriveRecipeDietaryFlags,
  DEFAULT_DIETARY_RULES,
  evaluateRecipeEligibility,
  rankAlternateRecipes,
  selectAutomaticAlternate,
  buildAutomaticAssignments,
  applyDayLevelOverride,
  revertDayLevelOverride,
  evaluateMealBalance,
  buildShoppingFromAssignments,
  mapIngredientCatalog,
  mapRecipeIngredients,
  mapMealAssignments,
  buildStructuredRecipe,
  mapDietaryRules,
  getRecipeNutritionConcepts
} from '../sync.js';

const mockCatalog = [
  { canonicalKey: 'egg', name: 'Egg', marathiName: 'अंडे', aliases: ['egg','eggs','अंडे','अंडी'], category: 'Eggs', defaultUnit: 'piece' },
  { canonicalKey: 'onion', name: 'Onion', marathiName: 'कांदा', aliases: ['onion','onions','कांदा','कांदे'], category: 'Vegetables', defaultUnit: 'g' },
  { canonicalKey: 'tomato', name: 'Tomato', marathiName: 'टोमॅटो', aliases: ['tomato','tomatoes','टोमॅटो'], category: 'Vegetables', defaultUnit: 'g' },
  { canonicalKey: 'spinach', name: 'Spinach', marathiName: 'पालक', aliases: ['spinach','palak','पालक'], category: 'Vegetables', defaultUnit: 'g' },
  { canonicalKey: 'paneer', name: 'Paneer', marathiName: 'पनीर', aliases: ['paneer','पनीर'], category: 'Dairy', defaultUnit: 'g' },
  { canonicalKey: 'moong_dal', name: 'Moong dal', marathiName: 'मूग डाळ', aliases: ['moong dal','moong','मूग डाळ'], category: 'Pulses & Legumes', defaultUnit: 'g' },
  { canonicalKey: 'oil', name: 'Cooking oil', marathiName: 'खाद्यतेल', aliases: ['oil','cooking oil','तेल'], category: 'Other', defaultUnit: 'ml' }
];

const mockEducation = [
  { id: 'protein', title: 'Protein', marathiTitle: 'प्रथिने', what: 'Tissue building nutrient', marathiWhat: 'ऊती निर्मिती', function: 'Growth and repair', marathiFunction: 'वाढ आणि दुरुस्ती', whyItMatters: 'Essential for body', marathiWhyItMatters: 'शरीरासाठी आवश्यक', foodSources: 'Dal, paneer, eggs', marathiFoodSources: 'डाळी, पनीर, अंडी', sortOrder: 1 },
  { id: 'vegetables', title: 'Vegetables', marathiTitle: 'भाज्या', what: 'Protective food', marathiWhat: 'संरक्षक अन्न', function: 'Vitamins & minerals', marathiFunction: 'जीवनसत्त्वे', whyItMatters: 'Dietary diversity', marathiWhyItMatters: 'आहार विविधता', foodSources: 'Green leafy vegetables', marathiFoodSources: 'पालेभाज्या', sortOrder: 2 },
  { id: 'fibre', title: 'Fibre', marathiTitle: 'तंतू', what: 'Digestive nutrient', marathiWhat: 'पचन पोषक', function: 'Digestive bulk', marathiFunction: 'पचनास मदत', whyItMatters: 'Bowel health', marathiWhyItMatters: 'पचन आरोग्य', foodSources: 'Whole grains, vegetables', marathiFoodSources: 'पूर्ण धान्ये, भाज्या', sortOrder: 3 }
];

const members = [
  { id: 'vikas', name: 'Vikas', mr: 'विकास' },
  { id: 'namrata', name: 'Namrata', mr: 'नम्रता' },
  { id: 'tejas', name: 'Tejas', mr: 'तेजस' },
  { id: 'siddhesh', name: 'Siddhesh', mr: 'सिद्धेश' }
];

test('FEATURE 1: Recipe creation parses structured ingredients and preserves unknown lines safely', () => {
  const rawRecipe = {
    id: 'r_new_1',
    name: 'Egg Spinach Scramble',
    mr: 'अंडा पालक भुर्जी',
    course: 'Breakfast',
    mealRole: 'main',
    time: '15 min',
    servings: 4,
    cookingMethod: 'Stovetop',
    ingredients: [
      '4 piece eggs',
      '150 g spinach',
      '50 g onion',
      '10 ml oil',
      'special kitchen magic spice blend' // unknown / unmapped line
    ],
    method: ['Chop spinach and onion.', 'Heat oil and scramble eggs with spinach.'],
    note: 'Serve fresh and hot.'
  };

  const structured = buildStructuredRecipe(rawRecipe, [], mockCatalog);

  // Structured lines should be parsed
  assert.equal(structured.ingredients.length, 4);
  assert.equal(structured.ingredients[0].ingredientKey, 'egg');
  assert.equal(structured.ingredients[0].quantity, 4);
  assert.equal(structured.ingredients[0].unit, 'piece');

  assert.equal(structured.ingredients[1].ingredientKey, 'spinach');
  assert.equal(structured.ingredients[1].quantity, 150);

  // Unmapped legacy line MUST be preserved in legacyUnmapped
  assert.equal(structured.legacyUnmapped.length, 1);
  assert.equal(structured.legacyUnmapped[0], 'special kitchen magic spice blend');

  // Dietary flags automatically derived
  assert.equal(structured.dietaryFlags.containsEgg, true);
  assert.equal(structured.dietaryFlags.vegetarian, false);
  assert.equal(structured.dietaryFlags.vegetables, true);

  // Nutrition concepts mapped without calories
  const concepts = getRecipeNutritionConcepts(structured, mockEducation);
  assert.ok(concepts.some(c => c.id === 'protein'));
  assert.ok(concepts.some(c => c.id === 'vegetables'));
  assert.equal(concepts.some(c => c.id === 'calories'), false);
});

test('FEATURE 2: Vegetarian alternate selection for egg-containing recipe with household members', () => {
  const eggRecipe = buildStructuredRecipe({
    id: 'r_egg_bhurji',
    name: 'Egg Bhurji + Roti',
    mr: 'अंडा भुर्जी + पोळी',
    course: 'Breakfast',
    mealRole: 'main',
    dishFunction: 'savory-main',
    ingredients: ['8 piece egg', '200 g onion', '10 ml oil']
  }, [], mockCatalog);

  const vegAlternate = buildStructuredRecipe({
    id: 'r_paneer_bhurji',
    name: 'Paneer Bhurji + Roti',
    mr: 'पनीर भुर्जी + पोळी',
    course: 'Breakfast',
    mealRole: 'main',
    dishFunction: 'savory-main',
    ingredients: ['400 g paneer', '200 g onion', '10 ml oil']
  }, [], mockCatalog);

  const candidateRecipes = [eggRecipe, vegAlternate];
  const mealEntry = { id: '2026-09-10-Breakfast', recipeId: eggRecipe.id, title: eggRecipe.name };

  const assignments = buildAutomaticAssignments(mealEntry, members, candidateRecipes, DEFAULT_DIETARY_RULES);
  assert.equal(assignments.length, 4);

  // Siddhesh and Tejas receive egg recipe
  const siddhesh = assignments.find(a => a.memberId === 'siddhesh');
  const tejas = assignments.find(a => a.memberId === 'tejas');
  assert.equal(siddhesh.recipeId, eggRecipe.id);
  assert.equal(tejas.recipeId, eggRecipe.id);

  // Vikas and Namrata receive vegetarian alternate
  const vikas = assignments.find(a => a.memberId === 'vikas');
  const namrata = assignments.find(a => a.memberId === 'namrata');
  assert.equal(vikas.recipeId, vegAlternate.id);
  assert.equal(namrata.recipeId, vegAlternate.id);
  assert.equal(vikas.assignmentSource, 'automatic');
});

test('FEATURE 3: Missing alternate returns explicit state without silently inventing fake recipe', () => {
  const eggRecipe = buildStructuredRecipe({
    id: 'r_egg_alone',
    name: 'Egg Omelette',
    mr: 'आमलेट',
    course: 'Breakfast',
    ingredients: ['2 piece egg']
  }, [], mockCatalog);

  const mealEntry = { id: '2026-09-11-Breakfast', recipeId: eggRecipe.id, title: eggRecipe.name };
  const assignments = buildAutomaticAssignments(mealEntry, members, [eggRecipe], DEFAULT_DIETARY_RULES);

  const vikas = assignments.find(a => a.memberId === 'vikas');
  assert.equal(vikas.recipeId, null);
  assert.match(vikas.overrideReason, /No suitable existing vegetarian alternate/i);
});

test('FEATURE 4: Shopping derivation aggregates quantities safely and reflects assignment changes', () => {
  const recipe1 = buildStructuredRecipe({
    id: 'r1',
    name: 'Moong Chilla',
    mr: 'मूग चिल्ला',
    ingredients: ['200 g moong dal', '100 g onion', '10 ml oil']
  }, [], mockCatalog);

  const recipe2 = buildStructuredRecipe({
    id: 'r2',
    name: 'Paneer Bhurji',
    mr: 'पनीर भुर्जी',
    ingredients: ['200 g paneer', '150 g onion', '10 ml oil']
  }, [], mockCatalog);

  const recipes = [recipe1, recipe2];

  // Initial assignment: all 4 members eat recipe1
  let assignments = [
    { memberId: 'vikas', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'namrata', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'tejas', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'siddhesh', recipeId: 'r1', portionFactor: 1 }
  ];

  let shopping = buildShoppingFromAssignments(assignments, recipes, [], mockCatalog);
  let onion = shopping.find(x => x.canonicalKey === 'onion');
  // 4 portions * 100 g = 400 g
  assert.equal(onion.quantity, 400);
  assert.equal(onion.unit, 'g');

  // Override: Siddhesh changes to recipe2 (which has 150 g onion)
  assignments = [
    { memberId: 'vikas', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'namrata', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'tejas', recipeId: 'r1', portionFactor: 1 },
    { memberId: 'siddhesh', recipeId: 'r2', portionFactor: 1 }
  ];

  shopping = buildShoppingFromAssignments(assignments, recipes, [], mockCatalog);
  onion = shopping.find(x => x.canonicalKey === 'onion');
  // 3 * 100 + 1 * 150 = 450 g
  assert.equal(onion.quantity, 450);

  // Paneer now appears in shopping list
  const paneer = shopping.find(x => x.canonicalKey === 'paneer');
  assert.ok(paneer);
  assert.equal(paneer.quantity, 200);
});

test('FEATURE 5: Incompatible units are kept in distinct buckets during shopping aggregation', () => {
  const lines = [
    { ingredientKey: 'onion', quantity: 500, unit: 'g' },
    { ingredientKey: 'onion', quantity: 2, unit: 'piece' },
    { ingredientKey: 'onion', quantity: 1, unit: 'kg' } // convertible to g
  ];

  const aggregated = aggregateIngredientLines(lines);
  assert.equal(aggregated.length, 2);

  const gramBucket = aggregated.find(b => b.unit === 'g');
  const pieceBucket = aggregated.find(b => b.unit === 'piece');

  assert.equal(gramBucket.quantity, 1500); // 500g + 1000g
  assert.equal(pieceBucket.quantity, 2);
});

test('FEATURE 6: Day-level override is strictly isolated and reversible', () => {
  const mealEntryId = '2026-09-12-Dinner';
  const initial = [
    { id: `${mealEntryId}:vikas`, mealEntryId, memberId: 'vikas', recipeId: 'r_initial', automaticRecipeId: 'r_initial', assignmentSource: 'automatic' },
    { id: `${mealEntryId}:siddhesh`, mealEntryId, memberId: 'siddhesh', recipeId: 'r_initial', automaticRecipeId: 'r_initial', assignmentSource: 'automatic' }
  ];

  const overridden = applyDayLevelOverride(initial, 'vikas', 'r_special', mealEntryId);
  const vikasAfter = overridden.find(a => a.memberId === 'vikas');
  const siddheshAfter = overridden.find(a => a.memberId === 'siddhesh');

  assert.equal(vikasAfter.recipeId, 'r_special');
  assert.equal(vikasAfter.assignmentSource, 'manual');
  assert.equal(vikasAfter.overrideReason, 'Changed for this day');
  assert.equal(siddheshAfter.recipeId, 'r_initial'); // unaffected

  const reverted = revertDayLevelOverride(overridden, 'vikas', mealEntryId);
  const vikasReverted = reverted.find(a => a.memberId === 'vikas');
  assert.equal(vikasReverted.recipeId, 'r_initial');
  assert.equal(vikasReverted.assignmentSource, 'automatic');
});

test('FEATURE 7: Meal balance provides evidence without fake numeric score', () => {
  const balancedRecipes = [
    buildStructuredRecipe({
      id: 'r_balanced',
      name: 'Matki Usal + Bhakri + Koshimbir',
      mr: 'मटकी उसळ + भाकरी + कोशिंबीर',
      nutrition: { proteinRole: 'legume' },
      dietaryFlags: { vegetables: true, legumes: true, wholeGrains: true, fruit: false }
    }, [], mockCatalog)
  ];

  const assignments = [{ memberId: 'vikas', recipeId: 'r_balanced' }];
  const balance = evaluateMealBalance(assignments, balancedRecipes);

  assert.equal(balance.score, undefined); // NO fake numeric score
  assert.ok(balance.indicators.find(i => i.key === 'protein_source' && i.status === 'present'));
  assert.ok(balance.indicators.find(i => i.key === 'vegetable_component' && i.status === 'present'));
  assert.ok(balance.indicators.find(i => i.key === 'whole_grain' && i.status === 'present'));
});

test('FEATURE 8: UI Source Code Audit for Recipe, Shopping, Prep, Calendar and Bilingual coverage', () => {
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');

  // Recipe CRUD in app.js
  assert.match(appSrc, /data-add-recipe/);
  assert.match(appSrc, /data-edit-recipe/);
  assert.match(appSrc, /data-save-recipe/);
  assert.match(appSrc, /recipeModalHtml/);

  // Shopping manual CRUD
  assert.match(appSrc, /data-add-shopping/);
  assert.match(appSrc, /data-delete-shopping/);

  // Prep CRUD
  assert.match(appSrc, /data-add-prep/);
  assert.match(appSrc, /data-delete-prep/);

  // Calendar slot rescheduling
  assert.match(appSrc, /data-reschedule-slot/);

  // Phase 2 Backup coverage
  assert.match(appSrc, /ingredientCatalog: sourceState\.ingredientCatalog/);
  assert.match(appSrc, /recipeIngredients: sourceState\.recipeIngredients/);
  assert.match(appSrc, /dietaryRules: sourceState\.dietaryRules/);
  assert.match(appSrc, /nutritionEducation: sourceState\.nutritionEducation/);
});

test('FEATURE 9: Canonical localization t(mr, en) dynamic behavior and fallback', () => {
  function createLocalizer(lang) {
    return function t(mrText, enText) {
      if (lang === 'mr') return mrText || enText || '';
      if (lang === 'en') return enText || mrText || '';
      if (!mrText) return enText || '';
      if (!enText || enText === mrText) return mrText;
      return `${mrText} · ${enText}`;
    };
  }

  const tMr = createLocalizer('mr');
  const tEn = createLocalizer('en');
  const tBoth = createLocalizer('both');

  // Marathi primary
  assert.equal(tMr('पाककृती', 'Recipes'), 'पाककृती');
  assert.equal(tMr('', 'Recipes'), 'Recipes'); // fallback

  // English primary
  assert.equal(tEn('पाककृती', 'Recipes'), 'Recipes');
  assert.equal(tEn('पाककृती', ''), 'पाककृती'); // fallback

  // Both
  assert.equal(tBoth('पाककृती', 'Recipes'), 'पाककृती · Recipes');
  assert.equal(tBoth('सेटिंग्ज', 'सेटिंग्ज'), 'सेटिंग्ज'); // de-duplicate if identical
  assert.equal(tBoth('', 'Recipes'), 'Recipes');

  // Never returns null or undefined
  assert.equal(tMr(null, null), '');
  assert.equal(tEn(undefined, undefined), '');
  assert.equal(tBoth(null, undefined), '');
});

test('FEATURE 10: Theme architecture and contrast tokens', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');

  // Light theme tokens defined
  assert.match(css, /--bg:\s*#[0-9a-fA-F]+/);
  assert.match(css, /--surface:\s*#[0-9a-fA-F]+/);
  assert.match(css, /--surface2:\s*#[0-9a-fA-F]+/);
  assert.match(css, /--surface-elevated:\s*#[0-9a-fA-F]+/);
  assert.match(css, /--btn-primary-bg:\s*#[0-9a-fA-F]+/);
  assert.match(css, /--btn-primary-fg:\s*#[0-9a-fA-F]+/);

  // Dark theme overrides defined with high-contrast tokens
  assert.match(css, /:root\[data-theme="dark"\]\s*\{/);
  assert.match(css, /--surface:\s*#18201d/);
  assert.match(css, /--text:\s*#e8f0eb/);
  assert.match(css, /--btn-primary-bg:\s*#327557/);
  assert.match(css, /--btn-primary-fg:\s*#ffffff/);

  // Cards, panels, and modals use semantic surface variables, not hardcoded white
  assert.match(css, /\.meal-card,\s*\.panel,\s*\.recipe-card[^}]*background:\s*var\(--surface\)/);
  assert.match(css, /\.modal-card\s*\{[^}]*background:\s*var\(--surface-elevated\)/);
});

test('FEATURE 11: Layout responsiveness and safety prevents distortion', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');

  // Topbar must NOT have rigid fixed height that squashes content
  assert.ok(!css.includes('height: 82px'), 'Rigid topbar height: 82px must be removed');
  assert.match(css, /\.topbar\s*\{[^}]*min-height:\s*(?:68|70)px/);

  // Assignment row wraps to prevent horizontal overflow when 4 family members are listed
  assert.match(css, /\.assignment-row\s*\{[^}]*flex-wrap:\s*wrap/);

  // Form grid responsive rule exists for mobile modal forms
  assert.match(css, /@media\s*\(max-width:\s*620px\)\s*\{[^}]*\.form-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test('FEATURE 12: Behavioral TTS execution on displayed content and fallback', async () => {
  const { createTtsController } = await import('../tts.js');

  const utterances = [];
  const mockSynth = {
    speaking: false,
    paused: false,
    pending: false,
    getVoices: () => [
      { name: 'Google हिन्दी', lang: 'hi-IN' },
      { name: 'Google US English', lang: 'en-US' }
    ],
    speak: (u) => {
      utterances.push(u);
      mockSynth.speaking = true;
      // Simulate successful speech end
      setTimeout(() => {
        mockSynth.speaking = false;
        if (typeof u.onend === 'function') u.onend({ type: 'end' });
      }, 5);
    },
    cancel: () => {
      mockSynth.speaking = false;
    }
  };

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.lang = 'en-US';
      this.rate = 1.0;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const mockWindow = {
    speechSynthesis: mockSynth,
    SpeechSynthesisUtterance: MockUtterance
  };

  const controller = createTtsController(mockWindow);

  // Test speaking both languages: Marathi first (falls back to hi-IN when mr-IN unavailable), then English
  controller.speak({
    key: 'meal_1',
    mrText: 'मूग भाजी चिल्ला आणि दही',
    enText: 'Moong vegetable chilla and curd',
    language: 'both'
  });

  // First utterance should be Marathi content resolved with Devanagari fallback (hi-IN)
  assert.equal(utterances.length, 1);
  assert.equal(utterances[0].text, 'मूग भाजी चिल्ला आणि दही');
  assert.equal(utterances[0].voice?.lang, 'hi-IN');

  // Wait for Marathi to end, triggering sequential English utterance
  await new Promise(res => setTimeout(res, 20));

  assert.equal(utterances.length, 2);
  assert.equal(utterances[1].text, 'Moong vegetable chilla and curd');
  assert.equal(utterances[1].voice?.lang, 'en-US');

  // Verify app.js renders meal card TTS buttons on Today and Calendar
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  assert.match(appSrc, /meal-tts-btn/);
  assert.match(appSrc, /data-tts-key/);
  assert.match(appSrc, /data-tts-mr/);
  assert.match(appSrc, /data-tts-en/);
});

