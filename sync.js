const REMOTE_TABLES = ['meal_entries', 'recipes', 'family_members', 'shopping_items', 'prep_tasks'];
const PHASE2_TABLES = ['ingredients','recipe_ingredients','dietary_rules','meal_assignments','nutrition_education'];

function dedupeRecipesByName(recipes) {
  const byName = new Map();
  for (const recipe of recipes || []) {
    const key = String(recipe.name || '').trim().toLowerCase();
    if (key) byName.set(key, recipe);
  }
  return [...byName.values()];
}

function buildRemoteRows(state, householdId) {
  return {
    meal_entries: state.meals.map(x => ({ household_id: householdId, meal_date: x.date, slot: x.slot, title: x.title, marathi_title: x.marathi, status: x.status, notes: x.notes || null })),
    recipes: dedupeRecipesByName(state.recipes).map(x => ({ household_id: householdId, recipe_key: x.id, name: x.name, marathi_name: x.mr, course: x.course, time_text: x.time, ingredients: x.legacyIngredients || x.ingredients || [], method: x.method, protein: x.protein, fibre: x.fibre, calories: x.cal, oil: x.oil, note: x.note, description:x.description||null, marathi_description:x.marathiDescription||null, meal_category:x.mealCategory||x.course||null, meal_role:x.mealRole||null, servings:Number(x.servings||4), cooking_method:x.cookingMethod||null, dietary_flags:x.dietaryFlags||{}, nutrition_metadata:x.nutrition||{} })),
    family_members: state.members.map((x, i) => ({ household_id: householdId, member_key: x.id, name: x.name, marathi_name: x.mr, age: x.age, sex: x.sex || null, weight_kg: x.weight, height_cm: x.height, activity: x.activity, note: x.note, sort_order: i })),
    shopping_items: state.shopping.map(x => ({ household_id: householdId, item_key: x.id, item: x.item, marathi_item: x.mr, category: x.category, frequency: x.frequency || null, need_to_buy: x.need, purchased: x.purchased, quantity: x.quantity, notes: x.notes || null })),
    prep_tasks: state.prep.map(x => ({ household_id: householdId, task_key: x.id, task: x.task, marathi_task: x.mr, task_date: x.date, done: x.done, category: x.area, notes: x.notes || null }))
  };
}

function mapRemoteState(data, previous = {}) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: (data.members || []).map(x => ({ id: x.member_key, name: x.name, mr: x.marathi_name, age: x.age, sex: x.sex, weight: Number(x.weight_kg), height: Number(x.height_cm), activity: x.activity, note: x.note })),
    meals: (data.meals || []).map(x => ({ id: `${x.meal_date}-${x.slot}`, remoteId:x.id, date: x.meal_date, slot: x.slot, title: x.title, marathi: x.marathi_title || x.title, status: x.status, notes: x.notes })),
    recipes: dedupeRecipesByName(data.recipes || []).map(x => ({ id: x.recipe_key, remoteId:x.id, name: x.name, mr: x.marathi_name, course: x.course, time: x.time_text, ingredients: x.ingredients || [], legacyIngredients:x.ingredients || [], method: x.method || [], protein: x.protein, fibre: x.fibre, cal: x.calories, oil: x.oil, note: x.note, description:x.description, marathiDescription:x.marathi_description, mealCategory:x.meal_category||x.course, mealRole:x.meal_role, servings:Number(x.servings||4), cookingMethod:x.cooking_method, dietaryFlags:x.dietary_flags||{}, nutrition:x.nutrition_metadata||{} })),
    shopping: (data.shopping || []).map(x => ({ id: x.item_key, item: x.item, mr: x.marathi_item || x.item, category: x.category, frequency: x.frequency, quantity: x.quantity, need: x.need_to_buy, purchased: x.purchased, notes: x.notes })),
    prep: (data.prep || []).map(x => ({ id: x.task_key, task: x.task, mr: x.marathi_task || x.task, date: x.task_date, area: x.category, done: x.done, notes: x.notes })),
    healthTips: previous.healthTips || [],
    healthTargets: previous.healthTargets || [],
    householdSettings: previous.householdSettings || null
  };
}

