import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseLegacyIngredientLine,
  normalizeIngredientAlias, normalizeUnit, convertQuantity, aggregateIngredientLines,
  mapLegacyRecipeIngredients, deriveRecipeDietaryFlags, evaluateRecipeEligibility,
  DEFAULT_DIETARY_RULES, rankAlternateRecipes, selectAutomaticAlternate,
  buildAutomaticAssignments, applyDayLevelOverride, revertDayLevelOverride,
  mapNutritionEducation, getRecipeNutritionConcepts, evaluateMealBalance, buildShoppingFromAssignments,
  buildStructuredRecipe, DEFAULT_FREQUENCY_RULES, countIngredientMonthlyOccurrences, getHouseholdFrequencyStatus, recipeContainsIngredient
} from '../sync.js';

const catalog = [
  { canonicalKey:'onion', aliases:['onion','onions','कांदा','कांदे'] },
  { canonicalKey:'turmeric', aliases:['turmeric','haldi','हळद'] },
  { canonicalKey:'egg', aliases:['egg','eggs','अंडे','अंडी'] },
  { canonicalKey:'paneer', aliases:['paneer','पनीर'] },
  { canonicalKey:'moong_dal', aliases:['moong dal','मूग डाळ'] },
  { canonicalKey:'wheat_roti', aliases:['roti','whole-wheat roti','पोळी'] },
  { canonicalKey:'spinach', aliases:['spinach','palak','पालक'] }
];

test('normalizes English, plural, and Marathi aliases to one canonical ingredient', () => {
  assert.equal(normalizeIngredientAlias('कांदे', catalog), 'onion');
  assert.equal(normalizeIngredientAlias('onions', catalog), 'onion');
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
  assert.deepEqual(aggregateIngredientLines([
    { ingredientKey:'onion', quantity:500, unit:'g' },
    { ingredientKey:'onion', quantity:1, unit:'piece' }
  ]), [
    { ingredientKey:'onion', quantity:500, unit:'g' },
    { ingredientKey:'onion', quantity:1, unit:'piece' }
  ]);
});

test('maps known recipe ingredient aliases and preserves unmapped legacy lines', () => {
  const mapped = mapLegacyRecipeIngredients({ingredients:['250 g onion','1 tsp turmeric']}, catalog);
  assert.equal(mapped.structured.length,2);
  assert.equal(mapped.structured[0].ingredientKey,'onion');
  const unknown = mapLegacyRecipeIngredients({ingredients:['1 handful unknown greens']}, catalog);
  assert.equal(unknown.structured.length,0);
  assert.deepEqual(unknown.legacyUnmapped,['1 handful unknown greens']);
});

test('GAP-002: parses count-based/unitless and explicit unit ingredient lines correctly', () => {
  // Count-based / unitless
  assert.deepEqual(parseLegacyIngredientLine('8 eggs'), { quantity: 8, unit: 'piece', label: 'eggs' });
  assert.deepEqual(parseLegacyIngredientLine('4 bananas'), { quantity: 4, unit: 'piece', label: 'bananas' });
  assert.deepEqual(parseLegacyIngredientLine('2 cucumbers'), { quantity: 2, unit: 'piece', label: 'cucumbers' });
  assert.deepEqual(parseLegacyIngredientLine('1 apple'), { quantity: 1, unit: 'piece', label: 'apple' });
  assert.deepEqual(parseLegacyIngredientLine('8 rotis'), { quantity: 8, unit: 'piece', label: 'rotis' });

  // Explicit units preserved
  assert.deepEqual(parseLegacyIngredientLine('100 g dal'), { quantity: 100, unit: 'g', label: 'dal' });
  assert.deepEqual(parseLegacyIngredientLine('1 kg rice'), { quantity: 1, unit: 'kg', label: 'rice' });
  assert.deepEqual(parseLegacyIngredientLine('500 ml milk'), { quantity: 500, unit: 'ml', label: 'milk' });
  assert.deepEqual(parseLegacyIngredientLine('2 L water'), { quantity: 2, unit: 'L', label: 'water' });
  assert.deepEqual(parseLegacyIngredientLine('2 tsp oil'), { quantity: 2, unit: 'tsp', label: 'oil' });
  assert.deepEqual(parseLegacyIngredientLine('1 tbsp oil'), { quantity: 1, unit: 'tbsp', label: 'oil' });
  assert.deepEqual(parseLegacyIngredientLine('1 cup curd'), { quantity: 1, unit: 'cup', label: 'curd' });
  assert.deepEqual(parseLegacyIngredientLine('8 piece eggs'), { quantity: 8, unit: 'piece', label: 'eggs' });
});

