import re
from typing import Any
from backend.app.domain.models import Recipe, RecipeIngredient, DietaryFlags, PracticalMetadata, NutritionMetadata
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client
from backend.app.nutrition.derivation import derive_recipe_food_profile


def parse_time_minutes(time_text: str | None) -> int:
    if not time_text:
        return 30
    m = re.search(r"(\d+)", time_text)
    return int(m.group(1)) if m else 30


def enrich_recipe_metadata(recipe: Recipe) -> Recipe:
    """
    Enrich recipe with structured dietary flags, practical metadata,
    and nutrition signals without clinical claims.
    Prefers structured food_profile and explicit recipe attributes over name/text heuristics.
    """
    combined_text = (
        f"{recipe.name} {recipe.marathi_name} {' '.join(recipe.ingredients)} {recipe.course} {recipe.cooking_method}"
    ).lower()

    fp = recipe.food_profile

    # 1. Dietary Flags
    if fp is not None and (fp.food_groups or fp.protein_contributions):
        has_egg = "egg" in fp.food_groups or "egg" in fp.protein_contributions
        has_paneer = "dairy" in fp.food_groups and any("paneer" in ing.ingredient_key.lower() for ing in recipe.structured_ingredients)
        has_legume = bool(fp.legume_identities) or "legume_pulse" in fp.food_groups
        has_veg = bool(fp.vegetable_identities) or "vegetable" in fp.food_groups
        has_fruit = bool(fp.fruit_identities) or "fruit" in fp.food_groups
        has_grain = bool(fp.grain_identities) or fp.has_whole_grain_or_millet
        has_dairy = "dairy" in fp.food_groups
    else:
        # Backward-compatible fallback for unmapped legacy recipes
        has_egg = bool(re.search(r"\b(egg|eggs|अंड|अंडे|अंडी|भुर्जी)\b", combined_text)) and "paneer" not in recipe.name.lower()
        if "egg" in recipe.name.lower() or "अंडा" in recipe.marathi_name:
            has_egg = True

        has_paneer = bool(re.search(r"\b(paneer|पनीर)\b", combined_text))
        has_legume = bool(re.search(r"\b(dal|chole|rajma|chana|moong|matki|usal|besan|chickpea|sprouts|डाळ|कडधान्य|हरभरा|मूग|मटकी|छोले)\b", combined_text))
        has_veg = bool(re.search(r"\b(vegetable|vegetables|spinach|palak|cabbage|carrot|cucumber|tomato|bhindi|dudhi|cauliflower|भाजी|भाज्या|पालक|कोबी|गाजर|काकडी|भेंडी|दुधी)\b", combined_text))
        has_fruit = bool(re.search(r"\b(apple|banana|guava|papaya|pomegranate|mosambi|सफरचंद|केळे|पेरू|पपई|डाळिंब|मोसंबी)\b", combined_text))
        has_grain = bool(re.search(r"\b(roti|rice|jowar|bhakri|poha|ragi|oats|wheat|पोळी|भात|ज्वारी|भाकरी|पोहे|नाचणी|ओट्स)\b", combined_text))
        has_dairy = has_paneer or "curd" in combined_text or "दूध" in combined_text or "दही" in combined_text

    recipe.dietary_flags = DietaryFlags(
        contains_egg=has_egg,
        vegetarian=not has_egg,
        vegetables=has_veg,
        legumes=has_legume,
        whole_grains=has_grain,
        fruit=has_fruit,
        dairy=has_dairy,
    )

    # 2. Meal Form: prioritize explicit recipe.meal_form if authored
    if recipe.meal_form and recipe.meal_form.strip() and recipe.meal_form != "unknown":
        form = recipe.meal_form.strip().lower()
    else:
        name_l = recipe.name.lower()
        if "chilla" in name_l or "चिल्ला" in recipe.marathi_name:
            form = "chilla"
        elif "khichdi" in name_l or "खिचडी" in recipe.marathi_name:
            form = "khichdi"
        elif "poha" in name_l or "पोहे" in recipe.marathi_name:
            form = "poha"
        elif "dosa" in name_l or "uttapam" in name_l or "डोसा" in recipe.marathi_name or "उत्तपम" in recipe.marathi_name or "adai" in name_l:
            form = "dosa_uttapam"
        elif "thalipeeth" in name_l or "dashmi" in name_l or "थालीपीठ" in recipe.marathi_name or "दशमी" in recipe.marathi_name:
            form = "thalipeeth_dashmi"
        elif "bhurji" in name_l or "भुर्जी" in recipe.marathi_name:
            form = "bhurji"
        elif "rice" in name_l or "rajma rice" in name_l or "भात" in recipe.marathi_name:
            form = "rice_dish"
        elif "misal" in name_l or "usal" in name_l or "मिसळ" in recipe.marathi_name or "उसळ" in recipe.marathi_name:
            form = "misal_usal"
        elif "snack" in recipe.course.lower() or "chaat" in name_l or "चाट" in recipe.marathi_name or "peanut" in name_l:
            form = "snack_chaat"
        else:
            form = "curry_sabji"

    recipe.meal_form = form

    # 3. Primary Grain: prioritize structured grain identities
    if fp is not None and fp.grain_identities:
        if "jowar" in fp.grain_identities or "ragi" in fp.grain_identities or "bajra" in fp.grain_identities or fp.has_whole_grain_or_millet:
            grain = "millet"
        elif "poha" in fp.grain_identities:
            grain = "poha"
        elif "oats" in fp.grain_identities:
            grain = "oats"
        elif "rice" in fp.grain_identities:
            grain = "rice"
        elif "wheat" in fp.grain_identities:
            grain = "wheat"
        else:
            grain = next(iter(fp.grain_identities))
    else:
        if "jowar" in combined_text or "bhakri" in combined_text or "ज्वारी" in combined_text or "भाकरी" in combined_text:
            grain = "millet"
        elif "ragi" in combined_text or "नाचणी" in combined_text:
            grain = "millet"
        elif "poha" in combined_text or "पोहे" in combined_text:
            grain = "poha"
        elif "oat" in combined_text or "ओट्स" in combined_text:
            grain = "oats"
        elif "rice" in combined_text or "भात" in combined_text or "khichdi" in combined_text:
            grain = "rice"
        elif "roti" in combined_text or "wheat" in combined_text or "पोळी" in combined_text or "गहू" in combined_text:
            grain = "wheat"
        else:
            grain = "none"

    # 4. Primary Protein Source
    if has_egg:
        protein = "egg"
    elif has_paneer:
        protein = "dairy_paneer"
    elif fp is not None and ("soy" in fp.food_groups or "soy" in fp.legume_identities):
        protein = "soy"
    elif fp is not None and bool(fp.legume_identities):
        protein = "legume"
    elif "soya" in combined_text or "soy" in combined_text or "टोफू" in combined_text or "tofu" in combined_text:
        protein = "soy"
    elif has_legume:
        protein = "legume"
    elif "curd" in combined_text or "milk" in combined_text or "दही" in combined_text or "दूध" in combined_text:
        protein = "dairy_curd"
    elif "peanut" in combined_text or "almond" in combined_text or "शेंगदाणे" in combined_text:
        protein = "nuts_seeds"
    else:
        protein = "legume"

    # 5. Heaviness / Density
    name_l = recipe.name.lower()
    if form in ("khichdi", "poha") or "curd" in name_l and len(recipe.ingredients) <= 4:
        density = "light"
    elif has_paneer or "chole" in name_l or "rajma" in name_l or "biryani" in name_l:
        density = "heavy" if (has_paneer and "roti" in combined_text) else "substantial"
    elif form in ("chilla", "dosa_uttapam", "snack_chaat"):
        density = "light" if "curd" in name_l or "roasted" in name_l else "moderate"
    else:
        density = "moderate"

    # 6. Practical Flags & Preparation Metadata
    time_min = recipe.preparation_time_minutes or parse_time_minutes(recipe.time_text)
    recipe.preparation_time_minutes = time_min

    if recipe.soaking_requirement and recipe.soaking_requirement != "unknown":
        soaking = recipe.soaking_requirement in ("short", "overnight", "optional")
    else:
        soaking = bool(re.search(r"\b(soaked|overnight|chole|rajma|pesarattu|भिजाव|रात्रभर)\b", combined_text))
        recipe.soaking_requirement = "overnight" if soaking else "none"

    if recipe.fermentation_requirement and recipe.fermentation_requirement != "unknown":
        fermentation = recipe.fermentation_requirement in ("short", "overnight", "optional")
    else:
        fermentation = bool(re.search(r"\b(ferment|fermentation|handvo|dosa|idli|आंबव)\b", combined_text))
        recipe.fermentation_requirement = "overnight" if fermentation else "none"

    if recipe.preparation_burden and recipe.preparation_burden != "unknown":
        burden = recipe.preparation_burden
    else:
        burden = "low" if time_min <= 20 else "moderate" if time_min <= 35 else "high"
        recipe.preparation_burden = burden

    recipe.practical_metadata = PracticalMetadata(
        meal_density=density,
        meal_form=form,
        primary_grain=grain,
        primary_protein_source=protein,
        cooking_burden=burden,
        time_minutes=time_min,
        soaking_required=soaking,
        fermentation_required=fermentation,
        batch_prep_compatible=(
            recipe.batch_prep_suitability in ("high", "moderate")
            if recipe.batch_prep_suitability and recipe.batch_prep_suitability != "unknown"
            else form in ("chilla", "khichdi", "curry_sabji")
        ),
    )

    # 7. Nutrition Metadata
    recipe.nutrition_metadata = NutritionMetadata(
        protein_source=protein,
        fibre_contribution="high" if (has_legume and has_veg) else "moderate",
        whole_grain=grain in ("millet", "wheat", "oats", "poha"),
        vegetables=has_veg,
        fruits=has_fruit,
        legumes=has_legume,
        egg=has_egg,
        dairy=has_dairy,
    )

    return recipe


class RecipeRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client
        self._cache: dict[str, list[Recipe]] = {}

    async def aget_recipes(
        self,
        household_id: str,
        auth_token: str | None = None,
        refresh: bool = False,
        http_client=None,
    ) -> list[Recipe]:
        if not refresh and household_id in self._cache:
            return self._cache[household_id]
        # Parallelize three independent HTTP reads (reuse same http_client, bounded by caller's semaphore)
        import asyncio

        async def _fetch_recipes():
            return await self.client.aget(
                "recipes",
                {"household_id": f"eq.{household_id}"},
                auth_token=auth_token,
                http_client=http_client,
            )

        async def _fetch_ri():
            try:
                return await self.client.aget(
                    "recipe_ingredients",
                    {"household_id": f"eq.{household_id}", "order": "sort_order"},
                    auth_token=auth_token,
                    http_client=http_client,
                )
            except Exception:
                return []

        async def _fetch_ings():
            try:
                from backend.app.infrastructure.repositories.ingredient import IngredientRepository
                ing_repo = IngredientRepository(self.client)
                ings = await ing_repo.aget_all(auth_token=auth_token, http_client=http_client)
                return ings
            except Exception:
                return []

        rows, ri_rows, canonical_ings = await asyncio.gather(
            _fetch_recipes(),
            _fetch_ri(),
            _fetch_ings(),
        )
        if not rows:
            return []
        # Build ing_map after all three complete (CPU dependency)
        try:
            ing_map = {str(i.id): i.canonical_key for i in canonical_ings if i and getattr(i, "id", None)}
        except Exception:
            ing_map = {}
            canonical_ings = canonical_ings if isinstance(canonical_ings, list) else []
        ri_by_recipe: dict[str, list[RecipeIngredient]] = {}
        for r in ri_rows:
            rec_id = str(r.get("recipe_id"))
            ing_id = str(r.get("ingredient_id") or "")
            canonical_key = str(r.get("ingredient_key") or ing_map.get(ing_id) or "")
            ri_by_recipe.setdefault(rec_id, []).append(
                RecipeIngredient(
                    ingredient_id=ing_id,
                    ingredient_key=canonical_key,
                    quantity=float(r.get("quantity", 0)),
                    unit=str(r.get("unit", "g")),
                    display_text=r.get("display_text"),
                    preparation=r.get("preparation"),
                    sort_order=int(r.get("sort_order", 0)),
                )
            )
        recipes = []
        for r in rows:
            rid = str(r["id"])
            ingredients_raw = r.get("ingredients") or []
            if isinstance(ingredients_raw, str):
                ingredients_raw = [ingredients_raw]
            method_raw = r.get("method") or []
            if isinstance(method_raw, str):
                method_raw = [method_raw]
            prep_time = r.get("preparation_time_minutes")
            if prep_time is not None:
                try:
                    prep_time = int(prep_time)
                except (ValueError, TypeError):
                    prep_time = None
            struct_ings = ri_by_recipe.get(rid, [])
            if not struct_ings:
                rkey = r.get("recipe_key")
                if rkey == "cr3":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=1),
                        RecipeIngredient(ingredient_key="guava", quantity=2, unit="piece", display_text="2 medium guavas", sort_order=2),
                    ]
                elif rkey == "cr9":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="curd", quantity=600, unit="ml", display_text="600 ml plain buttermilk", preparation="buttermilk", sort_order=1),
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=2),
                    ]
                elif rkey == "cr52":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=1),
                        RecipeIngredient(ingredient_key="banana", quantity=4, unit="piece", display_text="4 small bananas", sort_order=2),
                    ]
            recipe = Recipe(
                id=rid,
                recipe_key=r.get("recipe_key"),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                course=r.get("course") or "Lunch/Dinner",
                meal_category=r.get("meal_category") or r.get("course") or "Lunch/Dinner",
                meal_role=r.get("meal_role") or "main",
                servings=float(r.get("servings") or 4),
                time_text=r.get("time_text") or "30 min",
                cooking_method=r.get("cooking_method") or "Stovetop",
                description=r.get("description"),
                marathi_description=r.get("marathi_description"),
                meal_form=r.get("meal_form"),
                preparation_time_minutes=prep_time,
                preparation_burden=r.get("preparation_burden") or "unknown",
                soaking_requirement=r.get("soaking_requirement") or "unknown",
                fermentation_requirement=r.get("fermentation_requirement") or "unknown",
                batch_prep_suitability=r.get("batch_prep_suitability") or "unknown",
                ingredients=ingredients_raw,
                structured_ingredients=struct_ings,
                method=method_raw,
                note=r.get("note"),
            )
            if canonical_ings and recipe.structured_ingredients:
                recipe.food_profile = derive_recipe_food_profile(recipe, canonical_ings)
            enriched = enrich_recipe_metadata(recipe)
            recipes.append(enriched)
        # Deterministic normalization: sort by id
        recipes.sort(key=lambda r: str(r.id))
        self._cache[household_id] = recipes
        return recipes

    def get_recipes(
        self,
        household_id: str,
        auth_token: str | None = None,
        refresh: bool = False,
    ) -> list[Recipe]:
        if not refresh and household_id in self._cache:
            return self._cache[household_id]

        rows = self.client.get(
            "recipes",
            {"household_id": f"eq.{household_id}"},
            auth_token=auth_token,
        )
        if not rows:
            return []

        # Also get recipe_ingredients if present and map ingredient_id -> canonical_key
        try:
            ri_rows = self.client.get(
                "recipe_ingredients",
                {"household_id": f"eq.{household_id}", "order": "sort_order"},
                auth_token=auth_token,
            )
        except Exception:
            ri_rows = []

        # Fetch canonical ingredients to resolve ingredient_id -> canonical_key and derive food profiles
        ing_map: dict[str, str] = {}
        canonical_ings: list[Any] = []
        try:
            from backend.app.infrastructure.repositories.ingredient import IngredientRepository
            ing_repo = IngredientRepository(self.client)
            canonical_ings = ing_repo.get_all(auth_token=auth_token)
            ing_map = {str(i.id): i.canonical_key for i in canonical_ings if i.id}
        except Exception:
            ing_map = {}
            canonical_ings = []

        ri_by_recipe: dict[str, list[RecipeIngredient]] = {}
        for r in ri_rows:
            rec_id = str(r.get("recipe_id"))
            ing_id = str(r.get("ingredient_id") or "")
            canonical_key = str(r.get("ingredient_key") or ing_map.get(ing_id) or "")
            ri_by_recipe.setdefault(rec_id, []).append(
                RecipeIngredient(
                    ingredient_id=ing_id,
                    ingredient_key=canonical_key,
                    quantity=float(r.get("quantity", 0)),
                    unit=str(r.get("unit", "g")),
                    display_text=r.get("display_text"),
                    preparation=r.get("preparation"),
                    sort_order=int(r.get("sort_order", 0)),
                )
            )

        recipes = []
        for r in rows:
            rid = str(r["id"])
            ingredients_raw = r.get("ingredients") or []
            if isinstance(ingredients_raw, str):
                ingredients_raw = [ingredients_raw]

            method_raw = r.get("method") or []
            if isinstance(method_raw, str):
                method_raw = [method_raw]

            prep_time = r.get("preparation_time_minutes")
            if prep_time is not None:
                try:
                    prep_time = int(prep_time)
                except (ValueError, TypeError):
                    prep_time = None

            struct_ings = ri_by_recipe.get(rid, [])
            if not struct_ings:
                rkey = r.get("recipe_key")
                if rkey == "cr3":  # Roasted chana + guava
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="guava",
                            quantity=2,
                            unit="piece",
                            display_text="2 medium guavas",
                            sort_order=2,
                        ),
                    ]
                elif rkey == "cr9":  # Buttermilk + roasted chana
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="curd",
                            quantity=600,
                            unit="ml",
                            display_text="600 ml plain buttermilk",
                            preparation="buttermilk",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=2,
                        ),
                    ]
                elif rkey == "cr52":  # Roasted chana + banana
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="banana",
                            quantity=4,
                            unit="piece",
                            display_text="4 small bananas",
                            sort_order=2,
                        ),
                    ]

            recipe = Recipe(
                id=rid,
                recipe_key=r.get("recipe_key"),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                course=r.get("course") or "Lunch/Dinner",
                meal_category=r.get("meal_category") or r.get("course") or "Lunch/Dinner",
                meal_role=r.get("meal_role") or "main",
                servings=float(r.get("servings") or 4),
                time_text=r.get("time_text") or "30 min",
                cooking_method=r.get("cooking_method") or "Stovetop",
                description=r.get("description"),
                marathi_description=r.get("marathi_description"),
                meal_form=r.get("meal_form"),
                preparation_time_minutes=prep_time,
                preparation_burden=r.get("preparation_burden") or "unknown",
                soaking_requirement=r.get("soaking_requirement") or "unknown",
                fermentation_requirement=r.get("fermentation_requirement") or "unknown",
                batch_prep_suitability=r.get("batch_prep_suitability") or "unknown",
                ingredients=ingredients_raw,
                structured_ingredients=struct_ings,
                method=method_raw,
                note=r.get("note"),
            )

            # Derive food profile if structured ingredients and catalog are available
            if canonical_ings and recipe.structured_ingredients:
                recipe.food_profile = derive_recipe_food_profile(recipe, canonical_ings)

            enriched = enrich_recipe_metadata(recipe)
            recipes.append(enriched)

        self._cache[household_id] = recipes
        return recipes

    def get_recipe_by_id(
        self,
        household_id: str,
        recipe_id: str,
        auth_token: str | None = None,
    ) -> Recipe | None:
        all_recipes = self.get_recipes(household_id, auth_token=auth_token)
        for r in all_recipes:
            if r.id == recipe_id or r.recipe_key == recipe_id or r.name.lower() == recipe_id.lower():
                return r
        return None
