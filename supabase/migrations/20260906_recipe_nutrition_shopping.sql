-- Kutumb Bhojan Phase 2: canonical ingredients, structured recipes, assignments and nutrition education.
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  name text not null,
  marathi_name text not null,
  aliases jsonb not null default '[]'::jsonb,
  category text,
  default_unit text not null check (default_unit in ('g','kg','ml','L','piece','tsp','tbsp','cup')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes add column if not exists description text;
alter table public.recipes add column if not exists marathi_description text;
alter table public.recipes add column if not exists meal_category text;
alter table public.recipes add column if not exists meal_role text;
alter table public.recipes add column if not exists servings numeric not null default 4 check (servings > 0);
alter table public.recipes add column if not exists cooking_method text;
alter table public.recipes add column if not exists dietary_flags jsonb not null default '{}'::jsonb;
alter table public.recipes add column if not exists nutrition_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric not null check (quantity >= 0),
  unit text not null check (unit in ('g','kg','ml','L','piece','tsp','tbsp','cup')),
  display_text text,
  preparation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, ingredient_id, sort_order)
);
create index if not exists recipe_ingredients_household_idx on public.recipe_ingredients(household_id);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);

create table if not exists public.dietary_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  rule_key text not null,
  ingredient_key text not null,
  allowed_member_ids jsonb not null default '[]'::jsonb,
  disallowed_member_ids jsonb not null default '[]'::jsonb,
  alternate_policy text not null default 'vegetarian-existing',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, rule_key)
);

create table if not exists public.meal_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_entry_id uuid not null references public.meal_entries(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  portion_factor numeric not null default 1 check (portion_factor > 0),
  assignment_source text not null default 'automatic' check (assignment_source in ('automatic','manual')),
  automatic_recipe_id uuid references public.recipes(id) on delete set null,
  override_recipe_id uuid references public.recipes(id) on delete set null,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_entry_id, member_id)
);
create index if not exists meal_assignments_household_idx on public.meal_assignments(household_id);
create index if not exists meal_assignments_meal_idx on public.meal_assignments(meal_entry_id);

create table if not exists public.nutrition_education (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null unique,
  title text not null,
  marathi_title text not null,
  what text not null,
  marathi_what text not null,
  body_use text not null,
  marathi_body_use text not null,
  function text not null,
  marathi_function text not null,
  why_it_matters text not null,
  marathi_why_it_matters text not null,
  food_sources text not null,
  marathi_food_sources text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.dietary_rules enable row level security;
alter table public.meal_assignments enable row level security;
alter table public.nutrition_education enable row level security;

revoke all on public.ingredients from anon;
revoke all on public.recipe_ingredients from anon;
revoke all on public.dietary_rules from anon;
revoke all on public.meal_assignments from anon;
revoke all on public.nutrition_education from anon;
grant select on public.ingredients to authenticated;
grant select,insert,update,delete on public.recipe_ingredients to authenticated;
grant select,insert,update,delete on public.dietary_rules to authenticated;
grant select,insert,update,delete on public.meal_assignments to authenticated;
grant select on public.nutrition_education to authenticated;

create policy ingredients_authenticated_select on public.ingredients for select to authenticated using (active = true);
create policy recipe_ingredients_member_all on public.recipe_ingredients for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));
create policy dietary_rules_member_all on public.dietary_rules for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));
create policy meal_assignments_member_all on public.meal_assignments for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));
create policy nutrition_education_authenticated_select on public.nutrition_education for select to authenticated using (active = true);

