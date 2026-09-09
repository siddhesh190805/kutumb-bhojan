-- Migration: Add recipe_id and decision_metadata to meal_entries for planner persistence
alter table public.meal_entries add column if not exists recipe_id uuid references public.recipes(id) on delete set null;
alter table public.meal_entries add column if not exists decision_metadata jsonb not null default '{}'::jsonb;
create index if not exists meal_entries_recipe_idx on public.meal_entries(recipe_id);
create index if not exists meal_entries_decision_metadata_gin on public.meal_entries using gin(decision_metadata);
