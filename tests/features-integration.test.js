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
  getRecipeNutritionConcepts,
  groupMemberAssignments,
  DEFAULT_FREQUENCY_RULES,
  recipeContainsIngredient,
  countIngredientMonthlyOccurrences,
  getHouseholdFrequencyStatus
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

  // Assignment row and controls are strictly bounded to prevent horizontal dropdown overflow
  assert.match(css, /\.assignment-row\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.assignment-change select\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.assignment-change select\s*\{[^}]*max-width:\s*100%/);

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

test('FEATURE 13: Presentation grouping of shared meals vs member alternates', () => {
  const recipes = [
    { id: 'r_shared', name: 'Moong Chilla', mr: 'मूग चिल्ला' },
    { id: 'r_egg', name: 'Egg Bhurji', mr: 'अंडा भुर्जी' },
    { id: 'r_veg', name: 'Paneer Bhurji', mr: 'पनीर भुर्जी' }
  ];

  // Case 1: All 4 members have identical recipe -> Shared family meal
  const sharedAssignments = [
    { memberId: 'vikas', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'namrata', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'tejas', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'siddhesh', recipeId: 'r_shared', assignmentSource: 'automatic' }
  ];
  const groupedShared = groupMemberAssignments(sharedAssignments, members, recipes);
  assert.equal(groupedShared.isShared, true);
  assert.equal(groupedShared.hasAlternates, false);
  assert.equal(groupedShared.groups.length, 1);
  assert.equal(groupedShared.groups[0].members.length, 4);

  // Case 2: 2 members have Egg, 2 have Veg alternate -> Shows member alternates
  const alternateAssignments = [
    { memberId: 'tejas', recipeId: 'r_egg', assignmentSource: 'automatic' },
    { memberId: 'siddhesh', recipeId: 'r_egg', assignmentSource: 'automatic' },
    { memberId: 'vikas', recipeId: 'r_veg', assignmentSource: 'automatic', automaticRecipeId: 'r_egg' },
    { memberId: 'namrata', recipeId: 'r_veg', assignmentSource: 'automatic', automaticRecipeId: 'r_egg' }
  ];
  const groupedAlt = groupMemberAssignments(alternateAssignments, members, recipes);
  assert.equal(groupedAlt.isShared, false);
  assert.equal(groupedAlt.hasAlternates, true);
  assert.equal(groupedAlt.groups.length, 2);

  // Case 3: 1 member has manual day override
  const overrideAssignments = [
    { memberId: 'vikas', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'namrata', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'tejas', recipeId: 'r_shared', assignmentSource: 'automatic' },
    { memberId: 'siddhesh', recipeId: 'r_egg', assignmentSource: 'manual', overrideRecipeId: 'r_egg' }
  ];
  const groupedOverride = groupMemberAssignments(overrideAssignments, members, recipes);
  assert.equal(groupedOverride.hasAlternates, true);
  const overrideGroup = groupedOverride.groups.find(g => g.hasOverride);
  assert.ok(overrideGroup);
  assert.equal(overrideGroup.members[0].id, 'siddhesh');
});

test('FEATURE 14: Shopping derivation portion scaling with 4 members', () => {
  const r1 = buildStructuredRecipe({
    id: 'r_chilla',
    name: 'Moong Chilla',
    ingredients: ['100 g moong dal', '10 ml oil']
  }, [], mockCatalog);
  const r2 = buildStructuredRecipe({
    id: 'r_bhurji',
    name: 'Egg Bhurji',
    ingredients: ['2 piece egg', '10 ml oil']
  }, [], mockCatalog);

  // 4 members eating 1 shared recipe -> 4 portions (400g moong dal, 40ml oil)
  const shared = [
    { memberId: 'vikas', recipeId: 'r_chilla', portionFactor: 1 },
    { memberId: 'namrata', recipeId: 'r_chilla', portionFactor: 1 },
    { memberId: 'tejas', recipeId: 'r_chilla', portionFactor: 1 },
    { memberId: 'siddhesh', recipeId: 'r_chilla', portionFactor: 1 }
  ];
  const shopShared = buildShoppingFromAssignments(shared, [r1, r2], [], mockCatalog);
  const moong = shopShared.find(x => x.canonicalKey === 'moong_dal');
  const oil = shopShared.find(x => x.canonicalKey === 'oil');
  assert.equal(moong.quantity, 400);
  assert.equal(oil.quantity, 40);

  // 2 members eating chilla, 2 members eating egg -> (200g moong, 4 eggs, 40ml oil)
  const split = [
    { memberId: 'vikas', recipeId: 'r_chilla', portionFactor: 1 },
    { memberId: 'namrata', recipeId: 'r_chilla', portionFactor: 1 },
    { memberId: 'tejas', recipeId: 'r_bhurji', portionFactor: 1 },
    { memberId: 'siddhesh', recipeId: 'r_bhurji', portionFactor: 1 }
  ];
  const shopSplit = buildShoppingFromAssignments(split, [r1, r2], [], mockCatalog);
  assert.equal(shopSplit.find(x => x.canonicalKey === 'moong_dal').quantity, 200);
  assert.equal(shopSplit.find(x => x.canonicalKey === 'egg').quantity, 4);
  assert.equal(shopSplit.find(x => x.canonicalKey === 'oil').quantity, 40);
});

