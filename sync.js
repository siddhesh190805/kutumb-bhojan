const REMOTE_TABLES = ['meal_entries', 'recipes', 'family_members', 'shopping_items', 'prep_tasks'];

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
    recipes: dedupeRecipesByName(state.recipes).map(x => ({ household_id: householdId, recipe_key: x.id, name: x.name, marathi_name: x.mr, course: x.course, time_text: x.time, ingredients: x.ingredients, method: x.method, protein: x.protein, fibre: x.fibre, calories: x.cal, oil: x.oil, note: x.note })),
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
    meals: (data.meals || []).map(x => ({ id: `${x.meal_date}-${x.slot}`, date: x.meal_date, slot: x.slot, title: x.title, marathi: x.marathi_title || x.title, status: x.status, notes: x.notes })),
    recipes: dedupeRecipesByName(data.recipes || []).map(x => ({ id: x.recipe_key, name: x.name, mr: x.marathi_name, course: x.course, time: x.time_text, ingredients: x.ingredients || [], method: x.method || [], protein: x.protein, fibre: x.fibre, cal: x.calories, oil: x.oil, note: x.note })),
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

if (typeof module !== 'undefined') module.exports = { REMOTE_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName };
export { REMOTE_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName };
