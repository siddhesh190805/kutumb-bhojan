-- Kutumb Bhojan: Data-driven UI content and configurable business rules layer
-- Code defines behavior; database defines content, information, domain data and configurable rules.

create table if not exists public.ui_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  category text not null,
  marathi text not null,
  english text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ui_content_category_idx on public.ui_content(category, sort_order);

create table if not exists public.household_frequency_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  rule_key text not null,
  ingredient_key text not null,
  max_per_calendar_month integer not null check (max_per_calendar_month >= 0),
  period text not null default 'calendar-month',
  rule_type text not null default 'ingredient_frequency',
  preference_type text not null default 'household_planning',
  label text not null,
  marathi_label text not null,
  description text not null,
  marathi_description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, rule_key)
);

create index if not exists household_frequency_rules_household_idx on public.household_frequency_rules(household_id);

alter table public.ui_content enable row level security;
alter table public.household_frequency_rules enable row level security;

drop policy if exists ui_content_authenticated_select on public.ui_content;
create policy ui_content_authenticated_select on public.ui_content for select to authenticated using (active = true);

drop policy if exists household_frequency_rules_member_all on public.household_frequency_rules;
create policy household_frequency_rules_member_all on public.household_frequency_rules for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

grant select on public.ui_content to authenticated;
grant select, insert, update, delete on public.household_frequency_rules to authenticated;

revoke all on public.ui_content from anon;
revoke all on public.household_frequency_rules from anon;