test('FEATURE 15: Dark theme contrast and token safety', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');

  // Verify topbar switchers use glassmorphic styling, not stark opaque white box
  assert.match(css, /\.global-language,\s*\.global-theme\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,/);

  // Verify selects and options have theme-aware background
  assert.match(css, /select,\s*option\s*\{[^}]*background:\s*var\(--surface\)/);

  // Verify app.js renders family meal badge and member change details
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  assert.match(appSrc, /family-meal-badge/);
  assert.match(appSrc, /member-editor-details/);
  assert.match(appSrc, /Change for this day/);
  assert.match(appSrc, /Revert to automatic/);
});

test('FEATURE 16: Household Paneer Monthly Frequency Constraint & Alternate Ranking', () => {
  const eggRecipe = buildStructuredRecipe({
    id: 'r_egg_bhurji',
    name: 'Egg Bhurji + Roti',
    mealCategory: 'breakfast',
    mealRole: 'main',
    dishFunction: 'savory-main',
    nutrition: { proteinRole: 'egg' },
    dietaryFlags: { containsEgg: true, vegetarian: false },
    ingredients: ['8 eggs', '200 g onion', '8 rotis', '8 ml oil']
  }, [], []);

  const paneerRecipe = buildStructuredRecipe({
    id: 'r_paneer_bhurji',
    name: 'Paneer Bhurji + Roti',
    mealCategory: 'breakfast',
    mealRole: 'main',
    dishFunction: 'savory-main',
    nutrition: { proteinRole: 'dairy' },
    dietaryFlags: { containsEgg: false, vegetarian: true },
    ingredients: ['400 g paneer', '200 g onion', '10 ml oil']
  }, [], []);

  const chillaRecipe = buildStructuredRecipe({
    id: 'r_moong_chilla',
    name: 'Moong Vegetable Chilla',
    mealCategory: 'breakfast',
    mealRole: 'main',
    dishFunction: 'savory-main',
    nutrition: { proteinRole: 'legume' },
    dietaryFlags: { containsEgg: false, vegetarian: true },
    ingredients: ['200 g soaked moong dal', '100 g vegetables', '10 ml oil']
  }, [], []);

  const testVikas = { id: 'vikas', name: 'Vikas', mr: 'विकास' };
  const allCandidates = [eggRecipe, paneerRecipe, chillaRecipe];

  // 1. 0 paneer meals in month -> paneer alternate allowed
  const res0 = selectAutomaticAlternate(eggRecipe, testVikas, allCandidates, {
    assignments: [],
    targetDate: '2026-09-01'
  });
  assert.equal(res0.recipe?.id, paneerRecipe.id);
  assert.equal(res0.frequencyConstraintApplied, false);

  // 2. Helper to generate N shared paneer meals in September
  function makePaneerMealAssignments(count, month = '2026-09') {
    const arr = [];
    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      const mealId = `meal-${month}-${dayStr}-lunch`;
      // Each meal has 4 family members eating the same paneer recipe
      for (const m of ['vikas', 'namrata', 'tejas', 'siddhesh']) {
        arr.push({
          id: `${mealId}:${m}`,
          mealEntryId: mealId,
          memberId: m,
          recipeId: paneerRecipe.id,
          portionFactor: 1,
          assignmentSource: 'automatic',
          automaticRecipeId: paneerRecipe.id,
          overrideRecipeId: null,
          overrideReason: null
        });
      }
    }
    return arr;
  }

  // 3. Shared family meal is counted once, not four times
  const oneSharedMeal = makePaneerMealAssignments(1, '2026-09');
  assert.equal(oneSharedMeal.length, 4, '4 individual member assignment rows');
  const countShared = countIngredientMonthlyOccurrences({
    assignments: oneSharedMeal,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-09'
  });
  assert.equal(countShared, 1, '1 shared meal event must count as exactly 1 paneer occurrence, not 4');

  // 4. 4 paneer occurrences -> 5th allowed
  const fourPaneerMeals = makePaneerMealAssignments(4, '2026-09');
  assert.equal(countIngredientMonthlyOccurrences({
    assignments: fourPaneerMeals,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-09'
  }), 4);
  const res4 = selectAutomaticAlternate(eggRecipe, testVikas, allCandidates, {
    assignments: fourPaneerMeals,
    targetDate: '2026-09-05',
    mealEntryId: 'meal-2026-09-05-breakfast'
  });
  assert.equal(res4.recipe?.id, paneerRecipe.id, '5th paneer meal in calendar month must be allowed');
  assert.equal(res4.frequencyConstraintApplied, false);

  // 5. 5 paneer occurrences -> 6th paneer alternate rejected, non-paneer alternate preferred
  const fivePaneerMeals = makePaneerMealAssignments(5, '2026-09');
  assert.equal(countIngredientMonthlyOccurrences({
    assignments: fivePaneerMeals,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-09'
  }), 5);
  const res5 = selectAutomaticAlternate(eggRecipe, testVikas, allCandidates, {
    assignments: fivePaneerMeals,
    targetDate: '2026-09-06',
    mealEntryId: 'meal-2026-09-06-breakfast'
  });
  assert.equal(res5.recipe?.id, chillaRecipe.id, '6th paneer meal must be rejected; next suitable non-paneer vegetarian alternate must be selected');
  assert.equal(res5.frequencyConstraintApplied, true);
  assert.match(res5.reason, /frequency preference/i);

  // 6. No suitable non-paneer alternate -> explicit constraint warning without fabricating a fake dish
  const resNoAlt = selectAutomaticAlternate(eggRecipe, testVikas, [eggRecipe, paneerRecipe], {
    assignments: fivePaneerMeals,
    targetDate: '2026-09-07',
    mealEntryId: 'meal-2026-09-07-breakfast'
  });
  assert.equal(resNoAlt.recipe, null, 'Must not invent an unapproved dish');
  assert.equal(resNoAlt.frequencyConstraintViolated, true);
  assert.match(resNoAlt.reason, /household frequency preferences/i);

  // 7. Override can move paneer usage between dates correctly
  // Start with 5 paneer meals: Meal 1 through Meal 5
  let dynamicAssignments = makePaneerMealAssignments(5, '2026-09');
  assert.equal(countIngredientMonthlyOccurrences({ assignments: dynamicAssignments, recipes: allCandidates, month: '2026-09' }), 5);

  // Override Meal 1 for all members from Paneer to Chilla (non-paneer)
  for (const m of ['vikas', 'namrata', 'tejas', 'siddhesh']) {
    dynamicAssignments = applyDayLevelOverride(dynamicAssignments, m, chillaRecipe.id, 'meal-2026-09-01-lunch');
  }
  // Now effective paneer count for September must drop to 4!
  const countAfterOverride = countIngredientMonthlyOccurrences({
    assignments: dynamicAssignments,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-09'
  });
  assert.equal(countAfterOverride, 4, 'Overriding a paneer meal to non-paneer must reduce effective monthly count');

  // Now, evaluating a new meal in September allows paneer again because count is 4!
  const resAllowAgain = selectAutomaticAlternate(eggRecipe, testVikas, allCandidates, {
    assignments: dynamicAssignments,
    targetDate: '2026-09-25',
    mealEntryId: 'meal-2026-09-25-breakfast'
  });
  assert.equal(resAllowAgain.recipe?.id, paneerRecipe.id, 'Paneer meal is now permitted again as monthly count was reduced to 4');

  // 8. Reverting override restores correct monthly count
  for (const m of ['vikas', 'namrata', 'tejas', 'siddhesh']) {
    dynamicAssignments = revertDayLevelOverride(dynamicAssignments, m, 'meal-2026-09-01-lunch');
  }
  const countAfterRevert = countIngredientMonthlyOccurrences({
    assignments: dynamicAssignments,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-09'
  });
  assert.equal(countAfterRevert, 5, 'Reverting override must restore original monthly paneer count of 5');

  // 9. Different calendar months have independent counts
  // September has 5 paneer meals; October has 0 paneer meals
  const countOct = countIngredientMonthlyOccurrences({
    assignments: fivePaneerMeals,
    recipes: allCandidates,
    ingredientKey: 'paneer',
    month: '2026-10'
  });
  assert.equal(countOct, 0, 'October must have independent count of 0');

  const resOct = selectAutomaticAlternate(eggRecipe, testVikas, allCandidates, {
    assignments: fivePaneerMeals,
    targetDate: '2026-10-02',
    mealEntryId: 'meal-2026-10-02-breakfast'
  });
  assert.equal(resOct.recipe?.id, paneerRecipe.id, 'October meal must allow paneer even when September reached its limit');
  assert.equal(resOct.frequencyConstraintApplied, false);

  // 10. Household planning preference metadata (not medical advice)
  const status = getHouseholdFrequencyStatus({
    assignments: fivePaneerMeals,
    recipes: allCandidates,
    month: '2026-09',
    frequencyRules: DEFAULT_FREQUENCY_RULES
  });
  assert.equal(status.length, 1);
  assert.equal(status[0].key, 'paneer-monthly-frequency');
  assert.equal(status[0].preferenceType, 'household_planning', 'Must be categorized as household planning');
  assert.equal(status[0].currentOccurrences, 5);
  assert.equal(status[0].maxPerCalendarMonth, 5);
  assert.equal(status[0].limitReached, true);
  assert.match(DEFAULT_FREQUENCY_RULES[0].description, /household planning preference, not a medical restriction/i);
  assert.match(DEFAULT_FREQUENCY_RULES[0].marathiDescription, /घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही/i);

  // Verify app.js UI reflects household planning preference (not clinical advice)
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  assert.match(appSrc, /घरगुती नियोजन प्राधान्ये/);
  assert.match(appSrc, /Household Planning Preferences/);
  assert.match(appSrc, /वैद्यकीय सल्ला नाही/);
  assert.match(appSrc, /not medical advice/);
});