test('GAP-002: builds egg recipe end-to-end from real ingredient lines without manual dietaryFlags injection', () => {
  const eggRecipeRaw = {
    id: 'egg-bhurji-roti',
    name: 'Egg Bhurji + Roti',
    mr: 'अंडा भुर्जी + पोळी',
    course: 'Breakfast/Dinner',
    time: '15 min',
    ingredients: ['8 eggs', '200 g onion-tomato', '8 rotis', '8 ml oil'],
    method: ['Whisk eggs.', 'Cook masala.', 'Scramble eggs fully.', 'Serve with rotis.'],
    note: 'Egg-free alternative: paneer bhurji.'
  };

  const structuredEggRecipe = buildStructuredRecipe(eggRecipeRaw, [], []);
  
  // Verify egg is parsed into structured ingredients as piece
  const eggIng = structuredEggRecipe.ingredients.find(i => i.ingredientKey === 'egg');
  assert.ok(eggIng, 'Egg must be recognized in structured ingredients');
  assert.equal(eggIng.quantity, 8);
  assert.equal(eggIng.unit, 'piece');

  // Verify derived dietary flags
  assert.equal(structuredEggRecipe.dietaryFlags.containsEgg, true, 'containsEgg must be true');
  assert.equal(structuredEggRecipe.dietaryFlags.vegetarian, false, 'vegetarian must be false for egg recipe');

  // Verify member eligibility on this parsed recipe
  assert.equal(evaluateRecipeEligibility({ id: 'siddhesh', name: 'Siddhesh' }, structuredEggRecipe, DEFAULT_DIETARY_RULES).eligible, true);
  assert.equal(evaluateRecipeEligibility({ id: 'tejas', name: 'Tejas' }, structuredEggRecipe, DEFAULT_DIETARY_RULES).eligible, true);
  assert.equal(evaluateRecipeEligibility({ id: 'vikas', name: 'Vikas' }, structuredEggRecipe, DEFAULT_DIETARY_RULES).eligible, false);
  assert.equal(evaluateRecipeEligibility({ id: 'namrata', name: 'Namrata' }, structuredEggRecipe, DEFAULT_DIETARY_RULES).eligible, false);

  // Verify automatic assignments with vegetarian alternate
  const vegAlternateRaw = {
    id: 'paneer-bhurji-roti',
    name: 'Paneer Bhurji + Roti',
    mr: 'पनीर भुर्जी + पोळी',
    course: 'Breakfast',
    time: '20 min',
    ingredients: ['400 g paneer', '200 g tomato-onion', '8 rotis', '10 ml oil'],
    method: ['Cook onion-tomato.', 'Add crumbled paneer.', 'Serve with rotis.']
  };
  const structuredVegAlternate = buildStructuredRecipe(vegAlternateRaw, [], []);
  assert.equal(structuredVegAlternate.dietaryFlags.vegetarian, true);

  const testMembers = [
    { id: 'siddhesh', name: 'Siddhesh' },
    { id: 'tejas', name: 'Tejas' },
    { id: 'vikas', name: 'Vikas' },
    { id: 'namrata', name: 'Namrata' }
  ];
  const meal = { id: '2026-09-07-Breakfast', date: '2026-09-07', slot: 'Breakfast', recipeId: structuredEggRecipe.id };
  const assignments = buildAutomaticAssignments(meal, testMembers, [structuredEggRecipe, structuredVegAlternate], DEFAULT_DIETARY_RULES);

  assert.equal(recipeFor(assignments, 'siddhesh'), structuredEggRecipe.id);
  assert.equal(recipeFor(assignments, 'tejas'), structuredEggRecipe.id);
  assert.equal(recipeFor(assignments, 'vikas'), structuredVegAlternate.id);
  assert.equal(recipeFor(assignments, 'namrata'), structuredVegAlternate.id);

  // If no vegetarian alternate exists, NEVER silently assign egg to Vikas or Namrata
  const assignmentsNoAlternate = buildAutomaticAssignments(meal, testMembers, [structuredEggRecipe], DEFAULT_DIETARY_RULES);
  assert.equal(recipeFor(assignmentsNoAlternate, 'siddhesh'), structuredEggRecipe.id);
  assert.equal(recipeFor(assignmentsNoAlternate, 'tejas'), structuredEggRecipe.id);
  assert.equal(recipeFor(assignmentsNoAlternate, 'vikas'), null);
  assert.equal(recipeFor(assignmentsNoAlternate, 'namrata'), null);
  const vikasAssignment = assignmentsNoAlternate.find(a => a.memberId === 'vikas');
  assert.match(vikasAssignment.overrideReason, /no suitable/i);
});