function mapHealthTips(rows) {
  return (rows || []).filter(x => x.active !== false).sort((a,b) => (b.priority - a.priority) || (a.sort_order - b.sort_order)).map(x => ({
    id:x.tip_key, category:x.category, title:x.title, mrTitle:x.marathi_title, summary:x.summary, mrSummary:x.marathi_summary,
    detail:x.detail, mrDetail:x.marathi_detail, action:x.action, mrAction:x.marathi_action, sourceLabel:x.source_label, sourceUrl:x.source_url,
    priority:x.priority, sortOrder:x.sort_order
  }));
}

function mapHealthTargets(rows) {
  return (rows || []).filter(x => x.active !== false).sort((a,b) => a.sort_order - b.sort_order).map(x => ({
    id:x.target_key, category:x.category, label:x.label, mrLabel:x.marathi_label, value:x.value == null ? null : Number(x.value), valueText:x.value_text,
    unit:x.unit, periodText:x.period_text, context:x.context, mrContext:x.marathi_context, sourceLabel:x.source_label, sourceUrl:x.source_url
  }));
}

function mapHouseholdSettings(row) {
  if (!row) return null;
  return {
    householdId: row.household_id,
    displayName: row.display_name,
    householdSize: Number(row.household_size || 4),
    oilStockMl: Number(row.oil_stock_ml || 0),
    oilMonthlyTargetMl: Number(row.oil_monthly_target_ml || 3000),
    updatedAt: row.updated_at
  };
}

if (typeof module !== 'undefined') module.exports = { REMOTE_TABLES, PHASE2_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName };
export { REMOTE_TABLES, PHASE2_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName };

const SUPPORTED_UNITS = ['g','kg','ml','L','piece','tsp','tbsp','cup'];
const UNIT_ALIASES = { count:'piece', piece:'piece', pieces:'piece', pcs:'piece', gram:'g', grams:'g', kilogram:'kg', kilograms:'kg', millilitre:'ml', millilitres:'ml', milliliter:'ml', milliliters:'ml', litre:'L', litres:'L', liter:'L', liters:'L', teaspoon:'tsp', teaspoons:'tsp', tablespoon:'tbsp', tablespoons:'tbsp', cup:'cup', cups:'cup' };
const SAFE_UNIT_CONVERSIONS = { 'kg:g':1000, 'g:kg':0.001, 'L:ml':1000, 'ml:L':0.001 };

function normalizeUnit(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const normalized = UNIT_ALIASES[key] || (SUPPORTED_UNITS.includes(raw) ? raw : null);
  return SUPPORTED_UNITS.includes(normalized) ? normalized : null;
}

function normalizeIngredientAlias(value, aliases) {
  const needle = String(value ?? '').trim().toLocaleLowerCase();
  if (!needle) return null;
  const singular = needle.endsWith('es') ? needle.slice(0, -2) : needle.endsWith('s') ? needle.slice(0, -1) : null;
  for (const entry of aliases || []) {
    const key = entry.canonicalKey ?? entry.canonical_key ?? entry.ingredientKey ?? entry.ingredient_key;
    const names = [key, ...(entry.aliases || entry.aliases_json || [])].filter(Boolean);
    if (names.some(name => {
      const alias = String(name).trim().toLocaleLowerCase();
      const aliasSingular = alias.endsWith('es') ? alias.slice(0, -2) : alias.endsWith('s') ? alias.slice(0, -1) : null;
      return alias === needle ||
        (singular && alias === singular) ||
        (aliasSingular && aliasSingular === needle) ||
        (singular && aliasSingular && aliasSingular === singular) ||
        needle.startsWith(`${alias},`) ||
        needle.startsWith(`${alias} `) ||
        (singular && (needle.startsWith(`${alias}s`) || needle.startsWith(`${alias}es`)));
    })) return key;
  }
  return null;
}

function convertQuantity(quantity, fromUnit, toUnit) {
  const value = Number(quantity);
  const from = normalizeUnit(fromUnit), to = normalizeUnit(toUnit);
  if (!Number.isFinite(value) || !from || !to) return null;
  if (from === to) return value;
  const factor = SAFE_UNIT_CONVERSIONS[`${from}:${to}`];
  return factor == null ? null : value * factor;
}

function aggregateIngredientLines(lines) {
  const buckets = new Map();
  for (const line of lines || []) {
    const ingredientKey = String(line.ingredientKey ?? line.canonicalKey ?? '').trim();
    const unit = normalizeUnit(line.unit);
    const quantity = Number(line.quantity);
    if (!ingredientKey || !unit || !Number.isFinite(quantity)) continue;
    let target = [...buckets.values()].find(b => b.ingredientKey === ingredientKey && convertQuantity(1, unit, b.unit) != null);
    if (!target) {
      target = { ingredientKey, quantity: 0, unit };
      buckets.set(`${ingredientKey}:${unit}:${buckets.size}`, target);
    }
    const converted = convertQuantity(quantity, unit, target.unit);
    target.quantity += converted == null ? quantity : converted;
  }
  return [...buckets.values()].map(x => ({...x, quantity:Number(x.quantity.toFixed(4))}));
}

function parseLegacyIngredientLine(line) {
  const raw = String(line ?? '').trim();
  if (!raw) return null;
  const explicitMatch = raw.match(/^\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|L|piece|pieces|count|pcs|gram|grams|kilogram|kilograms|millilitre|millilitres|milliliter|milliliters|litre|litres|liter|liters|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|cup|cups)\s+(.+?)\s*$/i);
  if (explicitMatch) {
    const quantity = Number(explicitMatch[1]);
    const unit = normalizeUnit(explicitMatch[2]);
    if (unit) return { quantity, unit, label: explicitMatch[3].trim() };
  }
  const countMatch = raw.match(/^\s*(\d+(?:\.\d+)?)\s+(.+?)\s*$/);
  if (countMatch) {
    const quantity = Number(countMatch[1]);
    return { quantity, unit: 'piece', label: countMatch[2].trim() };
  }
  return null;
}

function mapLegacyRecipeIngredients(recipe, catalog) {
  const structured = [], legacyUnmapped = [];
  for (const line of recipe?.ingredients || []) {
    const parsed = parseLegacyIngredientLine(line);
    if (!parsed) { legacyUnmapped.push(line); continue; }
    const ingredientKey = normalizeIngredientAlias(parsed.label, catalog);
    if (!ingredientKey) { legacyUnmapped.push(line); continue; }
    structured.push({ ingredientKey, quantity: parsed.quantity, unit: parsed.unit, displayText: line });
  }
  return { structured, legacyUnmapped };
}

function deriveRecipeDietaryFlags(recipe) {
  const ingredients = recipe?.ingredients || [];
  const eggAliases = ['egg','eggs','अंडे','अंडी'];
  const nonVegAliases = ['chicken','mutton','fish','prawn','meat','chicken pieces','मटण','मासे'];
  const containsAlias = (value, aliases) => { const text=String(value?.ingredientKey ?? value?.canonicalKey ?? value ?? '').trim().toLowerCase(); return aliases.some(a=>text===a || text.startsWith(`${a} `) || text.includes(` ${a}`)); };
  const containsEgg = ingredients.some(x => containsAlias(x,eggAliases));
  const vegetarian = !containsEgg && !ingredients.some(x=>containsAlias(x,nonVegAliases));
  return { containsEgg, vegetarian };
}