insert into public.ingredients(canonical_key,name,marathi_name,aliases,category,default_unit) values
('onion','Onion','कांदा','["onion","onions","कांदा","कांदे"]','Vegetables','g'),
('tomato','Tomato','टोमॅटो','["tomato","tomatoes","टोमॅटो"]','Vegetables','g'),
('carrot','Carrot','गाजर','["carrot","carrots","गाजर"]','Vegetables','g'),
('cabbage','Cabbage','कोबी','["cabbage","कोबी"]','Vegetables','g'),
('spinach','Spinach','पालक','["spinach","palak","पालक"]','Vegetables','g'),
('cucumber','Cucumber','काकडी','["cucumber","काकडी"]','Vegetables','g'),
('bhindi','Okra','भेंडी','["bhindi","okra","भेंडी"]','Vegetables','g'),
('bottle_gourd','Bottle gourd','दुधी भोपळा','["dudhi","bottle gourd","दुधी भोपळा"]','Vegetables','g'),
('brinjal','Brinjal','वांगी','["brinjal","vangi","वांगी"]','Vegetables','g'),
('cauliflower','Cauliflower','फुलकोबी','["cauliflower","फुलकोबी"]','Vegetables','g'),
('moong_dal','Moong dal','मूग डाळ','["moong dal","moong","मूग डाळ"]','Pulses & Legumes','g'),
('chickpeas','Chickpeas','हरभरा','["chickpeas","chana","kabuli chana","हरभरा"]','Pulses & Legumes','g'),
('rajma','Rajma','राजमा','["rajma","राजमा"]','Pulses & Legumes','g'),
('matki','Matki','मटकी','["matki","मटकी"]','Pulses & Legumes','g'),
('lobia','Lobia','चवळी','["lobia","चवळी"]','Pulses & Legumes','g'),
('soy_granules','Soy granules','सोया ग्रॅन्युल्स','["soy granules","soy","सोया ग्रॅन्युल्स"]','Pulses & Legumes','g'),
('paneer','Paneer','पनीर','["paneer","पनीर"]','Dairy','g'),
('curd','Plain curd','साधे दही','["curd","plain curd","दही"]','Dairy','g'),
('milk','Milk','दूध','["milk","दूध"]','Dairy','ml'),
('egg','Egg','अंडे','["egg","eggs","अंडे","अंडी"]','Eggs','piece'),
('whole_wheat_flour','Whole-wheat flour','गव्हाचे पीठ','["whole-wheat flour","atta","गव्हाचे पीठ"]','Whole Grains','g'),
('jowar_flour','Jowar flour','ज्वारीचे पीठ','["jowar flour","jowar","ज्वारीचे पीठ"]','Whole Grains','g'),
('rice','Rice','तांदूळ','["rice","तांदूळ"]','Grains','g'),
('poha','Poha','पोहे','["poha","flattened rice","पोहे"]','Grains','g'),
('besan','Besan','बेसन','["besan","gram flour","बेसन"]','Pulses & Legumes','g'),
('peanuts','Peanuts','शेंगदाणे','["peanuts","peanut","शेंगदाणे"]','Nuts & Seeds','g'),
('banana','Banana','केळे','["banana","bananas","केळी"]','Fruits','piece'),
('guava','Guava','पेरू','["guava","पेरू"]','Fruits','piece'),
('papaya','Papaya','पपई','["papaya","पपई"]','Fruits','g'),
('pomegranate','Pomegranate','डाळिंब','["pomegranate","डाळिंब"]','Fruits','g'),
('mosambi','Sweet lime','मोसंबी','["mosambi","sweet lime","मोसंबी"]','Fruits','piece'),
('apple','Apple','सफरचंद','["apple","apples","सफरचंद"]','Fruits','piece'),
('flaxseed','Flaxseed','जवस','["flaxseed","flax","जवस"]','Nuts & Seeds','g'),
('pumpkin_seeds','Pumpkin seeds','भोपळ्याच्या बिया','["pumpkin seeds","भोपळ्याच्या बिया"]','Nuts & Seeds','g'),
('oil','Cooking oil','खाद्यतेल','["oil","cooking oil","तेल"]','Other','ml')
on conflict (canonical_key) do update set name=excluded.name,marathi_name=excluded.marathi_name,aliases=excluded.aliases,category=excluded.category,default_unit=excluded.default_unit,active=true,updated_at=now();

