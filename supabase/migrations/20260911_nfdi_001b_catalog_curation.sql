-- Migration: NFDI-001B Canonical Food Catalog Curation
-- Deterministic population of 40 canonical ingredients with ICMR-NIN 2024 / WHO grounded qualitative metadata.
-- Idempotent, non-destructive, preserve-all update.

-- Canonical ingredient: apple
update public.ingredients set
  display_name_en = 'Apple',
  display_name_mr = 'सफरचंद',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'apple',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'apple';

-- Canonical ingredient: banana
update public.ingredients set
  display_name_en = 'Banana',
  display_name_mr = 'केळे',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'primary',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'banana',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'banana';

-- Canonical ingredient: besan
update public.ingredients set
  display_name_en = 'Besan',
  display_name_mr = 'बेसन',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'chana',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'besan';

-- Canonical ingredient: bhindi
update public.ingredients set
  display_name_en = 'Okra',
  display_name_mr = 'भेंडी',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'bhindi',
  vegetable_category = 'fruit_vegetable',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'bhindi';

-- Canonical ingredient: bottle_gourd
update public.ingredients set
  display_name_en = 'Bottle gourd',
  display_name_mr = 'दुधी भोपळा',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'bottle_gourd',
  vegetable_category = 'fruit_vegetable',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'bottle_gourd';

-- Canonical ingredient: brinjal
update public.ingredients set
  display_name_en = 'Brinjal',
  display_name_mr = 'वांगी',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'brinjal',
  vegetable_category = 'fruit_vegetable',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'brinjal';

-- Canonical ingredient: cabbage
update public.ingredients set
  display_name_en = 'Cabbage',
  display_name_mr = 'कोबी',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'cabbage',
  vegetable_category = 'cruciferous',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'cabbage';

-- Canonical ingredient: carrot
update public.ingredients set
  display_name_en = 'Carrot',
  display_name_mr = 'गाजर',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'carrot',
  vegetable_category = 'root_tuber',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'carrot';

-- Canonical ingredient: cauliflower
update public.ingredients set
  display_name_en = 'Cauliflower',
  display_name_mr = 'फुलकोबी',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'cauliflower',
  vegetable_category = 'cruciferous',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'cauliflower';

-- Canonical ingredient: chickpeas
update public.ingredients set
  display_name_en = 'Chickpeas',
  display_name_mr = 'हरभरा',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'chana',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'overnight',
  advance_preparation = 'soaking',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'chickpeas';

-- Canonical ingredient: coriander
update public.ingredients set
  display_name_en = 'Coriander',
  display_name_mr = 'कोथिंबीर',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'minimal',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'coriander',
  vegetable_category = 'leafy_green',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'coriander';

-- Canonical ingredient: cucumber
update public.ingredients set
  display_name_en = 'Cucumber',
  display_name_mr = 'काकडी',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'cucumber',
  vegetable_category = 'fruit_vegetable',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'cucumber';

-- Canonical ingredient: cumin
update public.ingredients set
  display_name_en = 'Cumin',
  display_name_mr = 'जिरे',
  food_groups = '["spices"]'::jsonb,
  protein_contribution = 'none',
  fibre_contribution = 'none',
  carbohydrate_role = 'none',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'cumin';

-- Canonical ingredient: curd
update public.ingredients set
  display_name_en = 'Plain curd',
  display_name_mr = 'साधे दही',
  food_groups = '["dairy"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'none',
  carbohydrate_role = 'minimal',
  fat_contribution = 'supporting',
  fat_quality = 'predominantly_saturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'curd';

-- Canonical ingredient: egg
update public.ingredients set
  display_name_en = 'Egg',
  display_name_mr = 'अंडे',
  food_groups = '["egg"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'none',
  carbohydrate_role = 'none',
  fat_contribution = 'supporting',
  fat_quality = 'mixed',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'egg';

-- Canonical ingredient: flaxseed
update public.ingredients set
  display_name_en = 'Flaxseed',
  display_name_mr = 'जवस',
  food_groups = '["nut_seed"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'minimal',
  fat_contribution = 'meaningful',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = 'flaxseed',
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'flaxseed';

-- Canonical ingredient: guava
update public.ingredients set
  display_name_en = 'Guava',
  display_name_mr = 'पेरू',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'guava',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'guava';

-- Canonical ingredient: jowar_flour
update public.ingredients set
  display_name_en = 'Jowar flour',
  display_name_mr = 'ज्वारीचे पीठ',
  food_groups = '["grain", "millet"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'primary',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = null,
  grain_identity = 'jowar',
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = true,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'jowar_flour';

-- Canonical ingredient: lemon
update public.ingredients set
  display_name_en = 'Lemon',
  display_name_mr = 'लिंबू',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'none',
  fibre_contribution = 'minimal',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'lemon',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'lemon';

-- Canonical ingredient: lobia
update public.ingredients set
  display_name_en = 'Lobia',
  display_name_mr = 'चवळी',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'lobia',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'short',
  advance_preparation = 'soaking',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'lobia';

-- Canonical ingredient: matki
update public.ingredients set
  display_name_en = 'Matki',
  display_name_mr = 'मटकी',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'matki',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'overnight',
  advance_preparation = 'soaking',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'matki';

-- Canonical ingredient: milk
update public.ingredients set
  display_name_en = 'Milk',
  display_name_mr = 'दूध',
  food_groups = '["dairy"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'none',
  carbohydrate_role = 'minimal',
  fat_contribution = 'supporting',
  fat_quality = 'predominantly_saturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'milk';

