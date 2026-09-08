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

function mapUiContent(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.active === false) continue;
    const key = row.content_key || row.key;
    if (!key) continue;
    map.set(key, {
      key,
      category: row.category,
      mr: row.marathi || row.mr || row.mr_text || '',
      en: row.english || row.en || row.en_text || '',
      metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
      sortOrder: Number(row.sort_order || row.sortOrder || 0)
    });
  }
  return map;
}

function createContentProvider(contentData = CANONICAL_UI_CONTENT) {
  if (!contentData || (contentData instanceof Map && contentData.size === 0) || (typeof contentData === 'object' && Object.keys(contentData).length === 0)) contentData = CANONICAL_UI_CONTENT;
  const map = contentData instanceof Map
    ? contentData
    : Array.isArray(contentData)
      ? mapUiContent(contentData)
      : (typeof contentData === 'object' && contentData !== null)
        ? new Map(Object.entries(contentData))
        : new Map();

  function resolveItem(key) {
    if (!key) return null;
    if (map.has(key)) return map.get(key);
    const lower = key.toLowerCase();
    if (map.has(lower)) return map.get(lower);
    if (key.startsWith('slot.')) {
      const cap = `slot.${key.slice(5).charAt(0).toUpperCase() + key.slice(6).toLowerCase()}`;
      if (map.has(cap)) return map.get(cap);
    }
    return null;
  }

  function get(key, language = 'both', fallback = '') {
    const item = resolveItem(key);
    if (!item) return fallback !== '' ? fallback : '';
    const mrText = item.mr || item.marathi || '';
    const enText = item.en || item.english || '';

    if (language === 'mr') return mrText || enText || fallback || '';
    if (language === 'en') return enText || mrText || fallback || '';
    if (!mrText) return enText || fallback || '';
    if (!enText || enText === mrText) return mrText;
    return `${mrText} · ${enText}`;
  }

  function has(key) {
    return resolveItem(key) !== null;
  }

  function getRaw(key) {
    return resolveItem(key);
  }

  function getByCategory(category) {
    const items = [];
    for (const val of map.values()) {
      if (val.category === category) items.push(val);
    }
    return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function toJSON() {
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  return { get, getRaw, getByCategory, toJSON, size: map.size, has: (k) => map.has(k) };
}

const CANONICAL_UI_CONTENT = {
  "app.name": {
    "key": "app.name",
    "category": "identity",
    "mr": "कुटुंब भोजन",
    "en": "Kutumb Bhojan",
    "metadata": {
      "short": "कुटुंब भोजन"
    },
    "sortOrder": 1
  },
  "app.tagline": {
    "key": "app.tagline",
    "category": "identity",
    "mr": "कुटुंबाचे पोषण",
    "en": "FAMILY NUTRITION",
    "metadata": {},
    "sortOrder": 2
  },
  "app.brand_strong": {
    "key": "app.brand_strong",
    "category": "identity",
    "mr": "सोपे कौटुंबिक जेवण",
    "en": "Simple Family Meals",
    "metadata": {},
    "sortOrder": 3
  },
  "app.brand_small": {
    "key": "app.brand_small",
    "category": "identity",
    "mr": "कुटुंबाची पोषण नियोजन पद्धत",
    "en": "Family meal planning system",
    "metadata": {},
    "sortOrder": 4
  },
  "nav.today": {
    "key": "nav.today",
    "category": "navigation",
    "mr": "आज",
    "en": "Today",
    "metadata": {
      "icon": "🏠",
      "page": "today"
    },
    "sortOrder": 10
  },
  "nav.calendar": {
    "key": "nav.calendar",
    "category": "navigation",
    "mr": "कॅलेंडर",
    "en": "Calendar",
    "metadata": {
      "icon": "📅",
      "page": "calendar"
    },
    "sortOrder": 20
  },
  "nav.recipes": {
    "key": "nav.recipes",
    "category": "navigation",
    "mr": "पाककृती",
    "en": "Recipes",
    "metadata": {
      "icon": "🍳",
      "page": "recipes"
    },
    "sortOrder": 30
  },
  "nav.health": {
    "key": "nav.health",
    "category": "navigation",
    "mr": "आरोग्य",
    "en": "Health",
    "metadata": {
      "icon": "🌿",
      "page": "health"
    },
    "sortOrder": 40
  },
  "nav.shopping": {
    "key": "nav.shopping",
    "category": "navigation",
    "mr": "खरेदी",
    "en": "Shopping",
    "metadata": {
      "icon": "🛒",
      "page": "shopping"
    },
    "sortOrder": 50
  },
  "nav.prep": {
    "key": "nav.prep",
    "category": "navigation",
    "mr": "तयारी",
    "en": "Prep",
    "metadata": {
      "icon": "🔪",
      "page": "prep"
    },
    "sortOrder": 60
  },
  "nav.family": {
    "key": "nav.family",
    "category": "navigation",
    "mr": "कुटुंब",
    "en": "Family",
    "metadata": {
      "icon": "👨‍👩‍👦",
      "page": "family"
    },
    "sortOrder": 70
  },
  "nav.settings": {
    "key": "nav.settings",
    "category": "navigation",
    "mr": "सेटिंग्ज",
    "en": "Settings",
    "metadata": {
      "icon": "⚙️",
      "page": "settings"
    },
    "sortOrder": 80
  },
  "sidebar.questions_title": {
    "key": "sidebar.questions_title",
    "category": "sidebar",
    "mr": "आजचे चार प्रश्न",
    "en": "Four Daily Questions",
    "metadata": {},
    "sortOrder": 90
  },
  "sidebar.q_cook": {
    "key": "sidebar.q_cook",
    "category": "sidebar",
    "mr": "काय बनवायचे? → कॅलेंडर",
    "en": "What to cook? → Calendar",
    "metadata": {},
    "sortOrder": 91
  },
  "sidebar.q_recipe": {
    "key": "sidebar.q_recipe",
    "category": "sidebar",
    "mr": "कसे बनवायचे? → पाककृती",
    "en": "How to cook? → Recipes",
    "metadata": {},
    "sortOrder": 92
  },
  "sidebar.q_buy": {
    "key": "sidebar.q_buy",
    "category": "sidebar",
    "mr": "काय आणायचे? → खरेदी",
    "en": "What to buy? → Shopping",
    "metadata": {},
    "sortOrder": 93
  },
  "sidebar.q_prep": {
    "key": "sidebar.q_prep",
    "category": "sidebar",
    "mr": "आधी काय करायचे? → तयारी",
    "en": "What to prep? → Prep",
    "metadata": {},
    "sortOrder": 94
  },
  "sidebar.q_health": {
    "key": "sidebar.q_health",
    "category": "sidebar",
    "mr": "आरोग्य कसे सुधारायचे? → आरोग्य",
    "en": "How to improve health? → Health",
    "metadata": {},
    "sortOrder": 95
  },
  "slot.Breakfast": {
    "key": "slot.Breakfast",
    "category": "meal_slot",
    "mr": "सकाळचा नाश्ता",
    "en": "Breakfast",
    "metadata": {
      "icon": "🍳",
      "slot_key": "Breakfast"
    },
    "sortOrder": 100
  },
  "slot.Lunch": {
    "key": "slot.Lunch",
    "category": "meal_slot",
    "mr": "दुपारचे जेवण",
    "en": "Lunch",
    "metadata": {
      "icon": "🍛",
      "slot_key": "Lunch"
    },
    "sortOrder": 101
  },
  "slot.Snack": {
    "key": "slot.Snack",
    "category": "meal_slot",
    "mr": "संध्याकाळचा खाऊ",
    "en": "Evening Snack",
    "metadata": {
      "icon": "🥜",
      "slot_key": "Snack"
    },
    "sortOrder": 102
  },
  "slot.Dinner": {
    "key": "slot.Dinner",
    "category": "meal_slot",
    "mr": "रात्रीचे जेवण",
    "en": "Dinner",
    "metadata": {
      "icon": "🍽️",
      "slot_key": "Dinner"
    },
    "sortOrder": 103
  },
  "today.kicker": {
    "key": "today.kicker",
    "category": "section",
    "mr": "आज",
    "en": "TODAY",
    "metadata": {},
    "sortOrder": 110
  },
  "today.title": {
    "key": "today.title",
    "category": "section",
    "mr": "आज काय बनवायचे?",
    "en": "What are we eating today?",
    "metadata": {},
    "sortOrder": 111
  },
  "today.subtitle": {
    "key": "today.subtitle",
    "category": "section",
    "mr": "जेवण, तयारी, खरेदी आणि आरोग्य — एका स्क्रीनवर.",
    "en": "Meals, prep, shopping, and health — all in one place.",
    "metadata": {},
    "sortOrder": 112
  },
  "today.learning_kicker": {
    "key": "today.learning_kicker",
    "category": "section",
    "mr": "आजच्या ताटात",
    "en": "What are we eating today?",
    "metadata": {},
    "sortOrder": 113
  },
  "today.learning_strong": {
    "key": "today.learning_strong",
    "category": "section",
    "mr": "अन्न → पोषण → शरीर",
    "en": "Food → nutrition → body",
    "metadata": {},
    "sortOrder": 114
  },
  "today.learning_small": {
    "key": "today.learning_small",
    "category": "section",
    "mr": "प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.",
    "en": "Understand what each food contributes to the body.",
    "metadata": {},
    "sortOrder": 115
  },
  "today.btn_learn_nutrition": {
    "key": "today.btn_learn_nutrition",
    "category": "action",
    "mr": "पोषण समजून घ्या",
    "en": "Learn about nutrition",
    "metadata": {},
    "sortOrder": 116
  },
  "today.balance_title": {
    "key": "today.balance_title",
    "category": "section",
    "mr": "जेवणाचा समतोल",
    "en": "Meal balance",
    "metadata": {},
    "sortOrder": 117
  },
  "today.balance_sub": {
    "key": "today.balance_sub",
    "category": "section",
    "mr": "प्रथिने · तंतू · भाज्या · फळे · संपूर्ण धान्य",
    "en": "Protein · Fibre · Vegetables · Fruit · Whole grains",
    "metadata": {},
    "sortOrder": 118
  },
  "today.prep_title": {
    "key": "today.prep_title",
    "category": "section",
    "mr": "आजची तयारी",
    "en": "Today’s prep",
    "metadata": {},
    "sortOrder": 119
  },
  "today.prep_empty": {
    "key": "today.prep_empty",
    "category": "empty_state",
    "mr": "आज कोणतीही तयारी नियोजित नाही.",
    "en": "No prep tasks planned for today.",
    "metadata": {},
    "sortOrder": 120
  },
  "today.shopping_title": {
    "key": "today.shopping_title",
    "category": "section",
    "mr": "खरेदी",
    "en": "Shopping",
    "metadata": {},
    "sortOrder": 121
  },
  "today.shopping_remaining": {
    "key": "today.shopping_remaining",
    "category": "label",
    "mr": "खरेदी करायच्या वस्तू शिल्लक आहेत",
    "en": "items to buy remaining",
    "metadata": {},
    "sortOrder": 122
  },
  "today.btn_open_shopping": {
    "key": "today.btn_open_shopping",
    "category": "action",
    "mr": "खरेदी यादी उघडा →",
    "en": "Open shopping list →",
    "metadata": {},
    "sortOrder": 123
  },
  "today.health_title": {
    "key": "today.health_title",
    "category": "section",
    "mr": "आरोग्य मार्गदर्शन",
    "en": "Health Guide",
    "metadata": {},
    "sortOrder": 124
  },
  "today.health_desc": {
    "key": "today.health_desc",
    "category": "section",
    "mr": "तेल, मीठ, साखर, भाज्या, protein आणि food safety याबद्दल practical guidance.",
    "en": "Practical guidance for oil, salt, sugar, vegetables, protein, and food safety.",
    "metadata": {},
    "sortOrder": 125
  },
  "today.btn_view_health": {
    "key": "today.btn_view_health",
    "category": "action",
    "mr": "आरोग्य मार्गदर्शन पाहा →",
    "en": "View Health Guide →",
    "metadata": {},
    "sortOrder": 126
  },
  "today.food_kicker": {
    "key": "today.food_kicker",
    "category": "section",
    "mr": "आज आपण काय खातोय?",
    "en": "What foods are we eating?",
    "metadata": {},
    "sortOrder": 127
  },
  "today.food_title": {
    "key": "today.food_title",
    "category": "section",
    "mr": "अन्नापासून पोषणाकडे",
    "en": "From food to nutrition",
    "metadata": {},
    "sortOrder": 128
  },
  "today.food_subtitle": {
    "key": "today.food_subtitle",
    "category": "section",
    "mr": "आजच्या recipes मधील प्रमुख पदार्थ आणि त्यांचा nutrition context.",
    "en": "Key foods from today’s recipes and their nutrition context.",
    "metadata": {},
    "sortOrder": 129
  },
  "today.food_empty": {
    "key": "today.food_empty",
    "category": "empty_state",
    "mr": "आजचे food details अजून उपलब्ध नाहीत.",
    "en": "Food details are not available yet.",
    "metadata": {},
    "sortOrder": 130
  },
  "calendar.kicker": {
    "key": "calendar.kicker",
    "category": "section",
    "mr": "कॅलेंडर",
    "en": "CALENDAR",
    "metadata": {},
    "sortOrder": 140
  },
  "calendar.title": {
    "key": "calendar.title",
    "category": "section",
    "mr": "३० दिवसांचे नियोजन",
    "en": "30-Day Meal Planning",
    "metadata": {},
    "sortOrder": 141
  },
  "calendar.subtitle": {
    "key": "calendar.subtitle",
    "category": "section",
    "mr": "महिन्याच्या प्रत्येक दिवशी चार meal slots.",
    "en": "Four meal slots planned for each day of the month.",
    "metadata": {},
    "sortOrder": 142
  },
  "calendar.days_suffix": {
    "key": "calendar.days_suffix",
    "category": "label",
    "mr": "दिवस",
    "en": "days",
    "metadata": {},
    "sortOrder": 143
  },
  "calendar.entries_suffix": {
    "key": "calendar.entries_suffix",
    "category": "label",
    "mr": "जेवण नोंदी",
    "en": "meal entries",
    "metadata": {},
    "sortOrder": 144
  },
  "calendar.meals_suffix": {
    "key": "calendar.meals_suffix",
    "category": "label",
    "mr": "जेवण",
    "en": "meals",
    "metadata": {},
    "sortOrder": 145
  },
  "recipes.kicker": {
    "key": "recipes.kicker",
    "category": "section",
    "mr": "पाककृती",
    "en": "RECIPES",
    "metadata": {},
    "sortOrder": 150
  },
  "recipes.title": {
    "key": "recipes.title",
    "category": "section",
    "mr": "कसे बनवायचे?",
    "en": "How to cook?",
    "metadata": {},
    "sortOrder": 151
  },
  "recipes.subtitle": {
    "key": "recipes.subtitle",
    "category": "section",
    "mr": "कुटुंबासाठी निवडलेल्या पाककृती — साहित्य, वेळ, प्रमाण आणि पोषण नोट्स.",
    "en": "Family recipes with ingredients, cooking time, portions, and nutrition notes.",
    "metadata": {},
    "sortOrder": 152
  },
  "recipes.search_placeholder": {
    "key": "recipes.search_placeholder",
    "category": "label",
    "mr": "पाककृती शोधा...",
    "en": "Search recipes...",
    "metadata": {},
    "sortOrder": 153
  },
  "recipes.btn_add_recipe": {
    "key": "recipes.btn_add_recipe",
    "category": "action",
    "mr": "नवीन पाककृती",
    "en": "Add recipe",
    "metadata": {},
    "sortOrder": 154
  },
  "recipes.count_suffix": {
    "key": "recipes.count_suffix",
    "category": "label",
    "mr": "पाककृती",
    "en": "recipes",
    "metadata": {},
    "sortOrder": 155
  },
  "recipes.detail_kicker": {
    "key": "recipes.detail_kicker",
    "category": "section",
    "mr": "पाककृती",
    "en": "RECIPE",
    "metadata": {},
    "sortOrder": 156
  },
  "recipes.tag_egg": {
    "key": "recipes.tag_egg",
    "category": "label",
    "mr": "अंडे",
    "en": "Egg",
    "metadata": {},
    "sortOrder": 157
  },
  "recipes.tag_veg": {
    "key": "recipes.tag_veg",
    "category": "label",
    "mr": "शाकाहारी",
    "en": "Vegetarian",
    "metadata": {},
    "sortOrder": 158
  },
  "recipes.btn_edit": {
    "key": "recipes.btn_edit",
    "category": "action",
    "mr": "संपादित करा",
    "en": "Edit recipe",
    "metadata": {},
    "sortOrder": 159
  },
  "recipes.servings_suffix": {
    "key": "recipes.servings_suffix",
    "category": "label",
    "mr": "व्यक्ती",
    "en": "servings",
    "metadata": {},
    "sortOrder": 160
  },
  "recipes.heading_ingredients": {
    "key": "recipes.heading_ingredients",
    "category": "section",
    "mr": "साहित्य",
    "en": "Ingredients",
    "metadata": {},
    "sortOrder": 161
  },
  "recipes.legacy_unmapped": {
    "key": "recipes.legacy_unmapped",
    "category": "label",
    "mr": "जुना मजकूर · अजून normalize केलेला नाही",
    "en": "Legacy text · unmapped",
    "metadata": {},
    "sortOrder": 162
  },
  "recipes.heading_method": {
    "key": "recipes.heading_method",
    "category": "section",
    "mr": "कृती पायऱ्या",
    "en": "Method Steps",
    "metadata": {},
    "sortOrder": 163
  },
  "recipes.heading_nutrition": {
    "key": "recipes.heading_nutrition",
    "category": "section",
    "mr": "पोषण समजून घ्या",
    "en": "Nutrition explained",
    "metadata": {},
    "sortOrder": 164
  },
  "recipes.heading_notes": {
    "key": "recipes.heading_notes",
    "category": "section",
    "mr": "टीप",
    "en": "Notes",
    "metadata": {},
    "sortOrder": 165
  },
  "recipes.label_protein": {
    "key": "recipes.label_protein",
    "category": "label",
    "mr": "प्रथिने",
    "en": "Protein",
    "metadata": {},
    "sortOrder": 166
  },
  "recipes.label_fibre": {
    "key": "recipes.label_fibre",
    "category": "label",
    "mr": "तंतू",
    "en": "Fibre",
    "metadata": {},
    "sortOrder": 167
  },
  "recipes.label_oil": {
    "key": "recipes.label_oil",
    "category": "label",
    "mr": "तेल",
    "en": "Oil",
    "metadata": {},
    "sortOrder": 168
  },
  "recipes.modal_edit_title": {
    "key": "recipes.modal_edit_title",
    "category": "section",
    "mr": "पाककृती संपादित करा",
    "en": "Edit Recipe",
    "metadata": {},
    "sortOrder": 169
  },
  "recipes.modal_add_title": {
    "key": "recipes.modal_add_title",
    "category": "section",
    "mr": "नवीन पाककृती जोडा",
    "en": "Add Recipe",
    "metadata": {},
    "sortOrder": 170
  },
  "recipes.form_mr_name": {
    "key": "recipes.form_mr_name",
    "category": "label",
    "mr": "पाककृतीचे मराठी नाव *",
    "en": "Marathi Name *",
    "metadata": {},
    "sortOrder": 171
  },
  "recipes.form_en_name": {
    "key": "recipes.form_en_name",
    "category": "label",
    "mr": "English नाव *",
    "en": "English Name *",
    "metadata": {},
    "sortOrder": 172
  },
  "recipes.form_course": {
    "key": "recipes.form_course",
    "category": "label",
    "mr": "वर्ग",
    "en": "Meal Category",
    "metadata": {},
    "sortOrder": 173
  },
  "recipes.form_role": {
    "key": "recipes.form_role",
    "category": "label",
    "mr": "भूमिका",
    "en": "Meal Role",
    "metadata": {},
    "sortOrder": 174
  },
  "recipes.form_role_main": {
    "key": "recipes.form_role_main",
    "category": "label",
    "mr": "मुख्य पदार्थ",
    "en": "Main",
    "metadata": {},
    "sortOrder": 175
  },
  "recipes.form_role_snack": {
    "key": "recipes.form_role_snack",
    "category": "label",
    "mr": "अल्पोपहार",
    "en": "Snack",
    "metadata": {},
    "sortOrder": 176
  },
  "recipes.form_role_side": {
    "key": "recipes.form_role_side",
    "category": "label",
    "mr": "पूरक पदार्थ",
    "en": "Side",
    "metadata": {},
    "sortOrder": 177
  },
  "recipes.form_time": {
    "key": "recipes.form_time",
    "category": "label",
    "mr": "वेळ",
    "en": "Time",
    "metadata": {},
    "sortOrder": 178
  },
  "recipes.form_servings": {
    "key": "recipes.form_servings",
    "category": "label",
    "mr": "व्यक्ती",
    "en": "Servings",
    "metadata": {},
    "sortOrder": 179
  },
  "recipes.form_cooking_method": {
    "key": "recipes.form_cooking_method",
    "category": "label",
    "mr": "बनवण्याची पद्धत",
    "en": "Cooking Method",
    "metadata": {},
    "sortOrder": 180
  },
  "recipes.form_ingredients": {
    "key": "recipes.form_ingredients",
    "category": "label",
    "mr": "साहित्य (प्रत्येक ओळीवर एक) *",
    "en": "Ingredients (one per line) *",
    "metadata": {},
    "sortOrder": 181
  },
  "recipes.form_method": {
    "key": "recipes.form_method",
    "category": "label",
    "mr": "कृती पायऱ्या (प्रत्येक ओळीवर एक)",
    "en": "Method Steps (one per line)",
    "metadata": {},
    "sortOrder": 182
  },
  "recipes.form_notes": {
    "key": "recipes.form_notes",
    "category": "label",
    "mr": "नोंद",
    "en": "Notes",
    "metadata": {},
    "sortOrder": 183
  },
  "recipes.form_notes_placeholder": {
    "key": "recipes.form_notes_placeholder",
    "category": "label",
    "mr": "उदा. दही किंवा कोशिंबीर सोबत सर्व्ह करा.",
    "en": "e.g. Serve with curd or salad.",
    "metadata": {},
    "sortOrder": 184
  },
  "shopping.kicker": {
    "key": "shopping.kicker",
    "category": "section",
    "mr": "खरेदी",
    "en": "SHOPPING",
    "metadata": {},
    "sortOrder": 190
  },
  "shopping.title": {
    "key": "shopping.title",
    "category": "section",
    "mr": "काय आणायचे?",
    "en": "What to buy?",
    "metadata": {},
    "sortOrder": 191
  },
  "shopping.subtitle": {
    "key": "shopping.subtitle",
    "category": "section",
    "mr": "Meal assignments मधून generated quantities + तुमची manual list.",
    "en": "Quantities generated from meal assignments plus your manual list.",
    "metadata": {},
    "sortOrder": 192
  },
  "shopping.placeholder_mr": {
    "key": "shopping.placeholder_mr",
    "category": "label",
    "mr": "मराठी नाव (उदा. पोहे)",
    "en": "Marathi name (e.g. Pohe)",
    "metadata": {},
    "sortOrder": 193
  },
  "shopping.placeholder_en": {
    "key": "shopping.placeholder_en",
    "category": "label",
    "mr": "English नाव (उदा. Poha)",
    "en": "English name (e.g. Poha)",
    "metadata": {},
    "sortOrder": 194
  },
  "shopping.placeholder_qty": {
    "key": "shopping.placeholder_qty",
    "category": "label",
    "mr": "प्रमाण (उदा. 1 kg)",
    "en": "Quantity (e.g. 1 kg)",
    "metadata": {},
    "sortOrder": 195
  },
  "shopping.cat_staples": {
    "key": "shopping.cat_staples",
    "category": "label",
    "mr": "धान्य",
    "en": "Staples",
    "metadata": {},
    "sortOrder": 196
  },
  "shopping.cat_pulses": {
    "key": "shopping.cat_pulses",
    "category": "label",
    "mr": "कडधान्ये",
    "en": "Pulses & Legumes",
    "metadata": {},
    "sortOrder": 197
  },
  "shopping.cat_dairy": {
    "key": "shopping.cat_dairy",
    "category": "label",
    "mr": "दुग्धजन्य",
    "en": "Dairy",
    "metadata": {},
    "sortOrder": 198
  },
  "shopping.cat_vegetables": {
    "key": "shopping.cat_vegetables",
    "category": "label",
    "mr": "भाज्या",
    "en": "Vegetables",
    "metadata": {},
    "sortOrder": 199
  },
  "shopping.cat_fruits": {
    "key": "shopping.cat_fruits",
    "category": "label",
    "mr": "फळे",
    "en": "Fruits",
    "metadata": {},
    "sortOrder": 200
  },
  "shopping.cat_nuts": {
    "key": "shopping.cat_nuts",
    "category": "label",
    "mr": "बिया आणि सुकामेवा",
    "en": "Nuts & Seeds",
    "metadata": {},
    "sortOrder": 201
  },
  "shopping.cat_spices": {
    "key": "shopping.cat_spices",
    "category": "label",
    "mr": "मसाले",
    "en": "Spices",
    "metadata": {},
    "sortOrder": 202
  },
  "shopping.cat_other": {
    "key": "shopping.cat_other",
    "category": "label",
    "mr": "इतर",
    "en": "Other",
    "metadata": {},
    "sortOrder": 203
  },
  "shopping.btn_add": {
    "key": "shopping.btn_add",
    "category": "action",
    "mr": "जोडा",
    "en": "Add",
    "metadata": {},
    "sortOrder": 204
  },
  "shopping.items_to_buy_suffix": {
    "key": "shopping.items_to_buy_suffix",
    "category": "label",
    "mr": "वस्तू खरेदी बाकी",
    "en": "items to buy",
    "metadata": {},
    "sortOrder": 205
  },
  "shopping.empty": {
    "key": "shopping.empty",
    "category": "empty_state",
    "mr": "खरेदी यादीत कोणतीही वस्तू नाही.",
    "en": "No shopping items.",
    "metadata": {},
    "sortOrder": 206
  },
  "shopping.meal_plan_suffix": {
    "key": "shopping.meal_plan_suffix",
    "category": "label",
    "mr": "जेवण नियोजन",
    "en": "Meal plan",
    "metadata": {},
    "sortOrder": 207
  },
  "shopping.from_assignments": {
    "key": "shopping.from_assignments",
    "category": "label",
    "mr": "नियोजनानुसार",
    "en": "From assignments",
    "metadata": {},
    "sortOrder": 208
  },
  "shopping.need_to_buy": {
    "key": "shopping.need_to_buy",
    "category": "label",
    "mr": "खरेदी करायची",
    "en": "Need to buy",
    "metadata": {},
    "sortOrder": 209
  },
  "shopping.btn_delete": {
    "key": "shopping.btn_delete",
    "category": "action",
    "mr": "काढा",
    "en": "Delete",
    "metadata": {},
    "sortOrder": 210
  },
  "prep.kicker": {
    "key": "prep.kicker",
    "category": "section",
    "mr": "तयारी",
    "en": "PREP",
    "metadata": {},
    "sortOrder": 220
  },
  "prep.title": {
    "key": "prep.title",
    "category": "section",
    "mr": "आधी काय करायचे?",
    "en": "What to prep ahead?",
    "metadata": {},
    "sortOrder": 221
  },
  "prep.subtitle": {
    "key": "prep.subtitle",
    "category": "section",
    "mr": "Batch prep केल्याने weekday cooking सोपी होते.",
    "en": "Batch prep makes weekday cooking easy and stress-free.",
    "metadata": {},
    "sortOrder": 222
  },
  "prep.placeholder_mr": {
    "key": "prep.placeholder_mr",
    "category": "label",
    "mr": "तयारीचे नाव (मराठी)",
    "en": "Prep task (Marathi)",
    "metadata": {},
    "sortOrder": 223
  },
  "prep.placeholder_en": {
    "key": "prep.placeholder_en",
    "category": "label",
    "mr": "Task name (English)",
    "en": "Task name (English)",
    "metadata": {},
    "sortOrder": 224
  },
  "prep.area_meal_prep": {
    "key": "prep.area_meal_prep",
    "category": "label",
    "mr": "जेवणाची तयारी",
    "en": "Meal Prep",
    "metadata": {},
    "sortOrder": 225
  },
  "prep.area_batter": {
    "key": "prep.area_batter",
    "category": "label",
    "mr": "मोड आणणे / पीठ भिजवणे",
    "en": "Batter / Sprouting",
    "metadata": {},
    "sortOrder": 226
  },
  "prep.area_storage": {
    "key": "prep.area_storage",
    "category": "label",
    "mr": "साठवणूक",
    "en": "Storage",
    "metadata": {},
    "sortOrder": 227
  },
  "prep.area_shopping": {
    "key": "prep.area_shopping",
    "category": "label",
    "mr": "खरेदी",
    "en": "Shopping",
    "metadata": {},
    "sortOrder": 228
  },
  "prep.area_review": {
    "key": "prep.area_review",
    "category": "label",
    "mr": "आढावा",
    "en": "Review",
    "metadata": {},
    "sortOrder": 229
  },
  "family.kicker": {
    "key": "family.kicker",
    "category": "section",
    "mr": "कुटुंब",
    "en": "FAMILY",
    "metadata": {},
    "sortOrder": 240
  },
  "family.title": {
    "key": "family.title",
    "category": "section",
    "mr": "कुटुंबातील सदस्य",
    "en": "Family Profiles",
    "metadata": {},
    "sortOrder": 241
  },
  "family.subtitle": {
    "key": "family.subtitle",
    "category": "section",
    "mr": "ही माहिती पोषण संदर्भासाठी आहे; medical prescription नाही.",
    "en": "This information is for household nutritional context; not a clinical prescription.",
    "metadata": {},
    "sortOrder": 242
  },
  "family.years_suffix": {
    "key": "family.years_suffix",
    "category": "label",
    "mr": "वर्षे",
    "en": "years",
    "metadata": {},
    "sortOrder": 243
  },
  "health.kicker": {
    "key": "health.kicker",
    "category": "section",
    "mr": "आरोग्य मार्गदर्शक",
    "en": "HEALTH GUIDE",
    "metadata": {},
    "sortOrder": 250
  },
  "health.title": {
    "key": "health.title",
    "category": "section",
    "mr": "आरोग्य मार्गदर्शन",
    "en": "Practical Health Guidance",
    "metadata": {},
    "sortOrder": 251
  },
  "health.subtitle": {
    "key": "health.subtitle",
    "category": "section",
    "mr": "कुटुंबाच्या रोजच्या निर्णयांसाठी practical guidance. हे general information आहे; medical prescription नाही.",
    "en": "Practical guidance for daily household food decisions. General reference, not a medical prescription.",
    "metadata": {},
    "sortOrder": 252
  },
  "health.notice_title": {
    "key": "health.notice_title",
    "category": "section",
    "mr": "सोपा नियम:",
    "en": "Simple rule:",
    "metadata": {},
    "sortOrder": 253
  },
  "health.notice_body": {
    "key": "health.notice_body",
    "category": "section",
    "mr": "आवश्यकता, समतोल, संयम आणि विविधता. खाली दिलेली आकडेवारी सामान्य मार्गदर्शक आहे, वैयक्तिक वैद्यकीय टार्गेट नाही.",
    "en": "adequacy, balance, moderation and variety. Values below are general references, not individual medical targets.",
    "metadata": {},
    "sortOrder": 254
  },
  "health.filter_all": {
    "key": "health.filter_all",
    "category": "action",
    "mr": "सर्व",
    "en": "All",
    "metadata": {},
    "sortOrder": 255
  },
  "health.classroom_kicker": {
    "key": "health.classroom_kicker",
    "category": "section",
    "mr": "पोषण वर्ग",
    "en": "NUTRITION CLASSROOM",
    "metadata": {},
    "sortOrder": 256
  },
  "health.classroom_title": {
    "key": "health.classroom_title",
    "category": "section",
    "mr": "पोषण समजून घ्या",
    "en": "Understand nutrition",
    "metadata": {},
    "sortOrder": 257
  },
  "health.classroom_subtitle": {
    "key": "health.classroom_subtitle",
    "category": "section",
    "mr": "आपण खात असलेल्या अन्नातून शरीराला काय मिळते, ते काय करते आणि का आवश्यक आहे.",
    "en": "What nutrients each food provides, what they do, and why they matter.",
    "metadata": {},
    "sortOrder": 258
  },
  "health.source_note": {
    "key": "health.source_note",
    "category": "section",
    "mr": "आरोग्य संदर्भ WHO आणि सार्वजनिक आरोग्य मार्गदर्शनातून घेतले आहेत.",
    "en": "Health references are sourced from WHO public-health guidance and are stored with the content record.",
    "metadata": {},
    "sortOrder": 259
  },
  "health.small_action": {
    "key": "health.small_action",
    "category": "label",
    "mr": "आजचा छोटा बदल",
    "en": "Small action",
    "metadata": {},
    "sortOrder": 260
  },
  "health.more_details": {
    "key": "health.more_details",
    "category": "action",
    "mr": "अधिक माहिती",
    "en": "More details",
    "metadata": {},
    "sortOrder": 261
  },
  "health.what_is_it": {
    "key": "health.what_is_it",
    "category": "label",
    "mr": "काय आहे?",
    "en": "What is it?",
    "metadata": {},
    "sortOrder": 262
  },
  "health.where_in_body": {
    "key": "health.where_in_body",
    "category": "label",
    "mr": "शरीरात कुठे वापर?",
    "en": "Where in the body?",
    "metadata": {},
    "sortOrder": 263
  },
  "health.what_does_it_do": {
    "key": "health.what_does_it_do",
    "category": "label",
    "mr": "काय करते?",
    "en": "What does it do?",
    "metadata": {},
    "sortOrder": 264
  },
  "health.why_does_it_matter": {
    "key": "health.why_does_it_matter",
    "category": "label",
    "mr": "का आवश्यक?",
    "en": "Why does it matter?",
    "metadata": {},
    "sortOrder": 265
  },
  "health.food_sources": {
    "key": "health.food_sources",
    "category": "label",
    "mr": "अन्न स्रोत",
    "en": "Food sources",
    "metadata": {},
    "sortOrder": 266
  },
  "health.nutrition_badge": {
    "key": "health.nutrition_badge",
    "category": "label",
    "mr": "पोषण",
    "en": "Nutrition",
    "metadata": {},
    "sortOrder": 267
  },
  "settings.kicker": {
    "key": "settings.kicker",
    "category": "section",
    "mr": "सेटिंग्ज",
    "en": "SETTINGS",
    "metadata": {},
    "sortOrder": 270
  },
  "settings.title": {
    "key": "settings.title",
    "category": "section",
    "mr": "डेटा आणि पर्याय",
    "en": "Data & Appearance",
    "metadata": {},
    "sortOrder": 271
  },
  "settings.subtitle": {
    "key": "settings.subtitle",
    "category": "section",
    "mr": "Shared household settings cloud मध्ये; theme या device वर जतन होतो.",
    "en": "Shared household settings sync to the cloud; preferences save to this device.",
    "metadata": {},
    "sortOrder": 272
  },
  "settings.theme_title": {
    "key": "settings.theme_title",
    "category": "section",
    "mr": "थीम",
    "en": "Theme",
    "metadata": {},
    "sortOrder": 273
  },
  "settings.theme_desc": {
    "key": "settings.theme_desc",
    "category": "section",
    "mr": "प्रत्येक device वर Light, Dark किंवा System निवडा.",
    "en": "Select Light, Dark, or System mode for this device.",
    "metadata": {},
    "sortOrder": 274
  },
  "settings.theme_light": {
    "key": "settings.theme_light",
    "category": "action",
    "mr": "☀️ Light",
    "en": "☀️ Light",
    "metadata": {},
    "sortOrder": 275
  },
  "settings.theme_dark": {
    "key": "settings.theme_dark",
    "category": "action",
    "mr": "🌙 Dark",
    "en": "🌙 Dark",
    "metadata": {},
    "sortOrder": 276
  },
  "settings.theme_system": {
    "key": "settings.theme_system",
    "category": "action",
    "mr": "🖥️ System",
    "en": "🖥️ System",
    "metadata": {},
    "sortOrder": 277
  },
  "settings.lang_title": {
    "key": "settings.lang_title",
    "category": "section",
    "mr": "Language / भाषा",
    "en": "Language",
    "metadata": {},
    "sortOrder": 278
  },
  "settings.lang_desc": {
    "key": "settings.lang_desc",
    "category": "section",
    "mr": "मराठी, English किंवा दोन्ही निवडा.",
    "en": "Choose Marathi, English, or Bilingual mode.",
    "metadata": {},
    "sortOrder": 279
  },
  "settings.lang_mr": {
    "key": "settings.lang_mr",
    "category": "action",
    "mr": "मराठी",
    "en": "Marathi",
    "metadata": {},
    "sortOrder": 280
  },
  "settings.lang_en": {
    "key": "settings.lang_en",
    "category": "action",
    "mr": "English",
    "en": "English",
    "metadata": {},
    "sortOrder": 281
  },
  "settings.lang_both": {
    "key": "settings.lang_both",
    "category": "action",
    "mr": "मराठी + English",
    "en": "Bilingual",
    "metadata": {},
    "sortOrder": 282
  },
  "settings.lang_both_short": {
    "key": "settings.lang_both_short",
    "category": "action",
    "mr": "दोन्ही",
    "en": "Both",
    "metadata": {},
    "sortOrder": 283
  },
  "settings.oil_title": {
    "key": "settings.oil_title",
    "category": "section",
    "mr": "तेल नियोजन",
    "en": "Oil planning",
    "metadata": {},
    "sortOrder": 284
  },
  "settings.oil_desc": {
    "key": "settings.oil_desc",
    "category": "section",
    "mr": "Stock आणि monthly planning target वेगळे ठेवा. हा household planning tool आहे; medical limit नाही.",
    "en": "Keep stock and monthly target separate. This is a household tool, not a clinical limit.",
    "metadata": {},
    "sortOrder": 285
  },
  "settings.label_oil_stock": {
    "key": "settings.label_oil_stock",
    "category": "label",
    "mr": "सध्याचा साठा (ml)",
    "en": "Current stock (ml)",
    "metadata": {},
    "sortOrder": 286
  },
  "settings.label_oil_target": {
    "key": "settings.label_oil_target",
    "category": "label",
    "mr": "मासिक टार्गेट (ml)",
    "en": "Monthly target (ml)",
    "metadata": {},
    "sortOrder": 287
  },
  "settings.label_household_size": {
    "key": "settings.label_household_size",
    "category": "label",
    "mr": "कुटुंबातील व्यक्ती संख्या",
    "en": "Household size",
    "metadata": {},
    "sortOrder": 288
  },
  "settings.oil_advice_heading": {
    "key": "settings.oil_advice_heading",
    "category": "section",
    "mr": "कुठे कमी करायचे?",
    "en": "Where to moderate?",
    "metadata": {},
    "sortOrder": 289
  },
  "settings.oil_advice_text": {
    "key": "settings.oil_advice_text",
    "category": "section",
    "mr": "डीप-फ्राय, जास्त तेलाचा तडका आणि खूप तेलकट gravy आधी कमी करा. मोजून तेल वापरा; योग्य ठिकाणी भाजणे, वाफवणे किंवा pressure cooking वापरा.",
    "en": "Reduce deep frying, heavy tadka, and oily gravies. Measure oil, and prefer steaming, roasting, or pressure cooking.",
    "metadata": {},
    "sortOrder": 290
  },
  "settings.btn_save_settings": {
    "key": "settings.btn_save_settings",
    "category": "action",
    "mr": "Settings जतन करा",
    "en": "Save settings",
    "metadata": {},
    "sortOrder": 291
  },
  "settings.freq_title": {
    "key": "settings.freq_title",
    "category": "section",
    "mr": "घरगुती नियोजन प्राधान्ये",
    "en": "Household Planning Preferences",
    "metadata": {},
    "sortOrder": 292
  },
  "settings.freq_desc": {
    "key": "settings.freq_desc",
    "category": "section",
    "mr": "पनीर मासिक वारंवारता मर्यादा (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).",
    "en": "Paneer monthly frequency limit (household planning preference, not medical advice).",
    "metadata": {},
    "sortOrder": 293
  },
  "settings.paneer_planned_label": {
    "key": "settings.paneer_planned_label",
    "category": "label",
    "mr": "पनीर वापर (या महिन्यात):",
    "en": "Paneer planned (this month):",
    "metadata": {},
    "sortOrder": 294
  },
  "settings.paneer_limit_desc": {
    "key": "settings.paneer_limit_desc",
    "category": "section",
    "mr": "कॅलेंडर महिन्यात जास्तीत जास्त ५ वेळा पनीरचे जेवण. मर्यादा संपल्यावर इतर शाकाहारी पर्यायांना प्राधान्य दिले जाते.",
    "en": "Maximum 5 paneer meals per calendar month. When reached, other vegetarian alternates are preferred.",
    "metadata": {},
    "sortOrder": 295
  },
  "settings.backup_title": {
    "key": "settings.backup_title",
    "category": "section",
    "mr": "बॅकअप",
    "en": "Backup",
    "metadata": {},
    "sortOrder": 296
  },
  "settings.backup_desc": {
    "key": "settings.backup_desc",
    "category": "section",
    "mr": "दर काही दिवसांनी JSON backup डाउनलोड करा. नवीन फोनवर Import करून data परत आणता येईल.",
    "en": "Download JSON backup regularly. Restore on any new device.",
    "metadata": {},
    "sortOrder": 297
  },
  "settings.btn_export": {
    "key": "settings.btn_export",
    "category": "action",
    "mr": "Backup डाउनलोड",
    "en": "Export Backup",
    "metadata": {},
    "sortOrder": 298
  },
  "settings.btn_import": {
    "key": "settings.btn_import",
    "category": "action",
    "mr": "Backup Import",
    "en": "Import Backup",
    "metadata": {},
    "sortOrder": 299
  },
  "settings.cloud_title": {
    "key": "settings.cloud_title",
    "category": "section",
    "mr": "क्लाउड जतन",
    "en": "Cloud sync",
    "metadata": {},
    "sortOrder": 300
  },
  "settings.cloud_desc": {
    "key": "settings.cloud_desc",
    "category": "section",
    "mr": "Login/OTP लागत नाही. प्रत्येक device ला anonymous session मिळतो आणि shared household data Supabase मध्ये sync होतो.",
    "en": "No login/OTP required. Each device receives an anonymous session and shared household data syncs to Supabase.",
    "metadata": {},
    "sortOrder": 301
  },
  "settings.cloud_note": {
    "key": "settings.cloud_note",
    "category": "section",
    "mr": "Health content Supabase मधून येतो; content बदलण्यासाठी frontend code बदलण्याची गरज नाही.",
    "en": "Health content comes from Supabase; content updates require no code changes.",
    "metadata": {},
    "sortOrder": 302
  },
  "settings.starter_title": {
    "key": "settings.starter_title",
    "category": "section",
    "mr": "सुरुवातीचा डेटा",
    "en": "Starter data",
    "metadata": {},
    "sortOrder": 303
  },
  "settings.starter_desc": {
    "key": "settings.starter_desc",
    "category": "section",
    "mr": "Starter calendar, recipes, shopping आणि prep पुन्हा आणा. Local edits replace होतील.",
    "en": "Restore starter calendar, recipes, shopping, and prep. Replaces local changes.",
    "metadata": {},
    "sortOrder": 304
  },
  "settings.btn_reset": {
    "key": "settings.btn_reset",
    "category": "action",
    "mr": "डेटा रीसेट करा",
    "en": "Reset starter data",
    "metadata": {},
    "sortOrder": 305
  },
  "meal.view_recipe": {
    "key": "meal.view_recipe",
    "category": "action",
    "mr": "पाककृती पाहा →",
    "en": "View recipe →",
    "metadata": {},
    "sortOrder": 310
  },
  "meal.change_slot": {
    "key": "meal.change_slot",
    "category": "action",
    "mr": "बदला:",
    "en": "Change slot:",
    "metadata": {},
    "sortOrder": 311
  },
  "meal.family_badge_title": {
    "key": "meal.family_badge_title",
    "category": "label",
    "mr": "कुटुंब",
    "en": "Family",
    "metadata": {},
    "sortOrder": 312
  },
  "meal.family_shared_desc": {
    "key": "meal.family_shared_desc",
    "category": "label",
    "mr": "सदस्य · संपूर्ण कुटुंब एकच जेवण",
    "en": "members · shared meal",
    "metadata": {},
    "sortOrder": 313
  },
  "meal.alternates_title": {
    "key": "meal.alternates_title",
    "category": "label",
    "mr": "सदस्य बदल",
    "en": "Member changes",
    "metadata": {},
    "sortOrder": 314
  },
  "meal.no_alternate": {
    "key": "meal.no_alternate",
    "category": "label",
    "mr": "पर्याय उपलब्ध नाही",
    "en": "No alternate available",
    "metadata": {},
    "sortOrder": 315
  },
  "meal.alternate_label": {
    "key": "meal.alternate_label",
    "category": "label",
    "mr": "पर्याय",
    "en": "Alternate",
    "metadata": {},
    "sortOrder": 316
  },
  "meal.override_tag": {
    "key": "meal.override_tag",
    "category": "label",
    "mr": "बदल",
    "en": "Override",
    "metadata": {},
    "sortOrder": 317
  },
  "meal.frequency_tag": {
    "key": "meal.frequency_tag",
    "category": "label",
    "mr": "पनीर मर्यादा प्राधान्य",
    "en": "Frequency preference",
    "metadata": {},
    "sortOrder": 318
  },
  "meal.frequency_tooltip": {
    "key": "meal.frequency_tooltip",
    "category": "label",
    "mr": "पनीर मासिक मर्यादा (५/महिना) पाळण्यासाठी पर्याय",
    "en": "Selected alternate respecting monthly paneer limit",
    "metadata": {},
    "sortOrder": 319
  },
  "meal.auto_alternate_tag": {
    "key": "meal.auto_alternate_tag",
    "category": "label",
    "mr": "ऑटो पर्याय",
    "en": "Auto alternate",
    "metadata": {},
    "sortOrder": 320
  },
  "meal.freq_warning": {
    "key": "meal.freq_warning",
    "category": "label",
    "mr": "कुटुंब नियोजन प्राधान्यांच्या मर्यादेत योग्य शाकाहारी पर्याय उपलब्ध नाही",
    "en": "No suitable alternate within household frequency preferences",
    "metadata": {},
    "sortOrder": 321
  },
  "meal.editor_summary": {
    "key": "meal.editor_summary",
    "category": "action",
    "mr": "सदस्यांचे जेवण बदला",
    "en": "Change for this day",
    "metadata": {},
    "sortOrder": 322
  },
  "meal.change_label": {
    "key": "meal.change_label",
    "category": "label",
    "mr": "आजचा बदल",
    "en": "Change for this day",
    "metadata": {},
    "sortOrder": 323
  },
  "meal.revert_label": {
    "key": "meal.revert_label",
    "category": "action",
    "mr": "मूळ निवडीवर परत या",
    "en": "Revert to automatic",
    "metadata": {},
    "sortOrder": 324
  },
  "meal.balance_mini_title": {
    "key": "meal.balance_mini_title",
    "category": "label",
    "mr": "जेवणाचा समतोल",
    "en": "Meal balance",
    "metadata": {},
    "sortOrder": 325
  },
  "meal.prev_day": {
    "key": "meal.prev_day",
    "category": "action",
    "mr": "मागील दिवस",
    "en": "Previous day",
    "metadata": {},
    "sortOrder": 326
  },
  "meal.next_day": {
    "key": "meal.next_day",
    "category": "action",
    "mr": "पुढील दिवस",
    "en": "Next day",
    "metadata": {},
    "sortOrder": 327
  },
  "meal.back": {
    "key": "meal.back",
    "category": "action",
    "mr": "मागे",
    "en": "Back",
    "metadata": {},
    "sortOrder": 328
  },
  "balance.protein_source": {
    "key": "balance.protein_source",
    "category": "balance",
    "mr": "प्रथिनांचा स्रोत",
    "en": "Protein source",
    "metadata": {},
    "sortOrder": 330
  },
  "balance.vegetable_component": {
    "key": "balance.vegetable_component",
    "category": "balance",
    "mr": "भाजीपाला घटक",
    "en": "Vegetable component",
    "metadata": {},
    "sortOrder": 331
  },
  "balance.pulse_legume": {
    "key": "balance.pulse_legume",
    "category": "balance",
    "mr": "डाळ / कडधान्य",
    "en": "Pulse / legume",
    "metadata": {},
    "sortOrder": 332
  },
  "balance.whole_grain": {
    "key": "balance.whole_grain",
    "category": "balance",
    "mr": "पूर्ण धान्याचा घटक",
    "en": "Whole-grain component",
    "metadata": {},
    "sortOrder": 333
  },
  "balance.fruit_component": {
    "key": "balance.fruit_component",
    "category": "balance",
    "mr": "फळांचा घटक",
    "en": "Fruit component",
    "metadata": {},
    "sortOrder": 334
  },
  "balance.oil_consideration": {
    "key": "balance.oil_consideration",
    "category": "balance",
    "mr": "तेलाचा विचार",
    "en": "Oil consideration",
    "metadata": {},
    "sortOrder": 335
  },
  "oil.target_kicker": {
    "key": "oil.target_kicker",
    "category": "oil",
    "mr": "घरचे नियोजन",
    "en": "HOUSEHOLD TARGET",
    "metadata": {},
    "sortOrder": 340
  },
  "oil.target_title": {
    "key": "oil.target_title",
    "category": "oil",
    "mr": "खाद्यतेल नियोजन",
    "en": "Cooking Oil Planning",
    "metadata": {},
    "sortOrder": 341
  },
  "oil.stock_suffix": {
    "key": "oil.stock_suffix",
    "category": "oil",
    "mr": "साठा",
    "en": "stock",
    "metadata": {},
    "sortOrder": 342
  },
  "oil.within_target": {
    "key": "oil.within_target",
    "category": "oil",
    "mr": "टार्गेटच्या आत आहे",
    "en": "Within target",
    "metadata": {},
    "sortOrder": 343
  },
  "oil.stock_above": {
    "key": "oil.stock_above",
    "category": "oil",
    "mr": "साठा जास्त आहे",
    "en": "Stock above target",
    "metadata": {},
    "sortOrder": 344
  },
  "oil.monthly_desc": {
    "key": "oil.monthly_desc",
    "category": "oil",
    "mr": "मासिक नियोजन टार्गेट",
    "en": "monthly planning target",
    "metadata": {},
    "sortOrder": 345
  },
  "oil.household_label": {
    "key": "oil.household_label",
    "category": "oil",
    "mr": "घरगुती",
    "en": "household",
    "metadata": {},
    "sortOrder": 346
  },
  "oil.btn_change_target": {
    "key": "oil.btn_change_target",
    "category": "action",
    "mr": "Target बदलायचा? →",
    "en": "Change target? →",
    "metadata": {},
    "sortOrder": 347
  },
  "tts.listen": {
    "key": "tts.listen",
    "category": "action",
    "mr": "ऐका",
    "en": "Listen",
    "metadata": {},
    "sortOrder": 350
  },
  "tts.stop": {
    "key": "tts.stop",
    "category": "action",
    "mr": "थांबवा",
    "en": "Stop",
    "metadata": {},
    "sortOrder": 351
  },
  "tts.speech_today_plate": {
    "key": "tts.speech_today_plate",
    "category": "tts",
    "mr": "आजच्या ताटात:",
    "en": "What are we eating today:",
    "metadata": {},
    "sortOrder": 352
  },
  "tts.speech_today_learn": {
    "key": "tts.speech_today_learn",
    "category": "tts",
    "mr": "अन्न → पोषण → शरीर. प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.",
    "en": "Food to nutrition to body. Understand what each food contributes to the body.",
    "metadata": {},
    "sortOrder": 353
  },
  "tts.speech_prep_time": {
    "key": "tts.speech_prep_time",
    "category": "tts",
    "mr": "तयारीची वेळ:",
    "en": "Cooking time:",
    "metadata": {},
    "sortOrder": 354
  },
  "tts.speech_for_servings": {
    "key": "tts.speech_for_servings",
    "category": "tts",
    "mr": "व्यक्तींसाठी.",
    "en": "servings.",
    "metadata": {},
    "sortOrder": 355
  },
  "tts.speech_ingredients": {
    "key": "tts.speech_ingredients",
    "category": "tts",
    "mr": "साहित्य:",
    "en": "Ingredients:",
    "metadata": {},
    "sortOrder": 356
  },
  "tts.speech_nutrition": {
    "key": "tts.speech_nutrition",
    "category": "tts",
    "mr": "पोषण:",
    "en": "Nutrition:",
    "metadata": {},
    "sortOrder": 357
  },
  "tts.speech_note": {
    "key": "tts.speech_note",
    "category": "tts",
    "mr": "नोंद:",
    "en": "Note:",
    "metadata": {},
    "sortOrder": 358
  },
  "tts.speech_nutrition_details": {
    "key": "tts.speech_nutrition_details",
    "category": "tts",
    "mr": "पोषण माहिती:",
    "en": "Nutrition details:",
    "metadata": {},
    "sortOrder": 359
  },
  "btn.close": {
    "key": "btn.close",
    "category": "action",
    "mr": "बंद करा",
    "en": "Close",
    "metadata": {},
    "sortOrder": 370
  },
  "btn.cancel": {
    "key": "btn.cancel",
    "category": "action",
    "mr": "रद्द करा",
    "en": "Cancel",
    "metadata": {},
    "sortOrder": 371
  },
  "btn.save": {
    "key": "btn.save",
    "category": "action",
    "mr": "जतन करा",
    "en": "Save",
    "metadata": {},
    "sortOrder": 372
  },
  "msg.saved": {
    "key": "msg.saved",
    "category": "message",
    "mr": "जतन झाले · Saved",
    "en": "Saved",
    "metadata": {},
    "sortOrder": 373
  },
  "msg.cloud_sync_failed": {
    "key": "msg.cloud_sync_failed",
    "category": "message",
    "mr": "Cloud sync failed / सेटिंग्ज क्लाउडमध्ये जतन होऊ शकली नाही",
    "en": "Cloud sync failed",
    "metadata": {},
    "sortOrder": 374
  },
  "msg.cloud_sync_error": {
    "key": "msg.cloud_sync_error",
    "category": "message",
    "mr": "Cloud sync error · क्लाउड जतन अयशस्वी",
    "en": "Cloud sync error",
    "metadata": {},
    "sortOrder": 375
  },
  "msg.cloud_sync_unavailable": {
    "key": "msg.cloud_sync_unavailable",
    "category": "message",
    "mr": "Cloud sync unavailable · क्लाउड sync उपलब्ध नाही. Local data चालू आहे.",
    "en": "Cloud sync unavailable. Local data active.",
    "metadata": {},
    "sortOrder": 376
  },
  "msg.recipe_detail_soon": {
    "key": "msg.recipe_detail_soon",
    "category": "message",
    "mr": "पाककृती तपशील लवकरच उपलब्ध होईल",
    "en": "Recipe detail coming soon",
    "metadata": {},
    "sortOrder": 377
  },
  "msg.recipe_name_required": {
    "key": "msg.recipe_name_required",
    "category": "message",
    "mr": "नाव आवश्यक आहे",
    "en": "Recipe name is required",
    "metadata": {},
    "sortOrder": 378
  },
  "msg.recipe_saved": {
    "key": "msg.recipe_saved",
    "category": "message",
    "mr": "पाककृती जतन झाली",
    "en": "Recipe saved",
    "metadata": {},
    "sortOrder": 379
  },
  "msg.meal_updated": {
    "key": "msg.meal_updated",
    "category": "message",
    "mr": "वेळापत्रक बदलले",
    "en": "Meal updated",
    "metadata": {},
    "sortOrder": 380
  },
  "msg.added_to_shopping": {
    "key": "msg.added_to_shopping",
    "category": "message",
    "mr": "खरेदी यादीत जोडले",
    "en": "Added to shopping",
    "metadata": {},
    "sortOrder": 381
  },
  "msg.item_removed": {
    "key": "msg.item_removed",
    "category": "message",
    "mr": "वस्तू काढली",
    "en": "Item removed",
    "metadata": {},
    "sortOrder": 382
  },
  "msg.prep_task_required": {
    "key": "msg.prep_task_required",
    "category": "message",
    "mr": "तयारीचे नाव आवश्यक आहे",
    "en": "Prep task is required",
    "metadata": {},
    "sortOrder": 383
  },
  "msg.prep_task_added": {
    "key": "msg.prep_task_added",
    "category": "message",
    "mr": "तयारी जोडली",
    "en": "Prep task added",
    "metadata": {},
    "sortOrder": 384
  },
  "msg.prep_task_removed": {
    "key": "msg.prep_task_removed",
    "category": "message",
    "mr": "तयारी काढली",
    "en": "Prep task removed",
    "metadata": {},
    "sortOrder": 385
  },
  "msg.settings_saved": {
    "key": "msg.settings_saved",
    "category": "message",
    "mr": "घरची settings जतन झाली",
    "en": "Household settings saved",
    "metadata": {},
    "sortOrder": 386
  },
  "msg.backup_restored": {
    "key": "msg.backup_restored",
    "category": "message",
    "mr": "बॅकअप परत आला",
    "en": "Backup restored",
    "metadata": {},
    "sortOrder": 387
  },
  "msg.invalid_backup_file": {
    "key": "msg.invalid_backup_file",
    "category": "message",
    "mr": "चुकीची बॅकअप फाइल",
    "en": "Invalid backup file",
    "metadata": {},
    "sortOrder": 388
  },
  "msg.confirm_reset_starter": {
    "key": "msg.confirm_reset_starter",
    "category": "message",
    "mr": "सर्व स्थानिक बदल काढायचे?",
    "en": "Reset local changes?",
    "metadata": {},
    "sortOrder": 389
  }
};

function mapFrequencyRules(rows) {
  return (rows || []).filter(x => x.active !== false).map(x => ({
    id: x.id,
    key: x.rule_key || x.key,
    ingredientKey: x.ingredient_key || x.ingredientKey,
    maxPerCalendarMonth: Number(x.max_per_calendar_month ?? x.maxPerCalendarMonth ?? x.max_times_per_month ?? 5),
    period: x.period || 'calendar-month',
    ruleType: x.rule_type || x.ruleType || 'ingredient_frequency',
    preferenceType: x.preference_type || x.preferenceType || 'household_planning',
    label: x.label,
    marathiLabel: x.marathi_label || x.marathiLabel,
    description: x.description,
    marathiDescription: x.marathi_description || x.marathiDescription
  }));
}


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

const DEFAULT_FREQUENCY_RULES = [
  {
    key: 'paneer-monthly-frequency',
    ingredientKey: 'paneer',
    maxPerCalendarMonth: 5,
    period: 'calendar-month',
    ruleType: 'ingredient_frequency',
    preferenceType: 'household_planning',
    label: 'Paneer monthly planning limit',
    marathiLabel: 'पनीर मासिक नियोजन मर्यादा',
    description: 'Paneer should be planned no more than 5 times per calendar month (household planning preference, not a medical restriction).',
    marathiDescription: 'एका कॅलेंडर महिन्यात ५ पेक्षा जास्त वेळा पनीरचे जेवण नको (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).'
  }
];

function recipeContainsIngredient(recipe, ingredientKey = 'paneer') {
  if (!recipe) return false;
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
    const hasKey = recipe.ingredients.some(ing => {
      if (typeof ing === 'string') {
        const s = ing.toLowerCase();
        const aliases = ingredientKey === 'paneer' ? ['paneer', 'पनीर'] : [ingredientKey];
        return aliases.some(a => s.includes(a.toLowerCase()));
      }
      const k = ing.ingredientKey || ing.canonicalKey;
      return k === ingredientKey;
    });
    if (hasKey) return true;
  }
  const legacy = recipe.legacyIngredients || (Array.isArray(recipe.ingredients) && typeof recipe.ingredients[0] === 'string' ? recipe.ingredients : []);
  const aliases = ingredientKey === 'paneer' ? ['paneer', 'पनीर'] : [ingredientKey];
  if (Array.isArray(legacy) && legacy.some(line => {
    const s = String(line).toLowerCase();
    return aliases.some(alias => s.includes(alias.toLowerCase()));
  })) {
    return true;
  }
  const name = String(recipe.name || '').toLowerCase();
  const mr = String(recipe.mr || '').toLowerCase();
  if (ingredientKey === 'paneer') {
    if (name.includes('paneer') || mr.includes('पनीर')) return true;
  }
  return false;
}

function getMealDate(mealEntryId, meals = [], assignment = null) {
  if (assignment?.date) return assignment.date;
  const m = (meals || []).find(x => x.id === mealEntryId);
  if (m?.date) return m.date;
  if (typeof mealEntryId === 'string') {
    const match = mealEntryId.match(/\b\d{4}-\d{2}(-\d{2})?\b/);
    if (match) return match[0];
  }
  return null;
}

function getMealMonth(mealEntryId, meals = [], assignment = null) {
  const date = getMealDate(mealEntryId, meals, assignment);
  if (date) return date.slice(0, 7);
  if (typeof mealEntryId === 'string') {
    const match = mealEntryId.match(/\b\d{4}-\d{2}\b/);
    if (match) return match[0];
  }
  return null;
}

function countIngredientMonthlyOccurrences({
  assignments = [],
  recipes = [],
  meals = [],
  ingredientKey = 'paneer',
  month = null,
  excludeMealEntryId = null
} = {}) {
  const mealEntriesWithIngredient = new Set();

  for (const a of assignments || []) {
    if (!a.recipeId) continue;
    const mealEntryId = a.mealEntryId;
    if (!mealEntryId) continue;
    if (excludeMealEntryId && mealEntryId === excludeMealEntryId) continue;

    if (month) {
      const mealMonth = getMealMonth(mealEntryId, meals, a);
      if (mealMonth && mealMonth !== month) continue;
    }

    const recipe = (recipes || []).find(r => r.id === a.recipeId || r.name === a.recipeId);
    if (recipe && recipeContainsIngredient(recipe, ingredientKey)) {
      mealEntriesWithIngredient.add(mealEntryId);
    }
  }

  return mealEntriesWithIngredient.size;
}

function getHouseholdFrequencyStatus({
  assignments = [],
  recipes = [],
  meals = [],
  month = null,
  frequencyRules = DEFAULT_FREQUENCY_RULES
} = {}) {
  return (frequencyRules || []).map(rule => {
    const ingredientKey = rule.ingredientKey || 'paneer';
    const currentOccurrences = countIngredientMonthlyOccurrences({
      assignments,
      recipes,
      meals,
      ingredientKey,
      month
    });
    const maxPerCalendarMonth = Number(rule.maxPerCalendarMonth ?? 5);
    const remaining = Math.max(0, maxPerCalendarMonth - currentOccurrences);
    const limitReached = currentOccurrences >= maxPerCalendarMonth;
    return {
      ...rule,
      month: month || new Date().toISOString().slice(0, 7),
      currentOccurrences,
      maxPerCalendarMonth,
      remaining,
      limitReached,
      preferenceType: 'household_planning'
    };
  });
}

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

function selectAutomaticAlternate(ineligibleRecipe, member, candidateRecipes, options = {}) {
  const allRanked = rankAlternateRecipes(ineligibleRecipe, member, candidateRecipes).filter(r => r.id !== ineligibleRecipe.id);
  if (!allRanked.length) {
    return {
      recipe: null,
      reason: 'No suitable existing vegetarian alternate is available.'
    };
  }

  const frequencyRules = options.frequencyRules || DEFAULT_FREQUENCY_RULES;
  const assignments = options.assignments || [];
  const meals = options.meals || [];
  const mealEntry = options.mealEntry || null;
  const targetDate = options.targetDate || mealEntry?.date || getMealDate(mealEntry?.id, meals) || null;
  const targetMonth = options.month || (targetDate ? targetDate.slice(0, 7) : null);
  const currentMealEntryId = mealEntry?.id || options.mealEntryId || null;

  let frequencyViolationAttempted = false;

  for (const candidate of allRanked) {
    let candidateExceeds = false;

    for (const rule of frequencyRules) {
      if (rule.ruleType === 'ingredient_frequency' && rule.ingredientKey) {
        if (recipeContainsIngredient(candidate, rule.ingredientKey)) {
          let currentOccurrences;
          if (typeof options.currentOccurrences === 'number') {
            currentOccurrences = options.currentOccurrences;
          } else {
            currentOccurrences = countIngredientMonthlyOccurrences({
              assignments,
              recipes: options.recipes || candidateRecipes,
              meals,
              ingredientKey: rule.ingredientKey,
              month: targetMonth,
              excludeMealEntryId: currentMealEntryId
            });
          }

          const limit = Number(rule.maxPerCalendarMonth ?? 5);
          const alreadyHasInCurrentMeal = currentMealEntryId && (assignments || []).some(a =>
            a.mealEntryId === currentMealEntryId &&
            a.memberId !== member.id &&
            recipeContainsIngredient((options.recipes || candidateRecipes).find(r => r.id === a.recipeId || r.name === a.recipeId), rule.ingredientKey)
          );

          const prospectiveCount = alreadyHasInCurrentMeal ? currentOccurrences : currentOccurrences + 1;
          if (prospectiveCount > limit) {
            candidateExceeds = true;
            frequencyViolationAttempted = true;
            break;
          }
        }
      }
    }

    if (!candidateExceeds) {
      return {
        recipe: candidate,
        reason: frequencyViolationAttempted
          ? 'Non-paneer vegetarian alternate selected to respect household monthly frequency preference.'
          : 'Existing suitable vegetarian recipe selected by the alternate ranking rules.',
        frequencyConstraintApplied: frequencyViolationAttempted
      };
    }
  }

  return {
    recipe: null,
    reason: frequencyViolationAttempted
      ? 'No suitable vegetarian alternate available within household frequency preferences.'
      : 'No suitable existing vegetarian alternate is available.',
    frequencyConstraintViolated: frequencyViolationAttempted
  };
}

function buildAutomaticAssignments(mealEntry, members, recipes, rules = DEFAULT_DIETARY_RULES, options = {}) {
  const primary = (recipes || []).find(r => r.id === mealEntry.recipeId || r.name === mealEntry.title);
  return (members || []).map(member => {
    const eligibility = evaluateRecipeEligibility(member,primary,rules);
    if (eligibility.eligible) return {id:`${mealEntry.id}:${member.id}`,mealEntryId:mealEntry.id,memberId:member.id,recipeId:primary?.id || null,portionFactor:1,assignmentSource:'automatic',automaticRecipeId:primary?.id || null,overrideRecipeId:null,overrideReason:null};
    const alternate = selectAutomaticAlternate(primary,member,recipes,{...options, mealEntry});
    return {id:`${mealEntry.id}:${member.id}`,mealEntryId:mealEntry.id,memberId:member.id,recipeId:alternate.recipe?.id || null,portionFactor:1,assignmentSource:'automatic',automaticRecipeId:alternate.recipe?.id || null,overrideRecipeId:null,overrideReason:alternate.reason,frequencyConstraintApplied:alternate.frequencyConstraintApplied||false};
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

const RECIPE_HEAVINESS = Object.freeze({
  LIGHT: 'light',
  MODERATE: 'moderate',
  SUBSTANTIAL: 'substantial',
  HEAVY: 'heavy'
});

const MEAL_FORMS = Object.freeze({
  CHILLA: 'chilla',
  DOSA_UTTAPAM_PANCAKE: 'dosa_uttapam_pancake',
  POHA: 'poha',
  THALIPEETH: 'thalipeeth',
  DASHMI: 'dashmi',
  HANDVO: 'handvo',
  KHICHDI: 'khichdi',
  USAL: 'usal',
  BHURJI: 'bhurji',
  CURRY_SABJI: 'curry_sabji',
  CHAAT: 'chaat',
  QUICK_SNACK_BOWL: 'quick_snack_bowl',
  OTHER: 'other'
});

const PRIMARY_GRAINS = Object.freeze({
  WHEAT: 'wheat',
  JOWAR: 'jowar',
  RICE: 'rice',
  POHA: 'poha',
  RAGI: 'ragi',
  PAV: 'pav',
  NONE: 'none',
  OTHER: 'other'
});

const PRIMARY_PROTEIN_SOURCES = Object.freeze({
  LEGUME: 'legume',
  DAIRY_PANEER: 'dairy_paneer',
  DAIRY_CURD_MILK: 'dairy_curd_milk',
  EGG: 'egg',
  SOY_TOFU: 'soy_tofu',
  NUTS_SEEDS: 'nuts_seeds',
  NONE: 'none'
});

function enrichRecipeMetadata(recipe) {
  if (!recipe) return null;
  const name = String(recipe.name || '').trim();
  const mr = String(recipe.mr || '').trim();
  const course = String(recipe.course || recipe.mealCategory || '').trim();
  const ingLines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingText = ingLines.map(x => typeof x === 'string' ? x : (x.displayText || x.ingredientKey || '')).join(' ').toLowerCase();
  const allText = `${name} ${mr} ${course} ${ingText} ${(recipe.note || '')} ${(recipe.method || []).join(' ')}`.toLowerCase();

  const containsPaneer = allText.includes('paneer') || allText.includes('पनीर');
  const containsEgg = allText.includes('egg') || allText.includes('अंडे') || allText.includes('अंडी');
  const containsSoy = allText.includes('tofu') || allText.includes('soy') || allText.includes('टोफू') || allText.includes('सोया');

  // Primary protein source
  let primaryProteinSource = PRIMARY_PROTEIN_SOURCES.NONE;
  if (containsEgg) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.EGG;
  } else if (containsPaneer) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.DAIRY_PANEER;
  } else if (containsSoy) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.SOY_TOFU;
  } else if (allText.includes('chana') || allText.includes('chole') || allText.includes('besan') || allText.includes('moong') || allText.includes('matki') || allText.includes('rajma') || allText.includes('lobia') || allText.includes('dal') || allText.includes('मूग') || allText.includes('हरभरा') || allText.includes('छोले') || allText.includes('मटकी') || allText.includes('राजमा') || allText.includes('चवळी')) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.LEGUME;
  } else if (allText.includes('curd') || allText.includes('milk') || allText.includes('buttermilk') || allText.includes('दही') || allText.includes('दूध') || allText.includes('ताक')) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.DAIRY_CURD_MILK;
  } else if (allText.includes('peanut') || allText.includes('flax') || allText.includes('pumpkin seed') || allText.includes('शेंगदाण')) {
    primaryProteinSource = PRIMARY_PROTEIN_SOURCES.NUTS_SEEDS;
  }

  // Primary grain
  let primaryGrain = PRIMARY_GRAINS.NONE;
  if (allText.includes('roti') || allText.includes('atta') || allText.includes('wheat') || allText.includes('पोळी') || allText.includes('dashmi')) {
    primaryGrain = PRIMARY_GRAINS.WHEAT;
  } else if (allText.includes('jowar') || allText.includes('bhakri') || allText.includes('ज्वारी')) {
    primaryGrain = PRIMARY_GRAINS.JOWAR;
  } else if (allText.includes('poha') || allText.includes('पोहे')) {
    primaryGrain = PRIMARY_GRAINS.POHA;
  } else if (allText.includes('ragi') || allText.includes('नाचणी')) {
    primaryGrain = PRIMARY_GRAINS.RAGI;
  } else if (allText.includes('pav') || allText.includes('पाव')) {
    primaryGrain = PRIMARY_GRAINS.PAV;
  } else if (allText.includes('rice') || allText.includes('भात') || allText.includes('khichdi') || allText.includes('dosa batter')) {
    primaryGrain = PRIMARY_GRAINS.RICE;
  }

  // Meal form
  const lowerName = name.toLowerCase();
  let mealForm = MEAL_FORMS.OTHER;
  if (lowerName.includes('chilla')) mealForm = MEAL_FORMS.CHILLA;
  else if (lowerName.includes('dosa') || lowerName.includes('uttapam') || lowerName.includes('pesarattu') || lowerName.includes('adai')) mealForm = MEAL_FORMS.DOSA_UTTAPAM_PANCAKE;
  else if (lowerName.includes('poha')) mealForm = MEAL_FORMS.POHA;
  else if (lowerName.includes('thalipeeth')) mealForm = MEAL_FORMS.THALIPEETH;
  else if (lowerName.includes('dashmi')) mealForm = MEAL_FORMS.DASHMI;
  else if (lowerName.includes('handvo')) mealForm = MEAL_FORMS.HANDVO;
  else if (lowerName.includes('khichdi')) mealForm = MEAL_FORMS.KHICHDI;
  else if (lowerName.includes('misal')) mealForm = MEAL_FORMS.USAL;
  else if (lowerName.includes('usal')) mealForm = MEAL_FORMS.USAL;
  else if (lowerName.includes('bhurji')) mealForm = MEAL_FORMS.BHURJI;
  else if (lowerName.includes('curry') || lowerName.includes('masala') || lowerName.includes('chole') || lowerName.includes('paneer') || lowerName.includes('keema') || lowerName.includes('vangi') || lowerName.includes('tikka') || lowerName.includes('bhindi')) mealForm = MEAL_FORMS.CURRY_SABJI;
  else if (lowerName.includes('chaat')) mealForm = MEAL_FORMS.CHAAT;
  else if (course.toLowerCase().includes('snack') || lowerName.includes('bowl') || lowerName.includes('curd +') || lowerName.includes('milk +') || lowerName.includes('buttermilk') || lowerName.includes('roasted chana')) mealForm = MEAL_FORMS.QUICK_SNACK_BOWL;

  // Heaviness classification
  let heaviness = RECIPE_HEAVINESS.MODERATE;
  if (mealForm === MEAL_FORMS.QUICK_SNACK_BOWL || mealForm === MEAL_FORMS.CHAAT || mealForm === MEAL_FORMS.POHA || lowerName.includes('khichdi')) {
    heaviness = RECIPE_HEAVINESS.LIGHT;
  } else if (containsPaneer) {
    heaviness = RECIPE_HEAVINESS.HEAVY;
  } else if (lowerName.includes('chole') || lowerName.includes('rajma') || lowerName.includes('misal') || lowerName.includes('handvo') || lowerName.includes('lobia') || lowerName.includes('mixed bean')) {
    heaviness = RECIPE_HEAVINESS.SUBSTANTIAL;
  }

  // Preparation attributes
  const soakingRequired = allText.includes('soaked') || allText.includes('soak');
  const fermentationRequired = allText.includes('ferment') || lowerName.includes('handvo');
  const batchPrepSuitable = (recipe.note || '').toLowerCase().includes('batch') || allText.includes('batch');

  // Vegetables and Fruits
  const vegetableCategories = [];
  if (allText.includes('spinach') || allText.includes('palak') || allText.includes('methi') || allText.includes('पालक') || allText.includes('मेथी')) vegetableCategories.push('leafy');
  if (allText.includes('dudhi') || allText.includes('bottle gourd') || allText.includes('दुधी')) vegetableCategories.push('gourd');
  if (allText.includes('cabbage') || allText.includes('कोबी')) vegetableCategories.push('cabbage');
  if (allText.includes('cauliflower') || allText.includes('फुलकोबी')) vegetableCategories.push('cauliflower');
  if (allText.includes('bhindi') || allText.includes('okra') || allText.includes('भेंडी')) vegetableCategories.push('okra');
  if (allText.includes('carrot') || allText.includes('गाजर')) vegetableCategories.push('root');
  if (allText.includes('cucumber') || allText.includes('काकडी')) vegetableCategories.push('cucumber');
  if (allText.includes('tomato') || allText.includes('टोमॅटो')) vegetableCategories.push('tomato');

  const fruits = [];
  if (allText.includes('apple') || allText.includes('सफरचंद')) fruits.push('apple');
  if (allText.includes('banana') || allText.includes('केळे')) fruits.push('banana');
  if (allText.includes('guava') || allText.includes('पेरू')) fruits.push('guava');
  if (allText.includes('papaya') || allText.includes('पपई')) fruits.push('papaya');
  if (allText.includes('pomegranate') || allText.includes('डाळिंब')) fruits.push('pomegranate');
  if (allText.includes('mosambi') || allText.includes('मोसंबी')) fruits.push('mosambi');

  return {
    ...recipe,
    containsPaneer,
    containsEgg,
    containsSoy,
    primaryProteinSource,
    primaryGrain,
    mealForm,
    heaviness,
    soakingRequired,
    fermentationRequired,
    batchPrepSuitable,
    vegetableCategories,
    fruits
  };
}