insert into public.nutrition_education(concept_key,title,marathi_title,what,marathi_what,body_use,marathi_body_use,function,marathi_function,why_it_matters,marathi_why_it_matters,food_sources,marathi_food_sources,sort_order) values
('protein','Protein','प्रथिने','A nutrient used to build and repair body tissues.','शरीराच्या ऊती तयार करण्यासाठी आणि दुरुस्तीसाठी उपयोगी पोषक घटक.','Muscles, organs and many body structures use protein.','स्नायू, अवयव आणि शरीरातील अनेक रचना प्रथिनांचा वापर करतात.','Supports tissue building, repair and many body processes.','ऊतींची वाढ, दुरुस्ती आणि शरीरातील अनेक प्रक्रियांना मदत करते.','Regular protein-rich foods help make meals more nourishing.','नियमित प्रथिनयुक्त पदार्थ जेवण अधिक पौष्टिक बनवण्यास मदत करतात.','Dal, beans, chickpeas, soy, paneer, curd and eggs.','डाळी, कडधान्ये, हरभरा, सोया, पनीर, दही आणि अंडी. ',1),
('fibre','Fibre','आहारातील तंतू','A group of carbohydrate components found mainly in plant foods.','मुख्यतः वनस्पतीजन्य पदार्थांमध्ये आढळणारे कार्बोहायड्रेटचे घटक.','It moves through the digestive system and supports normal bowel function.','ते पचनसंस्थेतून पुढे जाते आणि नियमित शौचास मदत करते.','Adds bulk to meals and supports digestive health.','जेवणात तंतुमयता वाढवते आणि पचनाच्या आरोग्यास मदत करते.','Fibre-rich foods improve meal quality and variety.','तंतुमय पदार्थ जेवणाची गुणवत्ता आणि विविधता वाढवतात.','Whole grains, pulses, vegetables, fruits, nuts and seeds.','पूर्ण धान्ये, डाळी-कडधान्ये, भाज्या, फळे, कडधान्ये आणि बिया. ',2),
('carbohydrates','Carbohydrates','कर्बोदके','A major energy-providing nutrient found in grains, pulses, fruits and other foods.','धान्ये, डाळी-कडधान्ये, फळे आणि इतर पदार्थांमध्ये आढळणारा प्रमुख ऊर्जा देणारा पोषक घटक.','Glucose from carbohydrate foods is used by cells for energy.','कर्बोदकांपासून मिळणारा ग्लुकोज पेशी ऊर्जा मिळवण्यासाठी वापरतात.','Provides energy for daily activity and exercise.','दैनंदिन हालचाल आणि व्यायामासाठी ऊर्जा पुरवते.','Choosing varied grain and plant foods improves meal diversity.','विविध धान्ये आणि वनस्पतीजन्य पदार्थ निवडल्याने आहारातील विविधता वाढते.','Rice, roti, jowar, oats, poha, pulses and fruit.','भात, पोळी, ज्वारी, ओट्स, पोहे, डाळी-कडधान्ये आणि फळे. ',3),
('fat_quality','Dietary fat and fat quality','आहारातील चरबी आणि तिची गुणवत्ता','Dietary fat supplies energy and helps the body use fat-soluble vitamins.','आहारातील चरबी ऊर्जा देते आणि चरबीमध्ये विरघळणारी जीवनसत्त्वे वापरण्यास शरीराला मदत करते.','Cell membranes and some hormones depend on dietary fats.','पेशींच्या झिल्ली आणि काही हार्मोन्ससाठी आहारातील चरबी महत्त्वाची असते.','The type and amount of fat both matter.','चरबीचा प्रकार आणि प्रमाण दोन्ही महत्त्वाचे असतात.','Use varied plant foods and keep highly fatty cooking methods moderate.','विविध वनस्पतीजन्य पदार्थ वापरा आणि खूप तेलकट cooking पद्धती माफक ठेवा.','Nuts, seeds and measured cooking oils; limit frequent deep-frying.','कडधान्ये, बिया आणि मोजून वापरलेले खाद्यतेल; वारंवार डीप-फ्राय कमी ठेवा. ',4),
('vegetables','Vegetables','भाज्या','Plant foods that provide fibre and many vitamins, minerals and protective compounds.','तंतू तसेच अनेक जीवनसत्त्वे, खनिजे आणि उपयुक्त वनस्पती घटक देणारे वनस्पतीजन्य पदार्थ.','Different vegetables provide different nutrients and plant compounds.','वेगवेगळ्या भाज्यांमधून वेगवेगळी पोषकतत्त्वे आणि वनस्पती घटक मिळतात.','Adds variety, colour, texture and nutrients to meals.','जेवणात विविधता, रंग, पोत आणि पोषकतत्त्वे वाढवते.','Including vegetables across meals supports dietary diversity.','वेगवेगळ्या जेवणांमध्ये भाज्या ठेवल्याने आहारातील विविधता वाढते.','Leafy greens, gourds, cabbage, carrot, tomato, cucumber and seasonal vegetables.','पालेभाज्या, दुधी, कोबी, गाजर, टोमॅटो, काकडी आणि हंगामी भाज्या. ',5),
('fruits','Fruits','फळे','Whole fruits provide fibre and a range of vitamins, minerals and plant compounds.','संपूर्ण फळांमधून तंतू तसेच विविध जीवनसत्त्वे, खनिजे आणि वनस्पती घटक मिळतात.','Fibre and water in whole fruit contribute to normal digestive function.','फळांतील तंतू आणि पाणी नियमित पचनक्रियेस मदत करतात.','Adds variety and naturally occurring nutrients to meals and snacks.','जेवण आणि snacks मध्ये विविधता व नैसर्गिक पोषकतत्त्वे वाढवते.','Whole fruit is a practical way to increase plant-food variety.','संपूर्ण फळे खाल्ल्याने वनस्पतीजन्य पदार्थांची विविधता वाढवता येते.','Guava, banana, papaya, apple, pomegranate and seasonal fruit.','पेरू, केळी, पपई, सफरचंद, डाळिंब आणि हंगामी फळे. ',6),
('whole_grains','Whole grains','पूर्ण धान्ये','Grains that retain more of the grain structure and naturally occurring components.','धान्याचा अधिक नैसर्गिक भाग टिकवून ठेवणारी धान्ये.','They contribute carbohydrate, fibre and other nutrients.','त्यातून कर्बोदके, तंतू आणि इतर पोषकतत्त्वे मिळतात.','Can improve the nutrient and fibre profile of meals.','जेवणातील पोषकतत्त्वे आणि तंतूंचे प्रमाण सुधारण्यास मदत करू शकतात.','Mixing whole-grain options increases dietary variety.','पूर्ण धान्यांचे पर्याय मिसळल्याने आहारातील विविधता वाढते.','Jowar, whole-wheat flour and other minimally refined grains.','ज्वारी, गव्हाचे पीठ आणि इतर कमी प्रक्रिया केलेली धान्ये. ',7),
('legumes','Pulses and legumes','डाळी आणि कडधान्ये','Edible seeds such as dals, beans, chickpeas and sprouts.','डाळी, कडधान्ये, हरभरा आणि मोड आलेली कडधान्ये यांसारख्या खाद्य बिया.','They provide protein, carbohydrate, fibre and other nutrients.','त्यातून प्रथिने, कर्बोदके, तंतू आणि इतर पोषकतत्त्वे मिळतात.','They are versatile plant-based protein foods.','ही बहुउपयोगी वनस्पतीजन्य प्रथिनांची साधने आहेत.','Regular variety across pulses helps keep meals diverse.','डाळी-कडधान्यांमध्ये विविधता ठेवल्याने जेवणात वैविध्य राहते.','Moong, chana, rajma, lobia, matki, mixed dals and soy.','मूग, हरभरा, राजमा, चवळी, मटकी, मिश्र डाळी आणि सोया. ',8),
('main_protein','Main protein source','मुख्य प्रथिनांचा स्रोत','The main food in a meal that contributes a meaningful protein component.','जेवणातील प्रथिनांचा महत्त्वाचा वाटा देणारा मुख्य पदार्थ.','It can come from pulses, soy, dairy or eggs depending on the meal.','जेवणानुसार तो डाळी-कडधान्ये, सोया, दुग्धजन्य पदार्थ किंवा अंड्यांमधून येऊ शकतो.','Helps make the meal structure more complete.','जेवणाची रचना अधिक संतुलित ठेवण्यास मदत करते.','Pairing varied protein sources with vegetables and grains supports meal variety.','विविध प्रथिन स्रोत भाज्या आणि धान्यांसोबत घेतल्याने जेवणातील विविधता वाढते.','Dal, beans, soy, paneer, curd and eggs.','डाळी, कडधान्ये, सोया, पनीर, दही आणि अंडी. ',9)
on conflict (concept_key) do update set title=excluded.title,marathi_title=excluded.marathi_title,what=excluded.what,marathi_what=excluded.marathi_what,body_use=excluded.body_use,marathi_body_use=excluded.marathi_body_use,function=excluded.function,marathi_function=excluded.marathi_function,why_it_matters=excluded.why_it_matters,marathi_why_it_matters=excluded.marathi_why_it_matters,food_sources=excluded.food_sources,marathi_food_sources=excluded.marathi_food_sources,sort_order=excluded.sort_order,active=true,updated_at=now();

