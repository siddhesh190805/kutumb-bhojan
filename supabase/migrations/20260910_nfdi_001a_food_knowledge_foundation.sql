-- Migration: NFDI-001A Canonical Food Knowledge Foundation
-- Adds controlled qualitative nutrition, diversity, preparation, provenance, and identity metadata to ingredients and recipes.

-- 1. Extend public.ingredients with controlled qualitative metadata
alter table public.ingredients add column if not exists display_name_en text;
alter table public.ingredients add column if not exists display_name_mr text;
alter table public.ingredients add column if not exists food_groups jsonb not null default '[]'::jsonb;
alter table public.ingredients add column if not exists protein_contribution text default 'unknown'
  check (protein_contribution is null or protein_contribution in ('main', 'supporting', 'minimal', 'none', 'unknown'));
alter table public.ingredients add column if not exists fibre_contribution text default 'unknown'
  check (fibre_contribution is null or fibre_contribution in ('meaningful', 'supporting', 'minimal', 'none', 'unknown'));
alter table public.ingredients add column if not exists carbohydrate_role text default 'unknown'
  check (carbohydrate_role is null or carbohydrate_role in ('primary', 'supporting', 'minimal', 'none', 'unknown'));
alter table public.ingredients add column if not exists fat_contribution text default 'unknown'
  check (fat_contribution is null or fat_contribution in ('meaningful', 'supporting', 'minimal', 'none', 'unknown'));
alter table public.ingredients add column if not exists fat_quality text default 'unknown'
  check (fat_quality is null or fat_quality in ('predominantly_unsaturated', 'mixed', 'predominantly_saturated', 'not_meaningful', 'unknown'));
alter table public.ingredients add column if not exists legume_identity text
  check (legume_identity is null or length(trim(legume_identity)) > 0);
alter table public.ingredients add column if not exists grain_identity text
  check (grain_identity is null or length(trim(grain_identity)) > 0);
alter table public.ingredients add column if not exists vegetable_identity text
  check (vegetable_identity is null or length(trim(vegetable_identity)) > 0);
alter table public.ingredients add column if not exists vegetable_category text default 'unknown'
  check (vegetable_category is null or vegetable_category in ('leafy_green', 'cruciferous', 'root_tuber', 'fruit_vegetable', 'legume_vegetable', 'other', 'unknown'));
alter table public.ingredients add column if not exists fruit_identity text
  check (fruit_identity is null or length(trim(fruit_identity)) > 0);
alter table public.ingredients add column if not exists seed_identity text
  check (seed_identity is null or length(trim(seed_identity)) > 0);
alter table public.ingredients add column if not exists nut_identity text
  check (nut_identity is null or length(trim(nut_identity)) > 0);
alter table public.ingredients add column if not exists whole_grain_or_millet boolean not null default false;
alter table public.ingredients add column if not exists soaking_requirement text default 'unknown'
  check (soaking_requirement is null or soaking_requirement in ('none', 'short', 'overnight', 'optional', 'unknown'));
alter table public.ingredients add column if not exists advance_preparation text default 'unknown'
  check (advance_preparation is null or advance_preparation in ('none', 'soaking', 'sprouting', 'fermentation', 'prep_ahead', 'unknown'));
alter table public.ingredients add column if not exists provenance text not null default 'authored';
alter table public.ingredients add column if not exists metadata_status text default 'unknown'
  check (metadata_status is null or metadata_status in ('verified', 'draft', 'unknown'));

-- Backfill display names from existing name and marathi_name if display names are null
update public.ingredients
set display_name_en = coalesce(display_name_en, name),
    display_name_mr = coalesce(display_name_mr, marathi_name)
where display_name_en is null or display_name_mr is null;

-- Indexes for ingredients
create index if not exists ingredients_canonical_key_idx on public.ingredients(canonical_key);
create index if not exists ingredients_vegetable_category_idx on public.ingredients(vegetable_category);
create index if not exists ingredients_metadata_status_idx on public.ingredients(metadata_status);

-- 2. Extend public.recipes with controlled preparation and diversity metadata
alter table public.recipes add column if not exists meal_form text
  check (meal_form is null or length(trim(meal_form)) > 0);
alter table public.recipes add column if not exists cooking_method text;
alter table public.recipes add column if not exists preparation_time_minutes integer
  check (preparation_time_minutes is null or preparation_time_minutes >= 0);
alter table public.recipes add column if not exists preparation_burden text default 'unknown'
  check (preparation_burden is null or preparation_burden in ('minimal', 'low', 'moderate', 'high', 'unknown'));
alter table public.recipes add column if not exists soaking_requirement text default 'unknown'
  check (soaking_requirement is null or soaking_requirement in ('none', 'short', 'overnight', 'optional', 'unknown'));
alter table public.recipes add column if not exists fermentation_requirement text default 'unknown'
  check (fermentation_requirement is null or fermentation_requirement in ('none', 'short', 'overnight', 'optional', 'unknown'));
alter table public.recipes add column if not exists batch_prep_suitability text default 'unknown'
  check (batch_prep_suitability is null or batch_prep_suitability in ('high', 'moderate', 'low', 'none', 'unknown'));

-- Indexes for recipes
create index if not exists recipes_meal_form_idx on public.recipes(meal_form);
