-- Migration: NFDI-001B-B Canonical Recipe Metadata & Structured Ingredients Curation
-- Idempotent population of recipe preparation metadata, meal forms, and structured snacks.

-- Recipe: Besan vegetable chilla + curd (cr38)
update public.recipes set
  meal_form = 'chilla',
  preparation_time_minutes = 15,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr38';

-- Recipe: Pesarattu + Peanut Coriander Chutney (r2)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r2';

-- Recipe: Ragi dosa + sambar (cr29)
update public.recipes set
  meal_form = 'dosa_uttapam',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'overnight',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr29';

-- Recipe: Vegetable poha + peanuts + curd (cr33)
update public.recipes set
  meal_form = 'poha',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr33';

-- Recipe: Paneer Bhurji + Roti (r5)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r5';

-- Recipe: Mixed-Dal Adai (r6)
update public.recipes set
  meal_form = 'dosa_uttapam',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r6';

-- Recipe: Protein Thalipeeth (r7)
update public.recipes set
  meal_form = 'thalipeeth_dashmi',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r7';

-- Recipe: Matki Usal (r8)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r8';

-- Recipe: Chole + Roti (r9)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r9';

-- Recipe: Rajma Masala + Rice (r10)
update public.recipes set
  meal_form = 'rice_dish',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r10';

-- Recipe: Lobia Curry + Roti (r11)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r11';

-- Recipe: Palak Paneer (r12)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r12';

-- Recipe: Vegetable Moong Khichdi + Curd (r13)
update public.recipes set
  meal_form = 'khichdi',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r13';

-- Recipe: Jowar Bhakri + Matki Usal + Dudhi (r14)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r14';

-- Recipe: Matki Misal (r15)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r15';

-- Recipe: Paneer Vegetable Tikka (r16)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'r16';

-- Recipe: Sprouted moong chaat (cr31)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 15,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr31';

-- Recipe: Paneer Chaat (r18)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 10,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r18';

-- Recipe: Curd Papaya Flax Bowl (r19)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r19';

-- Recipe: Roasted chana + banana (cr52)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 3,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr52';

-- Recipe: Buttermilk + roasted chana (cr9)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr9';

-- Recipe: Egg bhurji + roti (cr11)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr11';

-- Recipe: Moong vegetable chilla + curd (cr0)
update public.recipes set
  meal_form = 'chilla',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr0';

-- Recipe: Moong-paneer chilla (cr1)
update public.recipes set
  meal_form = 'chilla',
  preparation_time_minutes = 25,
  preparation_burden = 'moderate',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr1';

-- Recipe: Lobia curry + roti + bhindi + guava (cr2)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr2';

-- Recipe: Roasted chana + guava (cr3)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr3';

-- Recipe: Paneer vegetable curry + roti + cucumber (cr4)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr4';

-- Recipe: Chana usal + jowar bhakri + cabbage-carrot koshimbir (cr5)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr5';

-- Recipe: Tofu bhurji + roti + tomato-cucumber (cr6)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 25,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr6';

-- Recipe: Vegetable uttapam + sambar (cr7)
update public.recipes set
  meal_form = 'dosa_uttapam',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'overnight',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr7';

-- Recipe: Rajma rice + cucumber-onion (cr8)
update public.recipes set
  meal_form = 'rice_dish',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr8';

-- Recipe: Jowar bhakri + matki usal + cauliflower (cr10)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr10';

-- Recipe: Mixed bean curry + roti + dudhi (cr12)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr12';

-- Recipe: Paneer chaat + pomegranate (cr13)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 10,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr13';

-- Recipe: Vegetable moong khichdi + curd + carrot-cucumber (cr14)
update public.recipes set
  meal_form = 'khichdi',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr14';

-- Recipe: Besan-paneer chilla (cr15)
update public.recipes set
  meal_form = 'chilla',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr15';

-- Recipe: Chole + roti + cabbage-peas + apple (cr16)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr16';

-- Recipe: Milk + banana + peanut powder (cr17)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr17';

-- Recipe: Palak paneer + roti + cucumber (cr18)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr18';