create or replace function public.validate_phase2_household_integrity() returns trigger language plpgsql security definer set search_path=public as $function$
declare owner_household uuid;
begin
  if tg_table_name='recipe_ingredients' then
    select household_id into owner_household from public.recipes where id=new.recipe_id;
    if owner_household is null or owner_household<>new.household_id then raise exception 'recipe_ingredients household mismatch'; end if;
  elsif tg_table_name='meal_assignments' then
    select household_id into owner_household from public.meal_entries where id=new.meal_entry_id;
    if owner_household is null or owner_household<>new.household_id then raise exception 'meal_assignments meal household mismatch'; end if;
    select household_id into owner_household from public.family_members where id=new.member_id;
    if owner_household is null or owner_household<>new.household_id then raise exception 'meal_assignments member household mismatch'; end if;
    if new.recipe_id is not null then select household_id into owner_household from public.recipes where id=new.recipe_id; if owner_household is null or owner_household<>new.household_id then raise exception 'meal_assignments recipe household mismatch'; end if; end if;
  end if;
  return new;
end; $function$;
drop trigger if exists recipe_ingredients_household_integrity on public.recipe_ingredients;
create trigger recipe_ingredients_household_integrity before insert or update on public.recipe_ingredients for each row execute function public.validate_phase2_household_integrity();
drop trigger if exists meal_assignments_household_integrity on public.meal_assignments;
create trigger meal_assignments_household_integrity before insert or update on public.meal_assignments for each row execute function public.validate_phase2_household_integrity();
revoke all on function public.validate_phase2_household_integrity() from public,anon,authenticated;
create index if not exists meal_assignments_member_idx on public.meal_assignments(member_id);
create index if not exists meal_assignments_recipe_idx on public.meal_assignments(recipe_id);
create index if not exists meal_assignments_automatic_recipe_idx on public.meal_assignments(automatic_recipe_id);
create index if not exists meal_assignments_override_recipe_idx on public.meal_assignments(override_recipe_id);
create index if not exists recipe_ingredients_ingredient_idx on public.recipe_ingredients(ingredient_id);