const DEFAULT_DIETARY_RULES = [
  { key:'egg-eligibility', ingredientKey:'egg', allowedMemberIds:['siddhesh','tejas'], disallowedMemberIds:['vikas','namrata'], alternatePolicy:'vegetarian-existing' }
];

function evaluateRecipeEligibility(member, recipe, rules = DEFAULT_DIETARY_RULES) {
  const reasons = [];
  for (const rule of rules || []) {
    if (rule.ingredientKey === 'egg' && recipe?.dietaryFlags?.containsEgg) {
      if ((rule.disallowedMemberIds || []).includes(member?.id)) { reasons.push('Egg-containing recipe is not eligible for this member.'); return {eligible:false,reasons}; }
      if ((rule.allowedMemberIds || []).length && !(rule.allowedMemberIds || []).includes(member?.id)) { reasons.push('Member is not in the allowed group for this egg recipe.'); return {eligible:false,reasons}; }
    }
  }
  return {eligible:true,reasons};
}

function rankAlternateRecipes(ineligibleRecipe, member, candidateRecipes) {
  const suitable = (candidateRecipes || []).filter(r => evaluateRecipeEligibility(member,r,DEFAULT_DIETARY_RULES).eligible && r?.dietaryFlags?.vegetarian);
  const score = r => [
    r.mealRole === ineligibleRecipe.mealRole ? 1000 : 0,
    r.dishFunction === ineligibleRecipe.dishFunction ? 100 : 0,
    r.dietaryFlags?.vegetarian ? 50 : 0,
    r.nutrition?.proteinRole && r.nutrition?.proteinRole === ineligibleRecipe.nutrition?.proteinRole ? 20 : 0,
    r.mealCategory === ineligibleRecipe.mealCategory ? 10 : 0
  ].reduce((a,b)=>a+b,0);
  return suitable.map((recipe,index)=>({recipe,index})).sort((a,b)=>score(b.recipe)-score(a.recipe) || a.index-b.index).map(x=>x.recipe);
}

function selectAutomaticAlternate(ineligibleRecipe, member, candidateRecipes) {
  const recipe = rankAlternateRecipes(ineligibleRecipe,member,candidateRecipes).find(r => r.id !== ineligibleRecipe.id) || null;
  return recipe ? {recipe,reason:'Existing suitable vegetarian recipe selected by the alternate ranking rules.'} : {recipe:null,reason:'No suitable existing vegetarian alternate is available.'};
}

function buildAutomaticAssignments(mealEntry, members, recipes, rules = DEFAULT_DIETARY_RULES) {
  const primary = (recipes || []).find(r => r.id === mealEntry.recipeId || r.name === mealEntry.title);
  return (members || []).map(member => {
    const eligibility = evaluateRecipeEligibility(member,primary,rules);
    if (eligibility.eligible) return {id:`${mealEntry.id}:${member.id}`,mealEntryId:mealEntry.id,memberId:member.id,recipeId:primary?.id || null,portionFactor:1,assignmentSource:'automatic',automaticRecipeId:primary?.id || null,overrideRecipeId:null,overrideReason:null};
    const alternate = selectAutomaticAlternate(primary,member,recipes);
    return {id:`${mealEntry.id}:${member.id}`,mealEntryId:mealEntry.id,memberId:member.id,recipeId:alternate.recipe?.id || null,portionFactor:1,assignmentSource:'automatic',automaticRecipeId:alternate.recipe?.id || null,overrideRecipeId:null,overrideReason:alternate.reason};
  });
}

function applyDayLevelOverride(assignments, memberId, recipeId, mealEntryId = null) {
  return (assignments || []).map(a => (a.memberId === memberId && (!mealEntryId || a.mealEntryId === mealEntryId)) ? {...a,recipeId,assignmentSource:'manual',overrideRecipeId:recipeId,overrideReason:'Changed for this day'} : {...a});
}
function revertDayLevelOverride(assignments, memberId, mealEntryId = null) {
  return (assignments || []).map(a => (a.memberId === memberId && (!mealEntryId || a.mealEntryId === mealEntryId)) ? {...a,recipeId:a.automaticRecipeId,assignmentSource:'automatic',overrideRecipeId:null,overrideReason:null} : {...a});
}

