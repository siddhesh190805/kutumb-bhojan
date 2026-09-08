create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_key text not null,
  name text not null,
  marathi_name text not null,
  age integer not null,
  sex text,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  activity text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, member_key)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_key text not null,
  name text not null,
  marathi_name text not null,
  course text,
  time_text text,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  protein text,
  fibre text,
  calories text,
  oil text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, recipe_key)
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('Breakfast','Lunch','Snack','Dinner')),
  title text not null,
  marathi_title text,
  status text not null default 'Planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date, slot)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_key text not null,
  item text not null,
  marathi_item text,
  category text,
  frequency text,
  need_to_buy boolean not null default true,
  purchased boolean not null default false,
  quantity text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, item_key)
);

create table if not exists public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_key text not null,
  task text not null,
  marathi_task text,
  task_date date,
  done boolean not null default false,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, task_key)
);

create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists family_members_household_idx on public.family_members(household_id);
create index if not exists recipes_household_idx on public.recipes(household_id);
create index if not exists meal_entries_household_date_idx on public.meal_entries(household_id, meal_date);
create index if not exists shopping_items_household_idx on public.shopping_items(household_id);
create index if not exists prep_tasks_household_date_idx on public.prep_tasks(household_id, task_date);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.family_members enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_entries enable row level security;
alter table public.shopping_items enable row level security;
alter table public.prep_tasks enable row level security;

drop policy if exists households_member_select on public.households;
create policy households_member_select on public.households for select to authenticated using (public.is_household_member(id));

drop policy if exists household_members_self_select on public.household_members;
create policy household_members_self_select on public.household_members for select to authenticated using ((select auth.uid()) = user_id or (select public.is_household_member(household_id)));

drop policy if exists family_members_member_all on public.family_members;
create policy family_members_member_all on public.family_members for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

drop policy if exists recipes_member_all on public.recipes;
create policy recipes_member_all on public.recipes for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

drop policy if exists meal_entries_member_all on public.meal_entries;
create policy meal_entries_member_all on public.meal_entries for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

drop policy if exists shopping_items_member_all on public.shopping_items;
create policy shopping_items_member_all on public.shopping_items for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

drop policy if exists prep_tasks_member_all on public.prep_tasks;
create policy prep_tasks_member_all on public.prep_tasks for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));

create or replace function public.bootstrap_household(household_name text default 'कुटुंब भोजन')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  h uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select hm.household_id into h
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at
  limit 1;

  if h is not null then return h; end if;

  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    select id into h
    from public.households
    where name = 'कुटुंब भोजन'
    order by created_at
    limit 1;

    if h is null then
      insert into public.households(name)
      values ('कुटुंब भोजन')
      returning id into h;
    end if;

    insert into public.household_members(household_id,user_id,role)
    values (h,uid,'member')
    on conflict (household_id,user_id) do nothing;

    return h;
  end if;

  insert into public.households(name)
  values (coalesce(nullif(trim(household_name), ''), 'कुटुंब भोजन'))
  returning id into h;

  insert into public.household_members(household_id,user_id,role)
  values (h,uid,'owner');
  return h;
end;
$$;

revoke all on function public.bootstrap_household(text) from public;
grant execute on function public.bootstrap_household(text) to authenticated;
revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
revoke all on function public.bootstrap_household(text) from anon;
revoke all on function public.is_household_member(uuid) from anon;