-- Update bootstrap_household to seed household_frequency_rules for households
create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  h uuid;
  uid uuid := auth.uid();
  is_anon boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if uid is null then raise exception 'authentication required'; end if;
  select hm.household_id into h from public.household_members hm where hm.user_id = uid order by hm.created_at limit 1;
  if h is null then
    if is_anon then
      select id into h from public.households where name = 'कुटुंब भोजन' order by created_at limit 1;
      if h is null then insert into public.households(name) values ('कुटुंब भोजन') returning id into h; end if;
      insert into public.household_members(household_id,user_id,role) values (h,uid,'member') on conflict (household_id,user_id) do nothing;
    else
      insert into public.households(name) values (coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन')) returning id into h;
      insert into public.household_members(household_id,user_id,role) values (h,uid,'owner');
    end if;
  end if;
  insert into public.household_settings(household_id,display_name)
  values (h, coalesce(nullif(trim(household_name), ''),'कुटुंब भोजन'))
  on conflict (household_id) do nothing;

  insert into public.household_frequency_rules (
    household_id, rule_key, ingredient_key, max_per_calendar_month, period,
    rule_type, preference_type, label, marathi_label, description, marathi_description
  ) values (
    h, 'paneer-monthly-frequency', 'paneer', 5, 'calendar-month',
    'ingredient_frequency', 'household_planning',
    'Paneer monthly planning limit', 'पनीर मासिक नियोजन मर्यादा',
    'Paneer should be planned no more than 5 times per calendar month (household planning preference, not a medical restriction).',
    'एका कॅलेंडर महिन्यात ५ पेक्षा जास्त वेळा पनीरचे जेवण नको (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).'
  ) on conflict (household_id, rule_key) do nothing;

  return h;
end; $$;

-- Seed frequency rules for all existing households
insert into public.household_frequency_rules (
  household_id, rule_key, ingredient_key, max_per_calendar_month, period,
  rule_type, preference_type, label, marathi_label, description, marathi_description
)
select
  h.id, 'paneer-monthly-frequency', 'paneer', 5, 'calendar-month',
  'ingredient_frequency', 'household_planning',
  'Paneer monthly planning limit', 'पनीर मासिक नियोजन मर्यादा',
  'Paneer should be planned no more than 5 times per calendar month (household planning preference, not a medical restriction).',
  'एका कॅलेंडर महिन्यात ५ पेक्षा जास्त वेळा पनीरचे जेवण नको (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).'
from public.households h
on conflict (household_id, rule_key) do update set
  max_per_calendar_month = excluded.max_per_calendar_month,
  label = excluded.label,
  marathi_label = excluded.marathi_label,
  description = excluded.description,
  marathi_description = excluded.marathi_description,
  updated_at = now();

-- Canonical UI Content Seeding
insert into public.ui_content (content_key, category, marathi, english, metadata, sort_order) values
-- App Identity
('app.name', 'identity', 'कुटुंब भोजन', 'Kutumb Bhojan', '{"short":"कुटुंब भोजन"}', 1),
('app.tagline', 'identity', 'कुटुंबाचे पोषण', 'FAMILY NUTRITION', '{}', 2),
('app.brand_strong', 'identity', 'सोपे कौटुंबिक जेवण', 'Simple Family Meals', '{}', 3),
('app.brand_small', 'identity', 'कुटुंबाची पोषण नियोजन पद्धत', 'Family meal planning system', '{}', 4),

-- Navigation
('nav.today', 'navigation', 'आज', 'Today', '{"icon":"🏠","page":"today"}', 10),
('nav.calendar', 'navigation', 'कॅलेंडर', 'Calendar', '{"icon":"📅","page":"calendar"}', 20),
('nav.recipes', 'navigation', 'पाककृती', 'Recipes', '{"icon":"🍳","page":"recipes"}', 30),
('nav.health', 'navigation', 'आरोग्य', 'Health', '{"icon":"🌿","page":"health"}', 40),
('nav.shopping', 'navigation', 'खरेदी', 'Shopping', '{"icon":"🛒","page":"shopping"}', 50),
('nav.prep', 'navigation', 'तयारी', 'Prep', '{"icon":"🔪","page":"prep"}', 60),
('nav.family', 'navigation', 'कुटुंब', 'Family', '{"icon":"👨‍👩‍👦","page":"family"}', 70),
('nav.settings', 'navigation', 'सेटिंग्ज', 'Settings', '{"icon":"⚙️","page":"settings"}', 80),

-- Sidebar
('sidebar.questions_title', 'sidebar', 'आजचे चार प्रश्न', 'Four Daily Questions', '{}', 90),
('sidebar.q_cook', 'sidebar', 'काय बनवायचे? → कॅलेंडर', 'What to cook? → Calendar', '{}', 91),
('sidebar.q_recipe', 'sidebar', 'कसे बनवायचे? → पाककृती', 'How to cook? → Recipes', '{}', 92),
('sidebar.q_buy', 'sidebar', 'काय आणायचे? → खरेदी', 'What to buy? → Shopping', '{}', 93),
('sidebar.q_prep', 'sidebar', 'आधी काय करायचे? → तयारी', 'What to prep? → Prep', '{}', 94),
('sidebar.q_health', 'sidebar', 'आरोग्य कसे सुधारायचे? → आरोग्य', 'How to improve health? → Health', '{}', 95),

-- Meal Slots
('slot.Breakfast', 'meal_slot', 'सकाळचा नाश्ता', 'Breakfast', '{"icon":"🍳","slot_key":"Breakfast"}', 100),
('slot.Lunch', 'meal_slot', 'दुपारचे जेवण', 'Lunch', '{"icon":"🍛","slot_key":"Lunch"}', 101),
('slot.Snack', 'meal_slot', 'संध्याकाळचा खाऊ', 'Evening Snack', '{"icon":"🥜","slot_key":"Snack"}', 102),
('slot.Dinner', 'meal_slot', 'रात्रीचे जेवण', 'Dinner', '{"icon":"🍽️","slot_key":"Dinner"}', 103),

-- Today Page
('today.kicker', 'section', 'आज', 'TODAY', '{}', 110),
('today.title', 'section', 'आज काय बनवायचे?', 'What are we eating today?', '{}', 111),
('today.subtitle', 'section', 'जेवण, तयारी, खरेदी आणि आरोग्य — एका स्क्रीनवर.', 'Meals, prep, shopping, and health — all in one place.', '{}', 112),
('today.learning_kicker', 'section', 'आजच्या ताटात', 'What are we eating today?', '{}', 113),
('today.learning_strong', 'section', 'अन्न → पोषण → शरीर', 'Food → nutrition → body', '{}', 114),
('today.learning_small', 'section', 'प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.', 'Understand what each food contributes to the body.', '{}', 115),
('today.btn_learn_nutrition', 'action', 'पोषण समजून घ्या', 'Learn about nutrition', '{}', 116),
('today.balance_title', 'section', 'जेवणाचा समतोल', 'Meal balance', '{}', 117),
('today.balance_sub', 'section', 'प्रथिने · तंतू · भाज्या · फळे · संपूर्ण धान्य', 'Protein · Fibre · Vegetables · Fruit · Whole grains', '{}', 118),
('today.prep_title', 'section', 'आजची तयारी', 'Today’s prep', '{}', 119),
('today.prep_empty', 'empty_state', 'आज कोणतीही तयारी नियोजित नाही.', 'No prep tasks planned for today.', '{}', 120),
('today.shopping_title', 'section', 'खरेदी', 'Shopping', '{}', 121),
('today.shopping_remaining', 'label', 'खरेदी करायच्या वस्तू शिल्लक आहेत', 'items to buy remaining', '{}', 122),
('today.btn_open_shopping', 'action', 'खरेदी यादी उघडा →', 'Open shopping list →', '{}', 123),
('today.health_title', 'section', 'आरोग्य मार्गदर्शन', 'Health Guide', '{}', 124),
('today.health_desc', 'section', 'तेल, मीठ, साखर, भाज्या, protein आणि food safety याबद्दल practical guidance.', 'Practical guidance for oil, salt, sugar, vegetables, protein, and food safety.', '{}', 125),
('today.btn_view_health', 'action', 'आरोग्य मार्गदर्शन पाहा →', 'View Health Guide →', '{}', 126),
('today.food_kicker', 'section', 'आज आपण काय खातोय?', 'What foods are we eating?', '{}', 127),
('today.food_title', 'section', 'अन्नापासून पोषणाकडे', 'From food to nutrition', '{}', 128),
('today.food_subtitle', 'section', 'आजच्या recipes मधील प्रमुख पदार्थ आणि त्यांचा nutrition context.', 'Key foods from today’s recipes and their nutrition context.', '{}', 129),
('today.food_empty', 'empty_state', 'आजचे food details अजून उपलब्ध नाहीत.', 'Food details are not available yet.', '{}', 130),

-- Calendar Page
('calendar.kicker', 'section', 'कॅलेंडर', 'CALENDAR', '{}', 140),
('calendar.title', 'section', '३० दिवसांचे नियोजन', '30-Day Meal Planning', '{}', 141),
('calendar.subtitle', 'section', 'महिन्याच्या प्रत्येक दिवशी चार meal slots.', 'Four meal slots planned for each day of the month.', '{}', 142),
('calendar.days_suffix', 'label', 'दिवस', 'days', '{}', 143),
('calendar.entries_suffix', 'label', 'जेवण नोंदी', 'meal entries', '{}', 144),
('calendar.meals_suffix', 'label', 'जेवण', 'meals', '{}', 145),

-- Recipes Page
('recipes.kicker', 'section', 'पाककृती', 'RECIPES', '{}', 150),
('recipes.title', 'section', 'कसे बनवायचे?', 'How to cook?', '{}', 151),
('recipes.subtitle', 'section', 'कुटुंबासाठी निवडलेल्या पाककृती — साहित्य, वेळ, प्रमाण आणि पोषण नोट्स.', 'Family recipes with ingredients, cooking time, portions, and nutrition notes.', '{}', 152),
('recipes.search_placeholder', 'label', 'पाककृती शोधा...', 'Search recipes...', '{}', 153),
('recipes.btn_add_recipe', 'action', 'नवीन पाककृती', 'Add recipe', '{}', 154),
('recipes.count_suffix', 'label', 'पाककृती', 'recipes', '{}', 155),
('recipes.detail_kicker', 'section', 'पाककृती', 'RECIPE', '{}', 156),
('recipes.tag_egg', 'label', 'अंडे', 'Egg', '{}', 157),
('recipes.tag_veg', 'label', 'शाकाहारी', 'Vegetarian', '{}', 158),
('recipes.btn_edit', 'action', 'संपादित करा', 'Edit recipe', '{}', 159),
('recipes.servings_suffix', 'label', 'व्यक्ती', 'servings', '{}', 160),
('recipes.heading_ingredients', 'section', 'साहित्य', 'Ingredients', '{}', 161),
('recipes.legacy_unmapped', 'label', 'जुना मजकूर · अजून normalize केलेला नाही', 'Legacy text · unmapped', '{}', 162),
('recipes.heading_method', 'section', 'कृती पायऱ्या', 'Method Steps', '{}', 163),
('recipes.heading_nutrition', 'section', 'पोषण समजून घ्या', 'Nutrition explained', '{}', 164),
('recipes.heading_notes', 'section', 'टीप', 'Notes', '{}', 165),
('recipes.label_protein', 'label', 'प्रथिने', 'Protein', '{}', 166),
('recipes.label_fibre', 'label', 'तंतू', 'Fibre', '{}', 167),
('recipes.label_oil', 'label', 'तेल', 'Oil', '{}', 168),
('recipes.modal_edit_title', 'section', 'पाककृती संपादित करा', 'Edit Recipe', '{}', 169),
('recipes.modal_add_title', 'section', 'नवीन पाककृती जोडा', 'Add Recipe', '{}', 170),
('recipes.form_mr_name', 'label', 'पाककृतीचे मराठी नाव *', 'Marathi Name *', '{}', 171),
('recipes.form_en_name', 'label', 'English नाव *', 'English Name *', '{}', 172),
('recipes.form_course', 'label', 'वर्ग', 'Meal Category', '{}', 173),
('recipes.form_role', 'label', 'भूमिका', 'Meal Role', '{}', 174),
('recipes.form_role_main', 'label', 'मुख्य पदार्थ', 'Main', '{}', 175),
('recipes.form_role_snack', 'label', 'अल्पोपहार', 'Snack', '{}', 176),
('recipes.form_role_side', 'label', 'पूरक पदार्थ', 'Side', '{}', 177),
('recipes.form_time', 'label', 'वेळ', 'Time', '{}', 178),
('recipes.form_servings', 'label', 'व्यक्ती', 'Servings', '{}', 179),
('recipes.form_cooking_method', 'label', 'बनवण्याची पद्धत', 'Cooking Method', '{}', 180),
('recipes.form_ingredients', 'label', 'साहित्य (प्रत्येक ओळीवर एक) *', 'Ingredients (one per line) *', '{}', 181),
('recipes.form_method', 'label', 'कृती पायऱ्या (प्रत्येक ओळीवर एक)', 'Method Steps (one per line)', '{}', 182),
('recipes.form_notes', 'label', 'नोंद', 'Notes', '{}', 183),
('recipes.form_notes_placeholder', 'label', 'उदा. दही किंवा कोशिंबीर सोबत सर्व्ह करा.', 'e.g. Serve with curd or salad.', '{}', 184),

-- Shopping Page
('shopping.kicker', 'section', 'खरेदी', 'SHOPPING', '{}', 190),
('shopping.title', 'section', 'काय आणायचे?', 'What to buy?', '{}', 191),
('shopping.subtitle', 'section', 'Meal assignments मधून generated quantities + तुमची manual list.', 'Quantities generated from meal assignments plus your manual list.', '{}', 192),
('shopping.placeholder_mr', 'label', 'मराठी नाव (उदा. पोहे)', 'Marathi name (e.g. Pohe)', '{}', 193),
('shopping.placeholder_en', 'label', 'English नाव (उदा. Poha)', 'English name (e.g. Poha)', '{}', 194),
('shopping.placeholder_qty', 'label', 'प्रमाण (उदा. 1 kg)', 'Quantity (e.g. 1 kg)', '{}', 195),
('shopping.cat_staples', 'label', 'धान्य', 'Staples', '{}', 196),
('shopping.cat_pulses', 'label', 'कडधान्ये', 'Pulses & Legumes', '{}', 197),
('shopping.cat_dairy', 'label', 'दुग्धजन्य', 'Dairy', '{}', 198),
('shopping.cat_vegetables', 'label', 'भाज्या', 'Vegetables', '{}', 199),
('shopping.cat_fruits', 'label', 'फळे', 'Fruits', '{}', 200),
('shopping.cat_nuts', 'label', 'बिया आणि सुकामेवा', 'Nuts & Seeds', '{}', 201),
('shopping.cat_spices', 'label', 'मसाले', 'Spices', '{}', 202),
('shopping.cat_other', 'label', 'इतर', 'Other', '{}', 203),
('shopping.btn_add', 'action', 'जोडा', 'Add', '{}', 204),
('shopping.items_to_buy_suffix', 'label', 'वस्तू खरेदी बाकी', 'items to buy', '{}', 205),
('shopping.empty', 'empty_state', 'खरेदी यादीत कोणतीही वस्तू नाही.', 'No shopping items.', '{}', 206),
('shopping.meal_plan_suffix', 'label', 'जेवण नियोजन', 'Meal plan', '{}', 207),
('shopping.from_assignments', 'label', 'नियोजनानुसार', 'From assignments', '{}', 208),
('shopping.need_to_buy', 'label', 'खरेदी करायची', 'Need to buy', '{}', 209),
('shopping.btn_delete', 'action', 'काढा', 'Delete', '{}', 210),

-- Prep Page
('prep.kicker', 'section', 'तयारी', 'PREP', '{}', 220),
('prep.title', 'section', 'आधी काय करायचे?', 'What to prep ahead?', '{}', 221),
('prep.subtitle', 'section', 'Batch prep केल्याने weekday cooking सोपी होते.', 'Batch prep makes weekday cooking easy and stress-free.', '{}', 222),
('prep.placeholder_mr', 'label', 'तयारीचे नाव (मराठी)', 'Prep task (Marathi)', '{}', 223),
('prep.placeholder_en', 'label', 'Task name (English)', 'Task name (English)', '{}', 224),
('prep.area_meal_prep', 'label', 'जेवणाची तयारी', 'Meal Prep', '{}', 225),
('prep.area_batter', 'label', 'मोड आणणे / पीठ भिजवणे', 'Batter / Sprouting', '{}', 226),
('prep.area_storage', 'label', 'साठवणूक', 'Storage', '{}', 227),
('prep.area_shopping', 'label', 'खरेदी', 'Shopping', '{}', 228),
('prep.area_review', 'label', 'आढावा', 'Review', '{}', 229),

-- Family Page
('family.kicker', 'section', 'कुटुंब', 'FAMILY', '{}', 240),
('family.title', 'section', 'कुटुंबातील सदस्य', 'Family Profiles', '{}', 241),
('family.subtitle', 'section', 'ही माहिती पोषण संदर्भासाठी आहे; medical prescription नाही.', 'This information is for household nutritional context; not a clinical prescription.', '{}', 242),
('family.years_suffix', 'label', 'वर्षे', 'years', '{}', 243),

-- Health Page
('health.kicker', 'section', 'आरोग्य मार्गदर्शक', 'HEALTH GUIDE', '{}', 250),
('health.title', 'section', 'आरोग्य मार्गदर्शन', 'Practical Health Guidance', '{}', 251),
('health.subtitle', 'section', 'कुटुंबाच्या रोजच्या निर्णयांसाठी practical guidance. हे general information आहे; medical prescription नाही.', 'Practical guidance for daily household food decisions. General reference, not a medical prescription.', '{}', 252),
('health.notice_title', 'section', 'सोपा नियम:', 'Simple rule:', '{}', 253),
('health.notice_body', 'section', 'आवश्यकता, समतोल, संयम आणि विविधता. खाली दिलेली आकडेवारी सामान्य मार्गदर्शक आहे, वैयक्तिक वैद्यकीय टार्गेट नाही.', 'adequacy, balance, moderation and variety. Values below are general references, not individual medical targets.', '{}', 254),
('health.filter_all', 'action', 'सर्व', 'All', '{}', 255),
('health.classroom_kicker', 'section', 'पोषण वर्ग', 'NUTRITION CLASSROOM', '{}', 256),
('health.classroom_title', 'section', 'पोषण समजून घ्या', 'Understand nutrition', '{}', 257),
('health.classroom_subtitle', 'section', 'आपण खात असलेल्या अन्नातून शरीराला काय मिळते, ते काय करते आणि का आवश्यक आहे.', 'What nutrients each food provides, what they do, and why they matter.', '{}', 258),
('health.source_note', 'section', 'आरोग्य संदर्भ WHO आणि सार्वजनिक आरोग्य मार्गदर्शनातून घेतले आहेत.', 'Health references are sourced from WHO public-health guidance and are stored with the content record.', '{}', 259),
('health.small_action', 'label', 'आजचा छोटा बदल', 'Small action', '{}', 260),
('health.more_details', 'action', 'अधिक माहिती', 'More details', '{}', 261),
('health.what_is_it', 'label', 'काय आहे?', 'What is it?', '{}', 262),
('health.where_in_body', 'label', 'शरीरात कुठे वापर?', 'Where in the body?', '{}', 263),
('health.what_does_it_do', 'label', 'काय करते?', 'What does it do?', '{}', 264),
('health.why_does_it_matter', 'label', 'का आवश्यक?', 'Why does it matter?', '{}', 265),
('health.food_sources', 'label', 'अन्न स्रोत', 'Food sources', '{}', 266),
('health.nutrition_badge', 'label', 'पोषण', 'Nutrition', '{}', 267),

-- Settings Page
('settings.kicker', 'section', 'सेटिंग्ज', 'SETTINGS', '{}', 270),
('settings.title', 'section', 'डेटा आणि पर्याय', 'Data & Appearance', '{}', 271),
('settings.subtitle', 'section', 'Shared household settings cloud मध्ये; theme या device वर जतन होतो.', 'Shared household settings sync to the cloud; preferences save to this device.', '{}', 272),
('settings.theme_title', 'section', 'थीम', 'Theme', '{}', 273),
('settings.theme_desc', 'section', 'प्रत्येक device वर Light, Dark किंवा System निवडा.', 'Select Light, Dark, or System mode for this device.', '{}', 274),
('settings.theme_light', 'action', '☀️ Light', '☀️ Light', '{}', 275),
('settings.theme_dark', 'action', '🌙 Dark', '🌙 Dark', '{}', 276),
('settings.theme_system', 'action', '🖥️ System', '🖥️ System', '{}', 277),
('settings.lang_title', 'section', 'Language / भाषा', 'Language', '{}', 278),
('settings.lang_desc', 'section', 'मराठी, English किंवा दोन्ही निवडा.', 'Choose Marathi, English, or Bilingual mode.', '{}', 279),
('settings.lang_mr', 'action', 'मराठी', 'Marathi', '{}', 280),
('settings.lang_en', 'action', 'English', 'English', '{}', 281),
('settings.lang_both', 'action', 'मराठी + English', 'Bilingual', '{}', 282),
('settings.lang_both_short', 'action', 'दोन्ही', 'Both', '{}', 283),
('settings.oil_title', 'section', 'तेल नियोजन', 'Oil planning', '{}', 284),
('settings.oil_desc', 'section', 'Stock आणि monthly planning target वेगळे ठेवा. हा household planning tool आहे; medical limit नाही.', 'Keep stock and monthly target separate. This is a household tool, not a clinical limit.', '{}', 285),
('settings.label_oil_stock', 'label', 'सध्याचा साठा (ml)', 'Current stock (ml)', '{}', 286),
('settings.label_oil_target', 'label', 'मासिक टार्गेट (ml)', 'Monthly target (ml)', '{}', 287),
('settings.label_household_size', 'label', 'कुटुंबातील व्यक्ती संख्या', 'Household size', '{}', 288),
('settings.oil_advice_heading', 'section', 'कुठे कमी करायचे?', 'Where to moderate?', '{}', 289),
('settings.oil_advice_text', 'section', 'डीप-फ्राय, जास्त तेलाचा तडका आणि खूप तेलकट gravy आधी कमी करा. मोजून तेल वापरा; योग्य ठिकाणी भाजणे, वाफवणे किंवा pressure cooking वापरा.', 'Reduce deep frying, heavy tadka, and oily gravies. Measure oil, and prefer steaming, roasting, or pressure cooking.', '{}', 290),
('settings.btn_save_settings', 'action', 'Settings जतन करा', 'Save settings', '{}', 291),
('settings.freq_title', 'section', 'घरगुती नियोजन प्राधान्ये', 'Household Planning Preferences', '{}', 292),
('settings.freq_desc', 'section', 'पनीर मासिक वारंवारता मर्यादा (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).', 'Paneer monthly frequency limit (household planning preference, not medical advice).', '{}', 293),
('settings.paneer_planned_label', 'label', 'पनीर वापर (या महिन्यात):', 'Paneer planned (this month):', '{}', 294),
('settings.paneer_limit_desc', 'section', 'कॅलेंडर महिन्यात जास्तीत जास्त ५ वेळा पनीरचे जेवण. मर्यादा संपल्यावर इतर शाकाहारी पर्यायांना प्राधान्य दिले जाते.', 'Maximum 5 paneer meals per calendar month. When reached, other vegetarian alternates are preferred.', '{}', 295),
('settings.backup_title', 'section', 'बॅकअप', 'Backup', '{}', 296),
('settings.backup_desc', 'section', 'दर काही दिवसांनी JSON backup डाउनलोड करा. नवीन फोनवर Import करून data परत आणता येईल.', 'Download JSON backup regularly. Restore on any new device.', '{}', 297),
('settings.btn_export', 'action', 'Backup डाउनलोड', 'Export Backup', '{}', 298),
('settings.btn_import', 'action', 'Backup Import', 'Import Backup', '{}', 299),
('settings.cloud_title', 'section', 'क्लाउड जतन', 'Cloud sync', '{}', 300),
('settings.cloud_desc', 'section', 'Login/OTP लागत नाही. प्रत्येक device ला anonymous session मिळतो आणि shared household data Supabase मध्ये sync होतो.', 'No login/OTP required. Each device receives an anonymous session and shared household data syncs to Supabase.', '{}', 301),
('settings.cloud_note', 'section', 'Health content Supabase मधून येतो; content बदलण्यासाठी frontend code बदलण्याची गरज नाही.', 'Health content comes from Supabase; content updates require no code changes.', '{}', 302),
('settings.starter_title', 'section', 'सुरुवातीचा डेटा', 'Starter data', '{}', 303),
('settings.starter_desc', 'section', 'Starter calendar, recipes, shopping आणि prep पुन्हा आणा. Local edits replace होतील.', 'Restore starter calendar, recipes, shopping, and prep. Replaces local changes.', '{}', 304),
('settings.btn_reset', 'action', 'डेटा रीसेट करा', 'Reset starter data', '{}', 305),

-- Meal & Assignment Presentation
('meal.view_recipe', 'action', 'पाककृती पाहा →', 'View recipe →', '{}', 310),
('meal.change_slot', 'action', 'बदला:', 'Change slot:', '{}', 311),
('meal.family_badge_title', 'label', 'कुटुंब', 'Family', '{}', 312),
('meal.family_shared_desc', 'label', 'सदस्य · संपूर्ण कुटुंब एकच जेवण', 'members · shared meal', '{}', 313),
('meal.alternates_title', 'label', 'सदस्य बदल', 'Member changes', '{}', 314),
('meal.no_alternate', 'label', 'पर्याय उपलब्ध नाही', 'No alternate available', '{}', 315),
('meal.alternate_label', 'label', 'पर्याय', 'Alternate', '{}', 316),
('meal.override_tag', 'label', 'बदल', 'Override', '{}', 317),
('meal.frequency_tag', 'label', 'पनीर मर्यादा प्राधान्य', 'Frequency preference', '{}', 318),
('meal.frequency_tooltip', 'label', 'पनीर मासिक मर्यादा (५/महिना) पाळण्यासाठी पर्याय', 'Selected alternate respecting monthly paneer limit', '{}', 319),
('meal.auto_alternate_tag', 'label', 'ऑटो पर्याय', 'Auto alternate', '{}', 320),
('meal.freq_warning', 'label', 'कुटुंब नियोजन प्राधान्यांच्या मर्यादेत योग्य शाकाहारी पर्याय उपलब्ध नाही', 'No suitable alternate within household frequency preferences', '{}', 321),
('meal.editor_summary', 'action', 'सदस्यांचे जेवण बदला', 'Change for this day', '{}', 322),
('meal.change_label', 'label', 'आजचा बदल', 'Change for this day', '{}', 323),
('meal.revert_label', 'action', 'मूळ निवडीवर परत या', 'Revert to automatic', '{}', 324),
('meal.balance_mini_title', 'label', 'जेवणाचा समतोल', 'Meal balance', '{}', 325),
('meal.prev_day', 'action', 'मागील दिवस', 'Previous day', '{}', 326),
('meal.next_day', 'action', 'पुढील दिवस', 'Next day', '{}', 327),
('meal.back', 'action', 'मागे', 'Back', '{}', 328),

-- Meal Balance Indicators
('balance.protein_source', 'balance', 'प्रथिनांचा स्रोत', 'Protein source', '{}', 330),
('balance.vegetable_component', 'balance', 'भाजीपाला घटक', 'Vegetable component', '{}', 331),
('balance.pulse_legume', 'balance', 'डाळ / कडधान्य', 'Pulse / legume', '{}', 332),
('balance.whole_grain', 'balance', 'पूर्ण धान्याचा घटक', 'Whole-grain component', '{}', 333),
('balance.fruit_component', 'balance', 'फळांचा घटक', 'Fruit component', '{}', 334),
('balance.oil_consideration', 'balance', 'तेलाचा विचार', 'Oil consideration', '{}', 335),

-- Oil Snapshot
('oil.target_kicker', 'oil', 'घरचे नियोजन', 'HOUSEHOLD TARGET', '{}', 340),
('oil.target_title', 'oil', 'खाद्यतेल नियोजन', 'Cooking Oil Planning', '{}', 341),
('oil.stock_suffix', 'oil', 'साठा', 'stock', '{}', 342),
('oil.within_target', 'oil', 'टार्गेटच्या आत आहे', 'Within target', '{}', 343),
('oil.stock_above', 'oil', 'साठा जास्त आहे', 'Stock above target', '{}', 344),
('oil.monthly_desc', 'oil', 'मासिक नियोजन टार्गेट', 'monthly planning target', '{}', 345),
('oil.household_label', 'oil', 'घरगुती', 'household', '{}', 346),
('oil.btn_change_target', 'action', 'Target बदलायचा? →', 'Change target? →', '{}', 347),

-- TTS Controls & Speech Templates
('tts.listen', 'action', 'ऐका', 'Listen', '{}', 350),
('tts.stop', 'action', 'थांबवा', 'Stop', '{}', 351),
('tts.speech_today_plate', 'tts', 'आजच्या ताटात:', 'What are we eating today:', '{}', 352),
('tts.speech_today_learn', 'tts', 'अन्न → पोषण → शरीर. प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.', 'Food to nutrition to body. Understand what each food contributes to the body.', '{}', 353),
('tts.speech_prep_time', 'tts', 'तयारीची वेळ:', 'Cooking time:', '{}', 354),
('tts.speech_for_servings', 'tts', 'व्यक्तींसाठी.', 'servings.', '{}', 355),
('tts.speech_ingredients', 'tts', 'साहित्य:', 'Ingredients:', '{}', 356),
('tts.speech_nutrition', 'tts', 'पोषण:', 'Nutrition:', '{}', 357),
('tts.speech_note', 'tts', 'नोंद:', 'Note:', '{}', 358),
('tts.speech_nutrition_details', 'tts', 'पोषण माहिती:', 'Nutrition details:', '{}', 359),

-- Common Actions & Toasts
('btn.close', 'action', 'बंद करा', 'Close', '{}', 370),
('btn.cancel', 'action', 'रद्द करा', 'Cancel', '{}', 371),
('btn.save', 'action', 'जतन करा', 'Save', '{}', 372),
('msg.saved', 'message', 'जतन झाले · Saved', 'Saved', '{}', 373),
('msg.cloud_sync_failed', 'message', 'Cloud sync failed / सेटिंग्ज क्लाउडमध्ये जतन होऊ शकली नाही', 'Cloud sync failed', '{}', 374),
('msg.cloud_sync_error', 'message', 'Cloud sync error · क्लाउड जतन अयशस्वी', 'Cloud sync error', '{}', 375),
('msg.cloud_sync_unavailable', 'message', 'Cloud sync unavailable · क्लाउड sync उपलब्ध नाही. Local data चालू आहे.', 'Cloud sync unavailable. Local data active.', '{}', 376),
('msg.recipe_detail_soon', 'message', 'पाककृती तपशील लवकरच उपलब्ध होईल', 'Recipe detail coming soon', '{}', 377),
('msg.recipe_name_required', 'message', 'नाव आवश्यक आहे', 'Recipe name is required', '{}', 378),
('msg.recipe_saved', 'message', 'पाककृती जतन झाली', 'Recipe saved', '{}', 379),
('msg.meal_updated', 'message', 'वेळापत्रक बदलले', 'Meal updated', '{}', 380),
('msg.added_to_shopping', 'message', 'खरेदी यादीत जोडले', 'Added to shopping', '{}', 381),
('msg.item_removed', 'message', 'वस्तू काढली', 'Item removed', '{}', 382),
('msg.prep_task_required', 'message', 'तयारीचे नाव आवश्यक आहे', 'Prep task is required', '{}', 383),
('msg.prep_task_added', 'message', 'तयारी जोडली', 'Prep task added', '{}', 384),
('msg.prep_task_removed', 'message', 'तयारी काढली', 'Prep task removed', '{}', 385),
('msg.settings_saved', 'message', 'घरची settings जतन झाली', 'Household settings saved', '{}', 386),
('msg.backup_restored', 'message', 'बॅकअप परत आला', 'Backup restored', '{}', 387),
('msg.invalid_backup_file', 'message', 'चुकीची बॅकअप फाइल', 'Invalid backup file', '{}', 388),
('msg.confirm_reset_starter', 'message', 'सर्व स्थानिक बदल काढायचे?', 'Reset local changes?', '{}', 389)
on conflict (content_key) do update set
  category = excluded.category,
  marathi = excluded.marathi,
  english = excluded.english,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