function mapNutritionEducation(rows) {
  return (rows || []).filter(x => x.active !== false).map(x => ({
    id:x.concept_key,title:x.title,marathiTitle:x.marathi_title,what:x.what,marathiWhat:x.marathi_what,bodyUse:x.body_use,marathiBodyUse:x.marathi_body_use,
    function:x.function,marathiFunction:x.marathi_function,whyItMatters:x.why_it_matters,marathiWhyItMatters:x.marathi_why_it_matters,foodSources:x.food_sources,marathiFoodSources:x.marathi_food_sources,sortOrder:x.sort_order
  }));
}
function getNutritionEducation(conceptKey, education) { return (education || []).find(x => x.id === conceptKey) || null; }
function getRecipeNutritionConcepts(recipe, education) {
  const r = recipe || {};
  const n = r.nutrition || {};
  const concepts = new Set();
  if (n.proteinRole) { concepts.add('protein'); concepts.add('main_protein'); }
  if (n.vegetables) concepts.add('vegetables');
  if (n.fruit) concepts.add('fruits');
  if (n.wholeGrains) concepts.add('whole_grains');
  if (n.legumes) { concepts.add('legumes'); concepts.add('fibre'); }
  if (n.vegetables || n.fruit || n.wholeGrains) concepts.add('fibre');
  if (r.oil || n.oilMlPerServing != null) concepts.add('fat_quality');
  return (education || [])
    .filter(x => concepts.has(x.id))
    .sort((a,b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));
}

function evaluateMealBalance(assignments, recipes) {
  const assignedRecipes = (assignments || []).map(a => (recipes || []).find(r => r.id === a.recipeId)).filter(Boolean);
  const any = key => assignedRecipes.some(r => r?.dietaryFlags?.[key]);
  const protein = assignedRecipes.some(r => r?.nutrition?.proteinRole || r?.protein);
  const indicators = [
    {key:'protein_source',label:'Protein source',marathiLabel:'प्रथिनांचा स्रोत',status:protein?'present':'not_detected'},
    {key:'vegetable_component',label:'Vegetable component',marathiLabel:'भाजीपाला घटक',status:any('vegetables')?'present':'not_detected'},
    {key:'pulse_legume',label:'Pulse / legume',marathiLabel:'डाळ / कडधान्य',status:any('legumes')?'present':'not_detected'},
    {key:'whole_grain',label:'Whole-grain component',marathiLabel:'पूर्ण धान्याचा घटक',status:any('wholeGrains')?'present':'not_detected'},
    {key:'fruit_component',label:'Fruit component',marathiLabel:'फळांचा घटक',status:any('fruit')?'present':'not_detected'},
    {key:'oil_consideration',label:'Oil consideration',marathiLabel:'तेलाचा विचार',status:assignedRecipes.some(r=>r.oil || r.nutrition?.oilMlPerServing != null)?'present':'not_detected'}
  ];
  return {indicators,evidenceRecipes:assignedRecipes.map(r=>r.id)};
}