-- Recipe: Handvo + curd (cr19)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'overnight',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr19';

-- Recipe: Bharli vangi + jowar bhakri + curd + cucumber (cr20)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr20';

-- Recipe: Chana chaat + mosambi (cr21)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 10,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr21';

-- Recipe: Soy-paneer keema + roti + cabbage (cr22)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr22';

-- Recipe: Methi dashmi + curd + banana (cr23)
update public.recipes set
  meal_form = 'thalipeeth_dashmi',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr23';

-- Recipe: Matki misal + pav + cucumber-onion (cr24)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr24';

-- Recipe: Curd + papaya + flax (cr25)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr25';

-- Recipe: Paneer vegetable tikka + roti + tomato-cucumber (cr26)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr26';

-- Recipe: Peanuts + banana (cr27)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 3,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr27';

-- Recipe: Paneer bhurji + roti + spinach (cr28)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 25,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr28';

-- Recipe: Chana usal + roti + cauliflower-carrot (cr30)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr30';

-- Recipe: Egg bhurji + roti + dudhi (cr32)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr32';

-- Recipe: Rajma rice + cucumber + papaya (cr34)
update public.recipes set
  meal_form = 'rice_dish',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr34';

-- Recipe: Pesarattu + peanut chutney (cr35)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr35';

-- Recipe: Mixed bean curry + roti + cabbage-carrot (cr36)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr36';

-- Recipe: Tofu vegetable curry + roti + cucumber (cr37)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr37';

-- Recipe: Chole + roti + bhindi + apple (cr39)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr39';

-- Recipe: Mixed-dal adai + tomato chutney (cr40)
update public.recipes set
  meal_form = 'dosa_uttapam',
  preparation_time_minutes = 35,
  preparation_burden = 'moderate',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr40';

-- Recipe: Bharli vangi + jowar bhakri + curd (cr41)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr41';

-- Recipe: Protein thalipeeth + curd (cr42)
update public.recipes set
  meal_form = 'thalipeeth_dashmi',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr42';

-- Recipe: Sprouts poha + curd (cr43)
update public.recipes set
  meal_form = 'poha',
  preparation_time_minutes = 25,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr43';

-- Recipe: Chana usal + jowar bhakri + dudhi (cr44)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr44';

-- Recipe: Curd + banana + pumpkin seeds (cr45)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 5,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr45';

-- Recipe: Tofu bhurji + roti + cucumber-tomato (cr46)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 25,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr46';

-- Recipe: Rajma rice + cabbage-carrot (cr47)
update public.recipes set
  meal_form = 'rice_dish',
  preparation_time_minutes = 45,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr47';

-- Recipe: Sprouted moong chaat + cucumber (cr48)
update public.recipes set
  meal_form = 'snack_chaat',
  preparation_time_minutes = 15,
  preparation_burden = 'low',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr48';

-- Recipe: Egg bhurji + roti + bhindi (cr49)
update public.recipes set
  meal_form = 'bhurji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'cr49';

-- Recipe: Mixed bean curry + roti + dudhi + apple (cr50)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr50';

-- Recipe: Chole + roti + cauliflower-carrot + papaya (cr51)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr51';

-- Recipe: Soy-paneer keema + roti + cabbage salad (cr53)
update public.recipes set
  meal_form = 'curry_sabji',
  preparation_time_minutes = 30,
  preparation_burden = 'moderate',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr53';

-- Recipe: Matki usal + jowar bhakri + cabbage-carrot koshimbir (cr54)
update public.recipes set
  meal_form = 'misal_usal',
  preparation_time_minutes = 40,
  preparation_burden = 'high',
  soaking_requirement = 'none',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'moderate',
  updated_at = now()
where recipe_key = 'cr54';

-- Recipe: Moong Vegetable Chilla (r0)
update public.recipes set
  meal_form = 'chilla',
  preparation_time_minutes = 20,
  preparation_burden = 'low',
  soaking_requirement = 'overnight',
  fermentation_requirement = 'none',
  batch_prep_suitability = 'low',
  updated_at = now()
where recipe_key = 'r0';