test('derives egg presence from canonical ingredient identity', () => {
  const flags = deriveRecipeDietaryFlags({ingredients:[{ingredientKey:'egg',quantity:2,unit:'piece'}]});
  assert.equal(flags.containsEgg,true);
  assert.equal(flags.vegetarian,false);
});

test('applies the household eligibility rule to all four members', () => {
  const recipe={dietaryFlags:{containsEgg:true}};
  assert.equal(evaluateRecipeEligibility({id:'siddhesh',name:'Siddhesh'},recipe,DEFAULT_DIETARY_RULES).eligible,true);
  assert.equal(evaluateRecipeEligibility({id:'tejas',name:'Tejas'},recipe,DEFAULT_DIETARY_RULES).eligible,true);
  assert.equal(evaluateRecipeEligibility({id:'vikas',name:'Vikas'},recipe,DEFAULT_DIETARY_RULES).eligible,false);
  assert.equal(evaluateRecipeEligibility({id:'namrata',name:'Namrata'},recipe,DEFAULT_DIETARY_RULES).eligible,false);
});

test('prefers an existing vegetarian recipe with same role and function', () => {
  const candidates=[
    {id:'a',name:'Veg Main',mealRole:'main',mealCategory:'breakfast',dietaryFlags:{vegetarian:true},dishFunction:'savory-main',nutrition:{proteinRole:'legume'}},
    {id:'b',name:'Veg Side',mealRole:'side',mealCategory:'breakfast',dietaryFlags:{vegetarian:true},dishFunction:'savory-main',nutrition:{proteinRole:'legume'}}
  ];
  const ranked=rankAlternateRecipes({mealRole:'main',mealCategory:'breakfast',dishFunction:'savory-main',nutrition:{proteinRole:'legume'}},{id:'vikas',name:'Vikas'},candidates);
  assert.equal(ranked[0].id,'a');
});

test('returns an explicit no-alternate result instead of fabricating a recipe', () => {
  const result=selectAutomaticAlternate({dietaryFlags:{containsEgg:true}},{id:'vikas',name:'Vikas'},[]);
  assert.equal(result.recipe,null);
  assert.match(result.reason,/no suitable/i);
});

const members=[{id:'siddhesh',name:'Siddhesh'},{id:'tejas',name:'Tejas'},{id:'vikas',name:'Vikas'},{id:'namrata',name:'Namrata'}];
const recipes=[
  {id:'egg-recipe',name:'Egg Bhurji',mealRole:'main',mealCategory:'breakfast',dishFunction:'savory-main',dietaryFlags:{containsEgg:true,vegetarian:false},nutrition:{proteinRole:'egg'}},
  {id:'veg-alternate',name:'Paneer Bhurji',mealRole:'main',mealCategory:'breakfast',dishFunction:'savory-main',dietaryFlags:{containsEgg:false,vegetarian:true},nutrition:{proteinRole:'dairy'}},
  {id:'another-veg',name:'Moong Chilla',mealRole:'main',mealCategory:'breakfast',dishFunction:'savory-main',dietaryFlags:{containsEgg:false,vegetarian:true},nutrition:{proteinRole:'legume'}}
];
const mealEntry={id:'2026-09-07-Breakfast',date:'2026-09-07',slot:'Breakfast',recipeId:'egg-recipe'};
function recipeFor(as,id){return as.find(x=>x.memberId===id)?.recipeId}

test('egg meal assigns egg recipe to Siddhesh/Tejas and vegetarian alternate to Vikas/Namrata',()=>{
  const a=buildAutomaticAssignments(mealEntry,members,recipes,DEFAULT_DIETARY_RULES);
  assert.equal(recipeFor(a,'siddhesh'),'egg-recipe');
  assert.equal(recipeFor(a,'tejas'),'egg-recipe');
  assert.equal(recipeFor(a,'vikas'),'veg-alternate');
  assert.equal(recipeFor(a,'namrata'),'veg-alternate');
});

test('day-level override changes only one assignment and can be reverted',()=>{
  const original=buildAutomaticAssignments(mealEntry,members,recipes,DEFAULT_DIETARY_RULES);
  const changed=applyDayLevelOverride(original,'vikas','another-veg');
  assert.equal(recipeFor(changed,'vikas'),'another-veg');
  assert.equal(recipeFor(changed,'namrata'),'veg-alternate');
  const reverted=revertDayLevelOverride(changed,'vikas');
  assert.equal(recipeFor(reverted,'vikas'),'veg-alternate');
});

test('maps reusable bilingual nutrition education without calorie metrics',()=>{
  const mapped=mapNutritionEducation([{concept_key:'protein',title:'Protein',marathi_title:'प्रथिने',what:'A nutrient.',marathi_what:'पोषक घटक.',body_use:'Tissues',marathi_body_use:'ऊती',function:'Build and repair',marathi_function:'तयार व दुरुस्ती',why_it_matters:'Growth',marathi_why_it_matters:'वाढ',food_sources:'Dal',marathi_food_sources:'डाळी',active:true}]);
  assert.equal(mapped[0].title,'Protein');
  assert.equal(mapped[0].marathiTitle,'प्रथिने');
  assert.equal('calories' in mapped[0],false);
});

test('meal balance reports evidence instead of a pseudo-precise score',()=>{
  const as=[{memberId:'siddhesh',recipeId:'r1',portionFactor:1}];
  const rs=[{id:'r1',nutrition:{proteinRole:'legume'},dietaryFlags:{vegetables:true,legumes:true,wholeGrains:true,fruit:false}}];
  const result=evaluateMealBalance(as,rs);
  assert.equal(result.score,undefined);
  assert.ok(result.indicators.some(x=>x.key==='protein_source'));
  assert.ok(result.indicators.some(x=>x.key==='vegetable_component'));
});

test('shopping aggregates canonical ingredients by assignment portion',()=>{
  const as=[{memberId:'siddhesh',recipeId:'r1',portionFactor:1},{memberId:'tejas',recipeId:'r1',portionFactor:1}];
  const rs=[{id:'r1'}];
  const ri=[{recipeId:'r1',ingredientKey:'onion',quantity:250,unit:'g'}];
  const shopping=buildShoppingFromAssignments(as,rs,ri,catalog);
  assert.equal(shopping.find(x=>x.canonicalKey==='onion').quantity,500);
});

test('day-level override is scoped to one meal entry',()=>{
  const input=[{mealEntryId:'day-a',memberId:'vikas',recipeId:'a',automaticRecipeId:'a'},{mealEntryId:'day-b',memberId:'vikas',recipeId:'b',automaticRecipeId:'b'}];
  assert.equal(applyDayLevelOverride(input,'vikas','x','day-a')[1].recipeId,'b');
  assert.equal(revertDayLevelOverride(applyDayLevelOverride(input,'vikas','x','day-a'),'vikas','day-a')[0].recipeId,'a');
});

test('Phase 2 UI exposes transparent alternate and balance controls',()=>{
  const source=fs.readFileSync(path.join(process.cwd(),'app.js'),'utf8');
  assert.match(source,/Change for this day/);
  assert.match(source,/Revert to automatic/);
  assert.match(source,/Meal balance/);
  assert.match(source,/buildShoppingFromAssignments/);
});

test('backup state contains structured recipe ingredients and meal assignments',()=>{
  const source=fs.readFileSync(path.join(process.cwd(),'app.js'),'utf8');
  assert.match(source,/function buildBackupPayload/);
  assert.match(source,/mealAssignments:sourceState\.mealAssignments/);
  assert.match(source,/version:2/);
  assert.match(source,/buildBackupPayload/);
});