function buildShoppingFromAssignments(assignments, recipes, recipeIngredients, ingredientCatalog) {
  const lines=[];
  for (const assignment of assignments || []) {
    const factor = Number(assignment.portionFactor ?? assignment.portionCount ?? 1);
    if (!Number.isFinite(factor) || factor <= 0) continue;
    const recipe = (recipes || []).find(r => r.id === assignment.recipeId);
    const sourceLines = (recipeIngredients || []).filter(x => x.recipeId === assignment.recipeId);
    const fallbackLines = sourceLines.length ? sourceLines : ((recipe?.ingredients || []).filter(x => x && typeof x === 'object' && x.ingredientKey));
    for (const line of fallbackLines) {
      const canonicalKey = line.ingredientKey || line.canonicalKey;
      if (!canonicalKey) continue;
      lines.push({ingredientKey:canonicalKey,quantity:Number(line.quantity)*factor,unit:line.unit});
    }
  }
  const aggregated = aggregateIngredientLines(lines);
  return aggregated.map(x => {
    const c=(ingredientCatalog||[]).find(i=>(i.canonicalKey||i.canonical_key)===x.ingredientKey) || {};
    return {...x,canonicalKey:x.ingredientKey,name:c.name||c.displayName||x.ingredientKey,marathiName:c.marathiName||c.marathi_name||x.ingredientKey};
  });
}