-- Content and household configuration layer
create table if not exists public.health_tips (
  id uuid primary key default gen_random_uuid(), tip_key text not null unique,
  category text not null, title text not null, marathi_title text not null,
  summary text not null, marathi_summary text not null, detail text not null,
  marathi_detail text not null, action text not null, marathi_action text not null,
  source_label text, source_url text, priority integer not null default 0,
  sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.health_targets (
  id uuid primary key default gen_random_uuid(), target_key text not null unique,
  category text not null, label text not null, marathi_label text not null,
  value numeric(10,2), value_text text, unit text, period_text text,
  context text not null, marathi_context text not null, source_label text,
  source_url text, sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.household_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  display_name text not null default 'कुटुंब भोजन',
  household_size integer not null default 4 check (household_size between 1 and 20),
  oil_stock_ml integer not null default 5000 check (oil_stock_ml >= 0),
  oil_monthly_target_ml integer not null default 3000 check (oil_monthly_target_ml > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.health_tips enable row level security;
alter table public.health_targets enable row level security;
alter table public.household_settings enable row level security;
drop policy if exists health_tips_authenticated_select on public.health_tips;
create policy health_tips_authenticated_select on public.health_tips for select to authenticated using (true);
drop policy if exists health_targets_authenticated_select on public.health_targets;
create policy health_targets_authenticated_select on public.health_targets for select to authenticated using (true);
drop policy if exists household_settings_member_all on public.household_settings;
create policy household_settings_member_all on public.household_settings for all to authenticated using ((select public.is_household_member(household_id))) with check ((select public.is_household_member(household_id)));
grant select on public.health_tips to authenticated;
grant select on public.health_targets to authenticated;
grant select, insert, update, delete on public.household_settings to authenticated;
revoke all on public.health_tips from anon;
revoke all on public.health_targets from anon;
revoke all on public.household_settings from anon;

-- Phase 2: canonical ingredients, structured recipe ingredients, dietary rules,
-- member-level meal assignments, and reusable nutrition education.
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(), canonical_key text not null unique,
  name text not null, marathi_name text not null, aliases jsonb not null default '[]'::jsonb,
  category text, default_unit text not null check (default_unit in ('g','kg','ml','L','piece','tsp','tbsp','cup')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
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
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric not null check (quantity >= 0), unit text not null check (unit in ('g','kg','ml','L','piece','tsp','tbsp','cup')),
  display_text text, preparation text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(recipe_id,ingredient_id,sort_order)
);
create table if not exists public.dietary_rules (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  rule_key text not null, ingredient_key text not null, allowed_member_ids jsonb not null default '[]'::jsonb,
  disallowed_member_ids jsonb not null default '[]'::jsonb, alternate_policy text not null default 'vegetarian-existing',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(household_id,rule_key)
);
create table if not exists public.meal_assignments (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  meal_entry_id uuid not null references public.meal_entries(id) on delete cascade, member_id uuid not null references public.family_members(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null, portion_factor numeric not null default 1 check(portion_factor>0),
  assignment_source text not null default 'automatic' check(assignment_source in ('automatic','manual')),
  automatic_recipe_id uuid references public.recipes(id) on delete set null, override_recipe_id uuid references public.recipes(id) on delete set null,
  override_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(meal_entry_id,member_id)
);
create table if not exists public.nutrition_education (
  id uuid primary key default gen_random_uuid(), concept_key text not null unique, title text not null, marathi_title text not null,
  what text not null, marathi_what text not null, body_use text not null, marathi_body_use text not null,
  function text not null, marathi_function text not null, why_it_matters text not null, marathi_why_it_matters text not null,
  food_sources text not null, marathi_food_sources text not null, sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.dietary_rules enable row level security;
alter table public.meal_assignments enable row level security;
alter table public.nutrition_education enable row level security;
revoke all on public.ingredients from anon; revoke all on public.recipe_ingredients from anon; revoke all on public.dietary_rules from anon; revoke all on public.meal_assignments from anon; revoke all on public.nutrition_education from anon;
grant select on public.ingredients to authenticated; grant select,insert,update,delete on public.recipe_ingredients to authenticated; grant select,insert,update,delete on public.dietary_rules to authenticated; grant select on public.nutrition_education to authenticated;
create policy ingredients_authenticated_select on public.ingredients for select to authenticated using(active=true);
create policy recipe_ingredients_member_all on public.recipe_ingredients for all to authenticated using((select public.is_household_member(household_id))) with check((select public.is_household_member(household_id)));
create policy dietary_rules_member_all on public.dietary_rules for all to authenticated using((select public.is_household_member(household_id))) with check((select public.is_household_member(household_id)));
create policy meal_assignments_member_all on public.meal_assignments for all to authenticated using((select public.is_household_member(household_id))) with check((select public.is_household_member(household_id)));
create policy nutrition_education_authenticated_select on public.nutrition_education for select to authenticated using(active=true);

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
revoke all on function public.validate_phase2_household_integrity() from public,anon,authenticated;
create index if not exists meal_assignments_member_idx on public.meal_assignments(member_id);
create index if not exists meal_assignments_recipe_idx on public.meal_assignments(recipe_id);
create index if not exists meal_assignments_automatic_recipe_idx on public.meal_assignments(automatic_recipe_id);
create index if not exists meal_assignments_override_recipe_idx on public.meal_assignments(override_recipe_id);
create index if not exists recipe_ingredients_ingredient_idx on public.recipe_ingredients(ingredient_id);

-- UI Content & Household Frequency Rules
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

