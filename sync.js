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
    meal_entries: state.meals.map(x => ({
      household_id: householdId,
      meal_date: x.date,
      slot: x.slot,
      title: x.title,
      marathi_title: x.marathi,
      status: x.status,
      notes: x.notes || null
    })),
    recipes: dedupeRecipesByName(state.recipes).map(x => ({
      household_id: householdId,
      recipe_key: x.id,
      name: x.name,
      marathi_name: x.mr,
      course: x.course,
      time_text: x.time,
      ingredients: x.ingredients,
      method: x.method,
      protein: x.protein,
      fibre: x.fibre,
      calories: x.cal,
      oil: x.oil,
      note: x.note
    })),
    family_members: state.members.map((x, i) => ({
      household_id: householdId,
      member_key: x.id,
      name: x.name,
      marathi_name: x.mr,
      age: x.age,
      sex: x.sex || null,
      weight_kg: x.weight,
      height_cm: x.height,
      activity: x.activity,
      note: x.note,
      sort_order: i
    })),
    shopping_items: state.shopping.map(x => ({
      household_id: householdId,
      item_key: x.id,
      item: x.item,
      marathi_item: x.mr,
      category: x.category,
      frequency: x.frequency || null,
      need_to_buy: x.need,
      purchased: x.purchased,
      quantity: x.quantity,
      notes: x.notes || null
    })),
    prep_tasks: state.prep.map(x => ({
      household_id: householdId,
      task_key: x.id,
      task: x.task,
      marathi_task: x.mr,
      task_date: x.date,
      done: x.done,
      category: x.area,
      notes: x.notes || null
    }))
  };
}

function mapRemoteState(data) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: (data.members || []).map(x => ({
      id: x.member_key,
      name: x.name,
      mr: x.marathi_name,
      age: x.age,
      sex: x.sex,
      weight: Number(x.weight_kg),
      height: Number(x.height_cm),
      activity: x.activity,
      note: x.note
    })),
    meals: (data.meals || []).map(x => ({
      id: `${x.meal_date}-${x.slot}`,
      date: x.meal_date,
      slot: x.slot,
      title: x.title,
      marathi: x.marathi_title || x.title,
      status: x.status,
      notes: x.notes
    })),
    recipes: dedupeRecipesByName(data.recipes || []).map(x => ({
      id: x.recipe_key,
      name: x.name,
      mr: x.marathi_name,
      course: x.course,
      time: x.time_text,
      ingredients: x.ingredients || [],
      method: x.method || [],
      protein: x.protein,
      fibre: x.fibre,
      cal: x.calories,
      oil: x.oil,
      note: x.note
    })),
    shopping: (data.shopping || []).map(x => ({
      id: x.item_key,
      item: x.item,
      mr: x.marathi_item || x.item,
      category: x.category,
      frequency: x.frequency,
      quantity: x.quantity,
      need: x.need_to_buy,
      purchased: x.purchased,
      notes: x.notes
    })),
    prep: (data.prep || []).map(x => ({
      id: x.task_key,
      task: x.task,
      mr: x.marathi_task || x.task,
      date: x.task_date,
      area: x.category,
      done: x.done,
      notes: x.notes
    }))
  };
}

if (typeof module !== 'undefined') module.exports = { REMOTE_TABLES, buildRemoteRows, mapRemoteState, dedupeRecipesByName };
export { REMOTE_TABLES, buildRemoteRows, mapRemoteState, dedupeRecipesByName };