function mapIngredientCatalog(rows) {
  return (rows || []).map(x => ({id:x.id,canonicalKey:x.canonical_key,name:x.name,marathiName:x.marathi_name,aliases:Array.isArray(x.aliases)?x.aliases:[],category:x.category,defaultUnit:x.default_unit,active:x.active !== false}));
}
function mapRecipeIngredients(rows) {
  return (rows || []).map(x => ({id:x.id,recipeId:x.recipe_id,ingredientId:x.ingredient_id,ingredientKey:x.ingredient_key || x.canonical_key,quantity:Number(x.quantity),unit:x.unit,displayText:x.display_text,preparation:x.preparation,sortOrder:x.sort_order}));
}
function mapDietaryRules(rows) { return (rows||[]).filter(x=>x.active!==false).map(x=>({id:x.id,ruleKey:x.rule_key,ingredientKey:x.ingredient_key,allowedMemberIds:Array.isArray(x.allowed_member_ids)?x.allowed_member_ids:[],disallowedMemberIds:Array.isArray(x.disallowed_member_ids)?x.disallowed_member_ids:[],alternatePolicy:x.alternate_policy})); }
function mapMealAssignments(rows) {
  return (rows || []).map(x => ({id:x.id,mealEntryId:x.meal_entry_id,memberId:x.member_id,recipeId:x.recipe_id,portionFactor:Number(x.portion_factor||1),assignmentSource:x.assignment_source,automaticRecipeId:x.automatic_recipe_id,overrideRecipeId:x.override_recipe_id,overrideReason:x.override_reason}));
}
function buildStructuredRecipe(recipe, recipeIngredients, ingredientCatalog) {
  const mapped = (recipeIngredients || []).filter(x => x.recipeId === recipe.id);
  const legacy = recipe.legacyIngredients || recipe.ingredients || [];
  const fallbackCatalog = (ingredientCatalog && ingredientCatalog.length) ? ingredientCatalog : [
    {canonicalKey:'egg',aliases:['egg','eggs','अंडे','अंडी']},{canonicalKey:'paneer',aliases:['paneer','पनीर']},{canonicalKey:'curd',aliases:['curd','दही']},
    {canonicalKey:'milk',aliases:['milk','दूध']},{canonicalKey:'moong_dal',aliases:['moong dal','moong','मूग डाळ']},{canonicalKey:'chickpeas',aliases:['chickpeas','chana','हरभरा']},
    {canonicalKey:'rajma',aliases:['rajma','राजमा']},{canonicalKey:'matki',aliases:['matki','मटकी']},{canonicalKey:'lobia',aliases:['lobia','चवळी']},
    {canonicalKey:'soy_granules',aliases:['soy granules','soy','सोया ग्रॅन्युल्स']},{canonicalKey:'onion',aliases:['onion','onions','कांदा','कांदे']},
    {canonicalKey:'tomato',aliases:['tomato','tomatoes','टोमॅटो']},{canonicalKey:'cabbage',aliases:['cabbage','कोबी']},{canonicalKey:'carrot',aliases:['carrot','carrots','गाजर']},
    {canonicalKey:'spinach',aliases:['spinach','palak','पालक']},{canonicalKey:'cucumber',aliases:['cucumber','cucumbers','काकडी']},{canonicalKey:'bhindi',aliases:['bhindi','okra','भेंडी']},
    {canonicalKey:'bottle_gourd',aliases:['dudhi','bottle gourd','दुधी भोपळा']},{canonicalKey:'brinjal',aliases:['brinjal','brinjals','vangi','वांगी']},{canonicalKey:'cauliflower',aliases:['cauliflower','फुलकोबी']},
    {canonicalKey:'whole_wheat_flour',aliases:['whole-wheat flour','atta','whole wheat flour','गव्हाचे पीठ','roti','rotis','whole-wheat roti','whole-wheat rotis','wheat roti','पोळी','पोळ्या']},{canonicalKey:'jowar_flour',aliases:['jowar flour','jowar','ज्वारीचे पीठ']},
    {canonicalKey:'rice',aliases:['rice','तांदूळ']},{canonicalKey:'poha',aliases:['poha','flattened rice','पोहे']},{canonicalKey:'besan',aliases:['besan','gram flour','बेसन']},
    {canonicalKey:'peanuts',aliases:['peanuts','peanut','शेंगदाणे']},{canonicalKey:'banana',aliases:['banana','bananas','केळी']},{canonicalKey:'guava',aliases:['guava','पेरू']},
    {canonicalKey:'papaya',aliases:['papaya','पपई']},{canonicalKey:'pomegranate',aliases:['pomegranate','डाळिंब']},{canonicalKey:'mosambi',aliases:['mosambi','sweet lime','मोसंबी']},
    {canonicalKey:'apple',aliases:['apple','apples','सफरचंद']},{canonicalKey:'flaxseed',aliases:['flaxseed','flax','जवस']},{canonicalKey:'pumpkin_seeds',aliases:['pumpkin seeds','भोपळ्याच्या बिया']},
    {canonicalKey:'oil',aliases:['oil','cooking oil','तेल']},{canonicalKey:'turmeric',aliases:['turmeric','haldi','हळद']},{canonicalKey:'cumin',aliases:['cumin','jeera','जिरे']},{canonicalKey:'coriander',aliases:['coriander','cilantro','कोथिंबीर']},{canonicalKey:'lemon',aliases:['lemon','lemons','लिंबू']},{canonicalKey:'salt',aliases:['salt','मीठ']}
  ];
  const fallback = mapLegacyRecipeIngredients({ingredients:legacy},fallbackCatalog);
  const structured = mapped.length ? mapped : fallback.structured;
  const keys = new Set(structured.map(x=>x.ingredientKey));
  const course=String(recipe.course||recipe.mealCategory||'').toLowerCase();
  const title=String(recipe.name||'').toLowerCase();
  const mealRole=recipe.mealRole || (course.includes('snack') ? 'snack' : 'main');
  const dishFunction=recipe.dishFunction || (/(bhurji|chilla|uttapam|dosa|pancake|poha|thalipeeth|handvo|adai|pitha|pessarattu)/.test(title) ? 'savory-main' : 'meal-main');
  const vegetables=[...keys].some(k=>['onion','tomato','carrot','cabbage','spinach','cucumber','bhindi','bottle_gourd','brinjal','cauliflower'].includes(k));
  const legumes=[...keys].some(k=>['moong_dal','chickpeas','rajma','matki','lobia','soy_granules','besan'].includes(k));
  const wholeGrains=[...keys].some(k=>['whole_wheat_flour','jowar_flour'].includes(k));
  const fruit=[...keys].some(k=>['banana','guava','papaya','pomegranate','mosambi','apple'].includes(k));
  const proteinRole=keys.has('egg')?'egg':keys.has('paneer')||keys.has('curd')||keys.has('milk')?'dairy':legumes?'legume':null;
  const dietaryFlags=recipe.dietaryFlags && Object.keys(recipe.dietaryFlags).length ? recipe.dietaryFlags : {...deriveRecipeDietaryFlags({ingredients:structured}),vegetables,legumes,wholeGrains,fruit};
  const nutrition=recipe.nutrition && Object.keys(recipe.nutrition).length ? recipe.nutrition : {proteinRole,vegetables,legumes,wholeGrains,fruit};
  return {...recipe,legacyIngredients:legacy,ingredients:structured,legacyUnmapped:mapped.length ? [] : fallback.legacyUnmapped,mealCategory:recipe.mealCategory||recipe.course,mealRole,dishFunction,dietaryFlags,nutrition};
}