function createPlanningState({
  household = {},
  members = [],
  rules = DEFAULT_DIETARY_RULES,
  frequencyRules = DEFAULT_FREQUENCY_RULES,
  startDate = new Date().toISOString().slice(0, 10),
  visibleDays = 7,
  evaluationDays = 30
} = {}) {
  return {
    household: { ...household },
    members: members.map(m => ({ ...m })),
    rules: rules.map(r => ({ ...r })),
    frequencyRules: frequencyRules.map(r => ({ ...r })),
    planningWindow: {
      startDate,
      visibleDays: Number(visibleDays) || 7,
      evaluationDays: Number(evaluationDays) || 30
    },
    plannedMealHistory: new Map(),
    nutritionCoverage: new Map(),
    culinaryCoverage: new Map(),
    practicalityState: {
      recentHeavinessByDate: new Map(),
      recentFormsByDate: new Map(),
      recentGrainsByDate: new Map(),
      recentProteinsByDate: new Map()
    }
  };
}

function evaluateHardConstraints(recipe, slot, targetDate, state, options = {}) {
  const reasons = [];
  if (!recipe) {
    return { valid: false, reasons: ['Recipe is missing or invalid'] };
  }

  // 1. Slot compatibility
  const course = (recipe.course || '').toLowerCase();
  const slotLower = (slot || '').toLowerCase();
  let slotMatch = false;

  if (slotLower === 'breakfast') {
    slotMatch = course.includes('breakfast');
  } else if (slotLower === 'lunch' || slotLower === 'dinner') {
    slotMatch = course.includes('lunch') || course.includes('dinner') || course.includes('lunch/dinner');
  } else if (slotLower === 'snack') {
    slotMatch = course.includes('snack');
  } else {
    slotMatch = course.includes(slotLower);
  }

  if (!slotMatch) {
    reasons.push(`Recipe course '${recipe.course}' does not match target slot '${slot}'`);
  }

  // 2. Unavailable ingredients check
  if (Array.isArray(options.unavailableIngredients) && options.unavailableIngredients.length > 0) {
    for (const unavail of options.unavailableIngredients) {
      if (recipeContainsIngredient(recipe, unavail)) {
        reasons.push(`Recipe contains unavailable ingredient '${unavail}'`);
      }
    }
  }

  // 3. Frequency Rules (e.g. Paneer monthly limit)
  const month = targetDate ? targetDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const freqRules = state?.frequencyRules || DEFAULT_FREQUENCY_RULES;
  for (const rule of freqRules) {
    if (rule.ingredientKey && recipeContainsIngredient(recipe, rule.ingredientKey)) {
      const freqKey = `${rule.ingredientKey}:${month}`;
      const currentCount = state?.frequencyCounts?.get ? (state.frequencyCounts.get(freqKey) || 0) : 0;
      const maxLimit = rule.maxPerCalendarMonth != null ? rule.maxPerCalendarMonth : 5;
      if (currentCount >= maxLimit) {
        reasons.push(`Exceeds monthly frequency limit for '${rule.ingredientKey}' (${currentCount}/${maxLimit} in ${month})`);
      }
    }
  }

  // 4. Consecutive day rule (e.g. paneer shouldn't be served on consecutive days)
  if (recipeContainsIngredient(recipe, 'paneer') && targetDate && state?.practicalityState?.recentHeavinessByDate) {
    const prevDateObj = new Date(targetDate);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().slice(0, 10);
    const prevRecord = state.practicalityState.recentHeavinessByDate.get(prevDateStr);
    if (prevRecord && (prevRecord.hasPaneer || prevRecord.containsPaneer)) {
      reasons.push(`consecutive paneer meal prohibited: previous day ${prevDateStr} already contained paneer`);
    }
    const nextDateObj = new Date(targetDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().slice(0, 10);
    const nextRecord = state.practicalityState.recentHeavinessByDate.get(nextDateStr);
    if (nextRecord && (nextRecord.hasPaneer || nextRecord.containsPaneer)) {
      reasons.push(`consecutive paneer meal prohibited: next day ${nextDateStr} already contains paneer`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

function evaluateCulinaryAndPracticality(recipe, slot, targetDate, state) {
  let score = 100;
  const benefits = [];
  const penalties = [];

  const heaviness = recipe.heaviness || RECIPE_HEAVINESS.MODERATE;

  // Check heaviness spacing on the same day
  if (targetDate && state?.plannedMealHistory) {
    if (slot === 'Dinner') {
      const lunchRecipe = state.plannedMealHistory.get(`${targetDate}-Lunch`);
      if (lunchRecipe) {
        const lunchHeaviness = lunchRecipe.heaviness || RECIPE_HEAVINESS.MODERATE;
        if (lunchHeaviness === RECIPE_HEAVINESS.SUBSTANTIAL || lunchHeaviness === RECIPE_HEAVINESS.HEAVY) {
          if (heaviness === RECIPE_HEAVINESS.HEAVY || heaviness === RECIPE_HEAVINESS.SUBSTANTIAL) {
            score -= 50;
            penalties.push(`heaviness: dense or heavy lunch on ${targetDate} followed by substantial/heavy dinner`);
          } else if (heaviness === RECIPE_HEAVINESS.LIGHT) {
            score += 25;
            benefits.push('light dinner provides healthy digestive balance after a substantial lunch');
          }
        }
      }
    } else if (slot === 'Lunch') {
      const breakfastRecipe = state.plannedMealHistory.get(`${targetDate}-Breakfast`);
      if (breakfastRecipe && breakfastRecipe.heaviness === RECIPE_HEAVINESS.SUBSTANTIAL) {
        if (heaviness === RECIPE_HEAVINESS.HEAVY) {
          score -= 30;
          penalties.push('heaviness: substantial breakfast followed by heavy lunch');
        }
      }
    }
  }

  // Check meal form repetition across adjacent days
  if (targetDate && state?.plannedMealHistory && recipe.mealForm) {
    const prevDateObj = new Date(targetDate);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().slice(0, 10);
    const prevSlotRecipe = state.plannedMealHistory.get(`${prevDateStr}-${slot}`);
    if (prevSlotRecipe && prevSlotRecipe.mealForm === recipe.mealForm) {
      score -= 35;
      penalties.push(`consecutive meal form repetition: '${recipe.mealForm}' was also served in ${slot} on ${prevDateStr}`);
    }

    if (prevSlotRecipe && prevSlotRecipe.primaryGrain && recipe.primaryGrain && prevSlotRecipe.primaryGrain === recipe.primaryGrain && recipe.primaryGrain !== PRIMARY_GRAINS.NONE) {
      score -= 15;
      penalties.push(`consecutive grain repetition: '${recipe.primaryGrain}' repeated from ${prevDateStr}`);
    }
  }

  if (recipe.soakingRequired) {
    benefits.push('rich in traditional legumes/pulses requiring soaking');
  }

  return {
    score,
    benefits,
    penalties
  };
}

function evaluateNutritionDiversity(recipe, slot, targetDate, state) {
  let score = 100;
  const benefits = [];
  const penalties = [];

  const proteinSource = recipe.primaryProteinSource || PRIMARY_PROTEIN_SOURCES.NONE;
  const grain = recipe.primaryGrain || PRIMARY_GRAINS.NONE;

  if (targetDate && state?.plannedMealHistory) {
    const recentProteins = [];
    const recentGrains = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      for (const s of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
        const m = state.plannedMealHistory.get(`${ds}-${s}`);
        if (m) {
          if (m.primaryProteinSource) recentProteins.push(m.primaryProteinSource);
          if (m.primaryGrain) recentGrains.push(m.primaryGrain);
        }
      }
    }

    const proteinOccurrences = recentProteins.filter(p => p === proteinSource && p !== PRIMARY_PROTEIN_SOURCES.NONE).length;
    if (proteinOccurrences >= 3) {
      score -= 30;
      penalties.push(`Frequent protein source repetition: '${proteinSource}' appeared ${proteinOccurrences} times in the last 3 days`);
    } else if (proteinOccurrences === 0 && proteinSource !== PRIMARY_PROTEIN_SOURCES.NONE) {
      score += 20;
      benefits.push(`Introduces novel protein source '${proteinSource}'`);
    }

    const grainOccurrences = recentGrains.filter(g => g === grain && g !== PRIMARY_GRAINS.NONE).length;
    if (grainOccurrences >= 4) {
      score -= 20;
      penalties.push(`Frequent grain repetition: '${grain}' appeared ${grainOccurrences} times in the last 3 days`);
    } else if (grain === PRIMARY_GRAINS.JOWAR || grain === PRIMARY_GRAINS.RAGI) {
      score += 15;
      benefits.push(`Provides millet diversity with ${grain}`);
    }
  }

  if (Array.isArray(recipe.vegetableCategories) && recipe.vegetableCategories.length > 0) {
    score += recipe.vegetableCategories.length * 5;
    benefits.push(`Contributes vegetables: ${recipe.vegetableCategories.join(', ')}`);
  }
  if (Array.isArray(recipe.fruits) && recipe.fruits.length > 0) {
    score += recipe.fruits.length * 5;
    benefits.push(`Contributes fresh seasonal fruit: ${recipe.fruits.join(', ')}`);
  }

  return {
    score,
    benefits,
    penalties
  };
}

function generateCandidates(slot, targetDate, state, candidateRecipes = [], options = {}) {
  const scored = [];
  for (const rawRecipe of candidateRecipes) {
    const recipe = enrichRecipeMetadata(rawRecipe);
    const hard = evaluateHardConstraints(recipe, slot, targetDate, state, options);
    if (!hard.valid) continue;

    const culinary = evaluateCulinaryAndPracticality(recipe, slot, targetDate, state);
    const nutrition = evaluateNutritionDiversity(recipe, slot, targetDate, state);
    const totalScore = culinary.score + nutrition.score;

    const reasons = [
      ...culinary.benefits,
      ...nutrition.benefits,
      ...culinary.penalties,
      ...nutrition.penalties
    ];

    scored.push({
      recipe,
      score: totalScore,
      culinary,
      nutrition,
      explanation: {
        reasons,
        culinaryBenefits: culinary.benefits,
        nutritionBenefits: nutrition.benefits,
        culinaryPenalties: culinary.penalties,
        nutritionPenalties: nutrition.penalties
      }
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const idA = String(a.recipe.id || a.recipe.name || '');
    const idB = String(b.recipe.id || b.recipe.name || '');
    return idA.localeCompare(idB);
  });

  return scored;
}

function generatePlan(state, candidateRecipes = [], options = {}) {
  const days = Number(options.days) || state?.planningWindow?.visibleDays || 7;
  const startDate = options.startDate || state?.planningWindow?.startDate || new Date().toISOString().slice(0, 10);
  const slots = options.slots || ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

  const workingState = {
    ...state,
    plannedMealHistory: new Map(state.plannedMealHistory || []),
    frequencyCounts: new Map(state.frequencyCounts || []),
    practicalityState: {
      recentHeavinessByDate: new Map(state?.practicalityState?.recentHeavinessByDate || []),
      recentFormsByDate: new Map(state?.practicalityState?.recentFormsByDate || []),
      recentGrainsByDate: new Map(state?.practicalityState?.recentGrainsByDate || []),
      recentProteinsByDate: new Map(state?.practicalityState?.recentProteinsByDate || [])
    }
  };

  const plan = [];
  const warnings = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toISOString().slice(0, 10);

    for (const slot of slots) {
      const candidates = generateCandidates(slot, dateStr, workingState, candidateRecipes, options);
      if (!candidates.length) {
        warnings.push(`Planning conflict: No valid candidate found for ${dateStr} ${slot}`);
        continue;
      }

      const best = candidates[0];
      const recipe = best.recipe;

      workingState.plannedMealHistory.set(`${dateStr}-${slot}`, recipe);

      if (recipe.containsPaneer || recipeContainsIngredient(recipe, 'paneer')) {
        const month = dateStr.slice(0, 7);
        const k = `paneer:${month}`;
        workingState.frequencyCounts.set(k, (workingState.frequencyCounts.get(k) || 0) + 1);
        const prevDayRec = workingState.practicalityState.recentHeavinessByDate.get(dateStr) || {};
        workingState.practicalityState.recentHeavinessByDate.set(dateStr, { ...prevDayRec, hasPaneer: true, containsPaneer: true });
      }

      const existingDateMeta = workingState.practicalityState.recentHeavinessByDate.get(dateStr) || {};
      workingState.practicalityState.recentHeavinessByDate.set(dateStr, {
        ...existingDateMeta,
        [slot]: recipe.heaviness
      });

      plan.push({
        date: dateStr,
        slot,
        recipeId: recipe.id,
        recipe,
        title: recipe.name,
        marathiTitle: recipe.mr || recipe.name,
        explanation: best.explanation || { reasons: ['Fits nutritional and variety requirements'] }
      });
    }
  }

  return {
    success: warnings.length === 0,
    plan,
    warnings,
    state: workingState
  };
}

const MEAL_CHANGE_REASONS = {
  INGREDIENT_UNAVAILABLE: 'ingredient_unavailable',
  NOT_IN_MOOD: 'not_in_mood',
  WANT_LIGHTER: 'want_lighter',
  WANT_DIFFERENT_GRAIN: 'want_different_grain',
  WANT_DIFFERENT_PROTEIN: 'want_different_protein',
  WANT_DIFFERENT_MEAL_FORM: 'want_different_meal_form',
  TOO_REPETITIVE: 'too_repetitive',
  TOO_MUCH_EFFORT: 'too_much_effort',
  WANT_QUICK: 'want_quick',
  CUSTOM: 'custom'
};

function proposeMealChange(currentMeal, reason, state, candidateRecipes = [], options = {}) {
  const currentRecipe = currentMeal?.recipe || (candidateRecipes.find(r => r.id === currentMeal?.recipeId) || {});
  const enrichedCurrent = enrichRecipeMetadata(currentRecipe);
  const slot = currentMeal?.slot || 'Lunch';
  const targetDate = currentMeal?.date || new Date().toISOString().slice(0, 10);

  const unavailableIngredients = [...(options.unavailableIngredients || [])];
  if (options.unavailableIngredient) unavailableIngredients.push(options.unavailableIngredient);

  const scoredAlternatives = [];

  for (const rawRecipe of candidateRecipes) {
    const candidate = enrichRecipeMetadata(rawRecipe);
    if (candidate.id === enrichedCurrent.id || candidate.name === enrichedCurrent.name) continue;

    const hard = evaluateHardConstraints(candidate, slot, targetDate, state, {
      ...options,
      unavailableIngredients
    });
    if (!hard.valid) continue;

    let culinary = evaluateCulinaryAndPracticality(candidate, slot, targetDate, state);
    let nutrition = evaluateNutritionDiversity(candidate, slot, targetDate, state);
    let score = culinary.score + nutrition.score;
    const reasons = [...culinary.benefits, ...nutrition.benefits];

    switch (reason) {
      case MEAL_CHANGE_REASONS.WANT_LIGHTER:
        if (candidate.heaviness === RECIPE_HEAVINESS.LIGHT) {
          score += 60;
          reasons.unshift('Lighter digestive profile matches request');
        } else if (candidate.heaviness === RECIPE_HEAVINESS.MODERATE) {
          score += 20;
        } else if (candidate.heaviness === RECIPE_HEAVINESS.SUBSTANTIAL || candidate.heaviness === RECIPE_HEAVINESS.HEAVY) {
          score -= 50;
        }
        break;

      case MEAL_CHANGE_REASONS.WANT_DIFFERENT_PROTEIN:
        if (candidate.primaryProteinSource && candidate.primaryProteinSource !== enrichedCurrent.primaryProteinSource && candidate.primaryProteinSource !== PRIMARY_PROTEIN_SOURCES.NONE) {
          score += 50;
          reasons.unshift(`Changes protein source to ${candidate.primaryProteinSource}`);
        } else if (candidate.primaryProteinSource === enrichedCurrent.primaryProteinSource) {
          score -= 40;
        }
        break;

      case MEAL_CHANGE_REASONS.WANT_DIFFERENT_GRAIN:
        if (candidate.primaryGrain && candidate.primaryGrain !== enrichedCurrent.primaryGrain && candidate.primaryGrain !== PRIMARY_GRAINS.NONE) {
          score += 50;
          reasons.unshift(`Introduces grain variety with ${candidate.primaryGrain}`);
        } else if (candidate.primaryGrain === enrichedCurrent.primaryGrain) {
          score -= 40;
        }
        break;

      case MEAL_CHANGE_REASONS.WANT_DIFFERENT_MEAL_FORM:
        if (candidate.mealForm && candidate.mealForm !== enrichedCurrent.mealForm) {
          score += 40;
          reasons.unshift(`Offers distinct culinary preparation (${candidate.mealForm})`);
        } else {
          score -= 30;
        }
        break;

      case MEAL_CHANGE_REASONS.WANT_QUICK:
      case MEAL_CHANGE_REASONS.TOO_MUCH_EFFORT:
        if (candidate.soakingRequired || candidate.fermentationRequired) {
          score -= 60;
        }
        const timeMinutes = parseInt(candidate.time || '30', 10);
        if (timeMinutes <= 25) {
          score += 40;
          reasons.unshift(`Quick preparation time (~${timeMinutes} min)`);
        } else if (timeMinutes > 35) {
          score -= 30;
        }
        break;

      case MEAL_CHANGE_REASONS.NOT_IN_MOOD:
        if (candidate.mealForm !== enrichedCurrent.mealForm) {
          score += 30;
          reasons.unshift(`Provides fresh variety away from ${enrichedCurrent.mealForm}`);
        }
        break;

      case MEAL_CHANGE_REASONS.TOO_REPETITIVE:
        score -= 20;
        break;

      default:
        break;
    }

    scoredAlternatives.push({
      recipe: candidate,
      score,
      explanation: {
        reasons,
        culinaryBenefits: culinary.benefits,
        nutritionBenefits: nutrition.benefits
      },
      culinary,
      nutrition
    });
  }

  scoredAlternatives.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const idA = String(a.recipe.id || a.recipe.name || '');
    const idB = String(b.recipe.id || b.recipe.name || '');
    return idA.localeCompare(idB);
  });

  return {
    reasonApplied: reason,
    alternatives: scoredAlternatives,
    recommendation: scoredAlternatives[0] || null
  };
}

if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, {CANONICAL_UI_CONTENT,REMOTE_TABLES,PHASE2_TABLES,buildRemoteRows,mapRemoteState,mapHealthTips,mapHealthTargets,mapHouseholdSettings,dedupeRecipesByName,SUPPORTED_UNITS,normalizeIngredientAlias,normalizeUnit,convertQuantity,aggregateIngredientLines,parseLegacyIngredientLine,mapLegacyRecipeIngredients,deriveRecipeDietaryFlags,DEFAULT_DIETARY_RULES,DEFAULT_FREQUENCY_RULES,recipeContainsIngredient,countIngredientMonthlyOccurrences,getHouseholdFrequencyStatus,evaluateRecipeEligibility,rankAlternateRecipes,selectAutomaticAlternate,buildAutomaticAssignments,applyDayLevelOverride,revertDayLevelOverride,mapNutritionEducation,getNutritionEducation,getRecipeNutritionConcepts,evaluateMealBalance,buildShoppingFromAssignments,mapIngredientCatalog,mapRecipeIngredients,mapMealAssignments,buildStructuredRecipe,mapDietaryRules,groupMemberAssignments,mapUiContent,createContentProvider,mapFrequencyRules,RECIPE_HEAVINESS,MEAL_FORMS,PRIMARY_GRAINS,PRIMARY_PROTEIN_SOURCES,enrichRecipeMetadata,createPlanningState,evaluateHardConstraints,evaluateCulinaryAndPracticality,evaluateNutritionDiversity,generateCandidates,generatePlan,MEAL_CHANGE_REASONS,proposeMealChange});
export {CANONICAL_UI_CONTENT,REMOTE_TABLES,PHASE2_TABLES,buildRemoteRows,mapRemoteState,mapHealthTips,mapHealthTargets,mapHouseholdSettings,dedupeRecipesByName,SUPPORTED_UNITS,normalizeIngredientAlias,normalizeUnit,convertQuantity,aggregateIngredientLines,parseLegacyIngredientLine,mapLegacyRecipeIngredients,deriveRecipeDietaryFlags,DEFAULT_DIETARY_RULES,DEFAULT_FREQUENCY_RULES,recipeContainsIngredient,countIngredientMonthlyOccurrences,getHouseholdFrequencyStatus,evaluateRecipeEligibility,rankAlternateRecipes,selectAutomaticAlternate,buildAutomaticAssignments,applyDayLevelOverride,revertDayLevelOverride,mapNutritionEducation,getNutritionEducation,getRecipeNutritionConcepts,evaluateMealBalance,buildShoppingFromAssignments,mapIngredientCatalog,mapRecipeIngredients,mapMealAssignments,buildStructuredRecipe,mapDietaryRules,groupMemberAssignments,mapUiContent,createContentProvider,mapFrequencyRules,RECIPE_HEAVINESS,MEAL_FORMS,PRIMARY_GRAINS,PRIMARY_PROTEIN_SOURCES,enrichRecipeMetadata,createPlanningState,evaluateHardConstraints,evaluateCulinaryAndPracticality,evaluateNutritionDiversity,generateCandidates,generatePlan,MEAL_CHANGE_REASONS,proposeMealChange};



