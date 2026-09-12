import re
from typing import Any
from backend.app.domain.models import (
    Recipe,
    RecipeIngredient,
    DietaryFlags,
    PracticalMetadata,
    NutritionMetadata,
)
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