function groupMemberAssignments(assignments = [], members = [], recipes = []) {
  if (!assignments || !assignments.length) {
    return { isShared: true, sharedRecipe: null, groups: [], hasAlternates: false };
  }
  const groupMap = new Map();
  for (const a of assignments) {
    const recipeId = a.recipeId;
    const member = (members || []).find(m => m.id === a.memberId) || { id: a.memberId, name: a.memberId, mr: a.memberId };
    const recipe = (recipes || []).find(r => r.id === recipeId) || { id: recipeId, name: recipeId, mr: recipeId };
    if (!groupMap.has(recipeId)) {
      groupMap.set(recipeId, {
        recipeId,
        recipe,
        members: [],
        memberIds: [],
        hasOverride: false,
        hasAutoAlternate: false
      });
    }
    const grp = groupMap.get(recipeId);
    grp.members.push(member);
    grp.memberIds.push(member.id);
    if (a.assignmentSource === 'manual') grp.hasOverride = true;
    if (a.assignmentSource === 'automatic' && a.automaticRecipeId && a.recipeId !== a.automaticRecipeId) {
      grp.hasAutoAlternate = true;
    }
  }
  const groups = Array.from(groupMap.values());
  const isShared = groups.length === 1;
  const sharedRecipe = isShared ? groups[0].recipe : null;
  const hasAlternates = groups.length > 1 || groups.some(g => g.hasOverride || g.hasAutoAlternate);

  return {
    isShared,
    sharedRecipe,
    groups,
    hasAlternates
  };
}

if (typeof module !== 'undefined') Object.assign(module.exports, {SUPPORTED_UNITS,normalizeIngredientAlias,normalizeUnit,convertQuantity,aggregateIngredientLines,parseLegacyIngredientLine,mapLegacyRecipeIngredients,deriveRecipeDietaryFlags,DEFAULT_DIETARY_RULES,evaluateRecipeEligibility,rankAlternateRecipes,selectAutomaticAlternate,buildAutomaticAssignments,applyDayLevelOverride,revertDayLevelOverride,mapNutritionEducation,getNutritionEducation,getRecipeNutritionConcepts,evaluateMealBalance,buildShoppingFromAssignments,mapIngredientCatalog,mapRecipeIngredients,mapMealAssignments,buildStructuredRecipe,mapDietaryRules,groupMemberAssignments});
export {SUPPORTED_UNITS,normalizeIngredientAlias,normalizeUnit,convertQuantity,aggregateIngredientLines,parseLegacyIngredientLine,mapLegacyRecipeIngredients,deriveRecipeDietaryFlags,DEFAULT_DIETARY_RULES,evaluateRecipeEligibility,rankAlternateRecipes,selectAutomaticAlternate,buildAutomaticAssignments,applyDayLevelOverride,revertDayLevelOverride,mapNutritionEducation,getNutritionEducation,getRecipeNutritionConcepts,evaluateMealBalance,buildShoppingFromAssignments,mapIngredientCatalog,mapRecipeIngredients,mapMealAssignments,buildStructuredRecipe,mapDietaryRules,groupMemberAssignments};
