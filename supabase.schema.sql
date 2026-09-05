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
create policy household_members_self_select on public.household_members for select to authenticated using (user_id = auth.uid() or public.is_household_member(household_id));

drop policy if exists family_members_member_all on public.family_members;
create policy family_members_member_all on public.family_members for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists recipes_member_all on public.recipes;
create policy recipes_member_all on public.recipes for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists meal_entries_member_all on public.meal_entries;
create policy meal_entries_member_all on public.meal_entries for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists shopping_items_member_all on public.shopping_items;
create policy shopping_items_member_all on public.shopping_items for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists prep_tasks_member_all on public.prep_tasks;
create policy prep_tasks_member_all on public.prep_tasks for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

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