test('Phase 2 migration defines canonical tables and RLS',()=>{
  const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260906_recipe_nutrition_shopping.sql'),'utf8');
  assert.match(sql,/create table if not exists public\.ingredients/i);
  assert.match(sql,/create table if not exists public\.recipe_ingredients/i);
  assert.match(sql,/create table if not exists public\.meal_assignments/i);
  assert.match(sql,/create table if not exists public\.nutrition_education/i);
  assert.match(sql,/enable row level security/i);
  assert.doesNotMatch(sql,/calorie.*target/i);
});

test('maps a recipe to reusable nutrition learning concepts without calorie metrics',()=>{
  const education=[
    {id:'protein',title:'Protein',marathiTitle:'प्रथिने'},
    {id:'vegetables',title:'Vegetables',marathiTitle:'भाज्या'},
    {id:'whole_grains',title:'Whole grains',marathiTitle:'पूर्ण धान्ये'}
  ];
  const recipe={nutrition:{proteinRole:'legume',vegetables:true,legumes:true,wholeGrains:true,fruit:false}};
  const concepts=getRecipeNutritionConcepts(recipe,education);
  assert.deepEqual(concepts.map(x=>x.id),['protein','vegetables','whole_grains']);
  assert.equal(concepts.some(x=>/calorie/i.test(x.id||'')),false);
});

test('nutrition learning UI connects meals, foods, and reusable bilingual concepts',()=>{
  const source=fs.readFileSync(path.join(process.cwd(),'app.js'),'utf8');
  assert.match(source,/What are we eating today\?/);
  assert.match(source,/Food sources/);
  assert.match(source,/Nutrition explained/);
  assert.match(source,/getRecipeNutritionConcepts/);
  assert.match(source,/data-nutrition-concept/);
  assert.match(fs.readFileSync(path.join(process.cwd(),'styles.css'),'utf8'),/nutrition-class-grid/);
  assert.match(fs.readFileSync(path.join(process.cwd(),'styles.css'),'utf8'),/food-learning/);
});

test('household frequency planning rule enforces monthly paneer limit without pseudo-medical restrictions',()=>{
  assert.ok(Array.isArray(DEFAULT_FREQUENCY_RULES));
  const paneerRule = DEFAULT_FREQUENCY_RULES.find(r => r.ingredientKey === 'paneer');
  assert.ok(paneerRule);
  assert.equal(paneerRule.maxPerCalendarMonth, 5);
  assert.equal(paneerRule.preferenceType, 'household_planning');
  assert.match(paneerRule.description, /household planning preference, not a medical restriction/i);

  const paneerRecipe = { id: 'p1', name: 'Paneer Bhurji', ingredients: [{ ingredientKey: 'paneer', quantity: 200, unit: 'g' }] };
  const vegRecipe = { id: 'v1', name: 'Moong Chilla', ingredients: [{ ingredientKey: 'moong_dal', quantity: 150, unit: 'g' }] };

  assert.equal(recipeContainsIngredient(paneerRecipe, 'paneer'), true);
  assert.equal(recipeContainsIngredient(vegRecipe, 'paneer'), false);

  // 4 family members in 1 shared meal entry
  const sharedMeal = [
    { mealEntryId: '2026-09-01-lunch', memberId: 'vikas', recipeId: 'p1' },
    { mealEntryId: '2026-09-01-lunch', memberId: 'namrata', recipeId: 'p1' },
    { mealEntryId: '2026-09-01-lunch', memberId: 'tejas', recipeId: 'p1' },
    { mealEntryId: '2026-09-01-lunch', memberId: 'siddhesh', recipeId: 'p1' }
  ];
  const count = countIngredientMonthlyOccurrences({
    assignments: sharedMeal,
    recipes: [paneerRecipe, vegRecipe],
    ingredientKey: 'paneer',
    month: '2026-09'
  });
  assert.equal(count, 1, '4 member rows for 1 meal entry must only count as 1 occurrence');

  const status = getHouseholdFrequencyStatus({
    assignments: sharedMeal,
    recipes: [paneerRecipe, vegRecipe],
    month: '2026-09'
  });
  assert.equal(status[0].currentOccurrences, 1);
  assert.equal(status[0].remaining, 4);
  assert.equal(status[0].limitReached, false);
});
