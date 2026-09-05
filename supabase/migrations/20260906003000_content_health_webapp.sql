create table if not exists public.health_tips (
  id uuid primary key default gen_random_uuid(), tip_key text not null unique, category text not null, title text not null, marathi_title text not null, summary text not null, marathi_summary text not null, detail text not null, marathi_detail text not null, action text not null, marathi_action text not null, source_label text, source_url text, priority integer not null default 0, sort_order integer not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.health_targets (
  id uuid primary key default gen_random_uuid(), target_key text not null unique, category text not null, label text not null, marathi_label text not null, value numeric(10,2), value_text text, unit text, period_text text, context text not null, marathi_context text not null, source_label text, source_url text, sort_order integer not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.household_settings (
  household_id uuid primary key references public.households(id) on delete cascade, display_name text not null default 'कुटुंब भोजन', household_size integer not null default 4 check (household_size between 1 and 20), oil_stock_ml integer not null default 5000 check (oil_stock_ml >= 0), oil_monthly_target_ml integer not null default 3000 check (oil_monthly_target_ml > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists health_tips_category_idx on public.health_tips(category, sort_order);
create index if not exists health_targets_category_idx on public.health_targets(category, sort_order);
alter table public.health_tips enable row level security;
alter table public.health_targets enable row level security;
alter table public.household_settings enable row level security;
drop policy if exists health_tips_authenticated_select on public.health_tips;
create policy health_tips_authenticated_select on public.health_tips for select to authenticated using (true);
drop policy if exists health_targets_authenticated_select on public.health_targets;
create policy health_targets_authenticated_select on public.health_targets for select to authenticated using (true);
drop policy if exists household_settings_member_all on public.household_settings;
create policy household_settings_member_all on public.household_settings for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
grant select on public.health_tips to authenticated;
grant select on public.health_targets to authenticated;
grant select, insert, update, delete on public.household_settings to authenticated;
revoke all on public.health_tips from anon;
revoke all on public.health_targets from anon;
revoke all on public.household_settings from anon;
-- Seed data is managed in the same production migration; see the canonical migration history.
-- The following values are intentionally general public-health guidance, not medical prescriptions.
insert into public.health_targets (target_key,category,label,marathi_label,value,value_text,unit,period_text,context,marathi_context,source_label,source_url,sort_order) values
('salt_adult_daily','Salt / मीठ','Salt','मीठ',5,'< 5','g/day','per adult day','General WHO reference for adults; household cooking needs vary.','प्रौढांसाठी WHO चा सामान्य संदर्भ; घरच्या स्वयंपाकातील गरज वेगळी असू शकते.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',10),
('free_sugar_daily_2000kcal','Free sugar / साखर','Free sugar at 2,000 kcal','२,००० kcal वर free sugar',50,'< 50','g/day','per day','Approximate WHO example for a healthy-weight adult consuming 2,000 kcal; individual needs differ.','२,००० kcal घेणाऱ्या healthy-weight प्रौढासाठी WHO चा उदाहरणात्मक संदर्भ; वैयक्तिक गरजा वेगळ्या असतात.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',20),
('fruit_veg_10plus_daily','Fruit & vegetables','Fruit + vegetables','फळे + भाज्या',400,'≥ 400','g/day','per person >10 years','General WHO reference for people older than 10.','१० वर्षांपेक्षा मोठ्यांसाठी WHO चा सामान्य संदर्भ.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',30),
('fibre_10plus_daily','Fibre / तंतू','Naturally occurring fibre','नैसर्गिक आहारातील तंतू',25,'≥ 25','g/day','per person >10 years','General WHO reference for people older than 10.','१० वर्षांपेक्षा मोठ्यांसाठी WHO चा सामान्य संदर्भ.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',40),
('household_oil_planning','Oil / तेल','Household oil planning target','घरचा तेल planning target',3000,'3,000','ml/month','household planning','A configurable planning target, not a medical limit. Change it in Settings based on the household pattern and professional advice when needed.','हा configurable planning target आहे; medical limit नाही. घरच्या आहाराच्या pattern नुसार आणि गरज असल्यास तज्ज्ञांच्या सल्ल्याने Settings मध्ये बदला.','Kutumb Bhojan household planning','',50)
on conflict (target_key) do update set label=excluded.label,marathi_label=excluded.marathi_label,value=excluded.value,value_text=excluded.value_text,unit=excluded.unit,period_text=excluded.period_text,context=excluded.context,marathi_context=excluded.marathi_context,source_label=excluded.source_label,source_url=excluded.source_url,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();
create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid; uid uuid := auth.uid(); is_anon boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
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
  insert into public.household_settings(household_id,display_name) values (h,coalesce(nullif(trim(household_name), ''),'कुटुंब भोजन')) on conflict (household_id) do nothing;
  return h;
end; $$;
revoke all on function public.bootstrap_household(text) from public;
grant execute on function public.bootstrap_household(text) to authenticated;
revoke execute on function public.bootstrap_household(text) from anon;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_settings') then
    alter publication supabase_realtime add table public.household_settings;
  end if;
end $$;

insert into public.health_tips (tip_key,category,title,marathi_title,summary,marathi_summary,detail,marathi_detail,action,marathi_action,source_label,source_url,priority,sort_order) values
('oil_measured','Oil / तेल','Measure oil instead of free-pouring','तेल मोजून वापरा, अंदाजाने ओतू नका','A measuring spoon or small bottle makes oil use visible.','मोजण्याचा चमचा किंवा छोटी बाटली वापरल्यास तेलाचा वापर स्पष्ट दिसतो.','Use the household oil target as a planning budget, not a clinical limit.','घरचा तेल target हा planning budget म्हणून वापरा; तो clinical limit नाही.','Measure oil before cooking and review the monthly total.','स्वयंपाकाआधी तेल मोजा आणि महिन्याचा एकूण वापर तपासा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',100,10),
('oil_where_less','Oil / तेल','Where to use less oil','कुठे तेल कमी करायचे?','Deep frying, oil-heavy tadka and very oily gravies are easy places to reduce.','डीप-फ्राय, जास्त तेलाचा तडका आणि खूप तेलकट gravy हे कमी करण्यासाठी सोपे भाग आहेत.','Prefer measured oil, roasting, steaming, pressure cooking or shallow cooking where suitable. Avoid repeatedly reusing frying oil.','योग्य ठिकाणी मोजून तेल, भाजणे, वाफवणे, pressure cooking किंवा कमी तेलात cooking वापरा. तळलेले तेल वारंवार वापरू नका.','Keep deep-fried foods occasional.','डीप-फ्राय पदार्थ occasional ठेवा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',95,20),
('salt','Salt / मीठ','Keep salt modest','मीठ मोजून आणि कमी प्रमाणात','Adults should generally keep salt below 5 g/day.','प्रौढांसाठी साधारणपणे दिवसाला ५ ग्रॅमपेक्षा कमी मीठ ठेवण्याचा सामान्य संदर्भ आहे.','Salt also comes from packaged foods, pickles, papad, sauces and salty snacks.','पॅकेज्ड पदार्थ, लोणची, पापड, सॉस आणि खारट snacks मधूनही मीठ येते.','Taste before adding extra salt.','वरून मीठ वाढवण्याआधी चव पाहा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',90,30),
('fruit_veg','Fruit & vegetables / फळे-भाज्या','Build the plate around plants','ताटाचा मोठा भाग फळे-भाज्यांनी समृद्ध ठेवा','WHO gives 400 g/day as a general reference for people older than 10.','१० वर्षांपेक्षा मोठ्यांसाठी WHO ४०० ग्रॅम/दिवस हा सामान्य संदर्भ देते.','Rotate leafy vegetables, gourds, cruciferous vegetables, seasonal fruit and fresh sides.','पालेभाज्या, दुधीवर्गीय भाज्या, कोबी-फुलकोबी, हंगामी फळे आणि ताजे side बदलून वापरा.','Add a vegetable or fruit side before extra snack foods.','अतिरिक्त snack घेण्याआधी भाजी किंवा फळाचा side वाढवा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',85,40),
('fibre','Fibre / तंतू','Prefer whole grains and pulses','संपूर्ण धान्ये आणि कडधान्यांना प्राधान्य','WHO gives 25 g/day of naturally occurring fibre as a general reference for people older than 10.','१० वर्षांपेक्षा मोठ्यांसाठी नैसर्गिक आहारातील तंतू २५ ग्रॅम/दिवस हा सामान्य संदर्भ आहे.','Whole grains, pulses, vegetables, fruit, nuts and seeds can build fibre into ordinary meals.','संपूर्ण धान्ये, कडधान्ये, भाज्या, फळे, nuts आणि seeds रोजच्या जेवणातून तंतू वाढवतात.','Rotate wheat, jowar, ragi, rice and pulses.','गहू, ज्वारी, नाचणी, तांदूळ आणि कडधान्ये बदलून वापरा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',80,50),
('sugar','Free sugar / साखर','Keep free sugar low','अॅडेड/फ्री साखर कमी ठेवा','WHO recommends free sugars below 10% of total energy, with further benefit below 5%.','WHO नुसार free sugar एकूण ऊर्जेच्या १०% पेक्षा कमी ठेवावी; ५% पेक्षा कमी ठेवल्यास आणखी फायदा होऊ शकतो.','This includes sugar added at home and sugars in sweet drinks, syrups, honey and fruit juices.','यात घरात घातलेली साखर तसेच गोड पेये, सिरप, मध आणि फळांच्या रसातील free sugar येते.','Prefer whole fruit and unsweetened drinks.','पूर्ण फळे आणि साखर न घातलेली पेये निवडा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',75,60),
('fried_packaged','Fried & packaged / तळलेले-पॅकेज्ड','Make fried and highly processed foods occasional','तळलेले आणि अतिप्रक्रियायुक्त पदार्थ occasional ठेवा','Foods high in unhealthy fats, free sugars and sodium are best limited.','अस्वास्थ्यकर चरबी, free sugar आणि sodium जास्त असलेले पदार्थ मर्यादित ठेवणे योग्य आहे.','Home-cooked food makes oil, salt and ingredient control easier.','घरचे जेवण केल्यास तेल, मीठ आणि साहित्य नियंत्रित करणे सोपे जाते.','Choose roasted, steamed or fresh snacks more often.','भाजलेले, वाफवलेले किंवा ताजे snacks जास्त वेळा निवडा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',70,70),
('protein_diversity','Protein / प्रथिने','Rotate protein sources','प्रथिनांचे स्रोत बदलत ठेवा','Pulses, beans, dairy, eggs, soy and nuts can all contribute to a varied diet.','डाळी, कडधान्ये, दूध-दही, अंडी, सोया आणि nuts यामुळे प्रथिनांची विविधता ठेवता येते.','Across the week, rotate protein-rich foods and pair them with vegetables and whole-food carbohydrates.','आठवडाभर protein-rich पदार्थ बदलत ठेवा आणि त्यांना भाज्या व संपूर्ण अन्नातील carbohydrates सोबत द्या.','Check the weekly calendar for protein variety.','आठवड्याच्या calendar मध्ये protein variety तपासा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',65,80),
('water','Hydration / पाणी','Make water the default drink','पाण्याला default पेय ठेवा','Hydration needs vary, so the app does not prescribe one universal litre target.','पाण्याची गरज बदलत असल्याने app एकच universal litre target देत नाही.','Heat, activity and body size change fluid needs. Keep water easy to reach.','उष्णता, activity आणि शरीराचा आकार पाण्याची गरज बदलतात. पाणी सहज उपलब्ध ठेवा.','Keep a refillable bottle visible.','दिवसभर refill करता येणारी बाटली जवळ ठेवा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',60,90),
('food_safety','Food safety / अन्नसुरक्षा','Cook, store and reheat safely','अन्न सुरक्षितपणे शिजवा, साठवा आणि गरम करा','Healthy food must also be safe from microbial and chemical contamination.','पौष्टिक अन्नासोबत अन्न सुरक्षित असणेही महत्त्वाचे आहे.','Keep raw and cooked foods separate, cook thoroughly where required and store leftovers safely.','कच्चे आणि शिजलेले अन्न वेगळे ठेवा, आवश्यक पदार्थ पूर्ण शिजवा आणि उरलेले अन्न सुरक्षितपणे साठवा.','Use Prep to mark foods that should be used first.','Prep मध्ये आधी वापरायचे पदार्थ स्पष्ट ठेवा.','WHO — Healthy diet','https://www.who.int/news-room/fact-sheets/detail/healthy-diet',55,100)
on conflict (tip_key) do update set title=excluded.title,marathi_title=excluded.marathi_title,summary=excluded.summary,marathi_summary=excluded.marathi_summary,detail=excluded.detail,marathi_detail=excluded.marathi_detail,action=excluded.action,marathi_action=excluded.marathi_action,source_label=excluded.source_label,source_url=excluded.source_url,priority=excluded.priority,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();