-- Canonical ingredient: moong_dal
update public.ingredients set
  display_name_en = 'Moong dal',
  display_name_mr = 'मूग डाळ',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'moong',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'short',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'moong_dal';

-- Canonical ingredient: mosambi
update public.ingredients set
  display_name_en = 'Sweet lime',
  display_name_mr = 'मोसंबी',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'mosambi',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'mosambi';

-- Canonical ingredient: oil
update public.ingredients set
  display_name_en = 'Cooking oil',
  display_name_mr = 'खाद्यतेल',
  food_groups = '["fats_oils"]'::jsonb,
  protein_contribution = 'none',
  fibre_contribution = 'none',
  carbohydrate_role = 'none',
  fat_contribution = 'meaningful',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'oil';

-- Canonical ingredient: onion
update public.ingredients set
  display_name_en = 'Onion',
  display_name_mr = 'कांदा',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'onion',
  vegetable_category = 'root_tuber',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'onion';

-- Canonical ingredient: paneer
update public.ingredients set
  display_name_en = 'Paneer',
  display_name_mr = 'पनीर',
  food_groups = '["dairy"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'none',
  carbohydrate_role = 'minimal',
  fat_contribution = 'meaningful',
  fat_quality = 'predominantly_saturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'paneer';

-- Canonical ingredient: papaya
update public.ingredients set
  display_name_en = 'Papaya',
  display_name_mr = 'पपई',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'papaya',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'papaya';

-- Canonical ingredient: peanuts
update public.ingredients set
  display_name_en = 'Peanuts',
  display_name_mr = 'शेंगदाणे',
  food_groups = '["nut_seed", "legume_pulse"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'meaningful',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = 'peanut',
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'peanuts';

-- Canonical ingredient: poha
update public.ingredients set
  display_name_en = 'Poha',
  display_name_mr = 'पोहे',
  food_groups = '["grain"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'minimal',
  carbohydrate_role = 'primary',
  fat_contribution = 'minimal',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = 'poha',
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'short',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'poha';

-- Canonical ingredient: pomegranate
update public.ingredients set
  display_name_en = 'Pomegranate',
  display_name_mr = 'डाळिंब',
  food_groups = '["fruit"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'supporting',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = 'pomegranate',
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'pomegranate';

-- Canonical ingredient: pumpkin_seeds
update public.ingredients set
  display_name_en = 'Pumpkin seeds',
  display_name_mr = 'भोपळ्याच्या बिया',
  food_groups = '["nut_seed"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'meaningful',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = 'pumpkin_seed',
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'pumpkin_seeds';

-- Canonical ingredient: rajma
update public.ingredients set
  display_name_en = 'Rajma',
  display_name_mr = 'राजमा',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'rajma',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'overnight',
  advance_preparation = 'soaking',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'rajma';

-- Canonical ingredient: rice
update public.ingredients set
  display_name_en = 'Rice',
  display_name_mr = 'तांदूळ',
  food_groups = '["grain"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'minimal',
  carbohydrate_role = 'primary',
  fat_contribution = 'minimal',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = 'rice',
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'rice';

-- Canonical ingredient: salt
update public.ingredients set
  display_name_en = 'Salt',
  display_name_mr = 'मीठ',
  food_groups = '["seasoning"]'::jsonb,
  protein_contribution = 'none',
  fibre_contribution = 'none',
  carbohydrate_role = 'none',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'salt';

-- Canonical ingredient: soy_granules
update public.ingredients set
  display_name_en = 'Soy granules',
  display_name_mr = 'सोया ग्रॅन्युल्स',
  food_groups = '["legume_pulse"]'::jsonb,
  protein_contribution = 'main',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'supporting',
  fat_contribution = 'minimal',
  fat_quality = 'predominantly_unsaturated',
  legume_identity = 'soy',
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'short',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'soy_granules';

-- Canonical ingredient: spinach
update public.ingredients set
  display_name_en = 'Spinach',
  display_name_mr = 'पालक',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'spinach',
  vegetable_category = 'leafy_green',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'spinach';

-- Canonical ingredient: tomato
update public.ingredients set
  display_name_en = 'Tomato',
  display_name_mr = 'टोमॅटो',
  food_groups = '["vegetable"]'::jsonb,
  protein_contribution = 'minimal',
  fibre_contribution = 'supporting',
  carbohydrate_role = 'minimal',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = 'tomato',
  vegetable_category = 'fruit_vegetable',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'tomato';

-- Canonical ingredient: turmeric
update public.ingredients set
  display_name_en = 'Turmeric',
  display_name_mr = 'हळद',
  food_groups = '["spices"]'::jsonb,
  protein_contribution = 'none',
  fibre_contribution = 'none',
  carbohydrate_role = 'none',
  fat_contribution = 'none',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = null,
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = false,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'turmeric';

-- Canonical ingredient: whole_wheat_flour
update public.ingredients set
  display_name_en = 'Whole-wheat flour',
  display_name_mr = 'गव्हाचे पीठ',
  food_groups = '["grain"]'::jsonb,
  protein_contribution = 'supporting',
  fibre_contribution = 'meaningful',
  carbohydrate_role = 'primary',
  fat_contribution = 'minimal',
  fat_quality = 'not_meaningful',
  legume_identity = null,
  grain_identity = 'wheat',
  vegetable_identity = null,
  vegetable_category = 'unknown',
  fruit_identity = null,
  seed_identity = null,
  nut_identity = null,
  whole_grain_or_millet = true,
  soaking_requirement = 'none',
  advance_preparation = 'none',
  provenance = 'icmr_nin_2024',
  metadata_status = 'verified',
  updated_at = now()
where canonical_key = 'whole_wheat_flour';
