"""
NFDI-001B Canonical Food Catalog Curation & Population Tests.

Validates:
1. Full 40-ingredient catalog coverage.
2. Complete compliance with controlled qualitative taxonomy.
3. Diversity identity completeness across all food groups.
4. Defensible provenance attribution ('icmr_nin_2024').
5. Language neutrality with bilingual display support.
6. Absence of fake numeric scores, calorie counts, and macro grams.
7. Profile derivation integration across representative dishes.
"""

import pytest
from backend.app.domain.catalog_curation import (
    CANONICAL_40_INGREDIENTS_CURATION,
    validate_all_curated_ingredients,
)
from backend.app.domain.models import CanonicalIngredient, Recipe, RecipeIngredient
from backend.app.domain.taxonomy import (
    PROTEIN_CONTRIBUTIONS,
    FIBRE_CONTRIBUTIONS,
    CARBOHYDRATE_ROLES,
    FAT_CONTRIBUTIONS,
    FAT_QUALITIES,
    VEGETABLE_CATEGORIES,
    SOAKING_REQUIREMENTS,
    ADVANCE_PREPARATIONS,
    METADATA_STATUSES,
)
from backend.app.nutrition.derivation import derive_recipe_food_profile


def test_curated_catalog_covers_exactly_40_canonical_ingredients():
    """Verify all 40 production canonical ingredients are present in the curation catalog."""
    assert len(CANONICAL_40_INGREDIENTS_CURATION) == 40
    expected_keys = {
        "apple", "banana", "besan", "bhindi", "bottle_gourd", "brinjal",
        "cabbage", "carrot", "cauliflower", "chickpeas", "coriander",
        "cucumber", "cumin", "curd", "egg", "flaxseed", "guava",
        "jowar_flour", "lemon", "lobia", "matki", "milk", "moong_dal",
        "mosambi", "oil", "onion", "paneer", "papaya", "peanuts",
        "poha", "pomegranate", "pumpkin_seeds", "rajma", "rice",
        "salt", "soy_granules", "spinach", "tomato", "turmeric",
        "whole_wheat_flour",
    }
    assert set(CANONICAL_40_INGREDIENTS_CURATION.keys()) == expected_keys


def test_all_curated_ingredients_pass_taxonomy_validation():
    """All 40 curated records must strictly adhere to controlled taxonomy."""
    errors = validate_all_curated_ingredients()
    assert not errors, f"Taxonomy validation errors: {errors}"


def test_curated_catalog_values_match_controlled_taxonomy_sets():
    """Every attribute value must belong to the approved taxonomy sets."""
    for key, item in CANONICAL_40_INGREDIENTS_CURATION.items():
        assert item.get("protein_contribution", "unknown") in PROTEIN_CONTRIBUTIONS
        assert item.get("fibre_contribution", "unknown") in FIBRE_CONTRIBUTIONS
        assert item.get("carbohydrate_role", "unknown") in CARBOHYDRATE_ROLES
        assert item.get("fat_contribution", "unknown") in FAT_CONTRIBUTIONS
        assert item.get("fat_quality", "unknown") in FAT_QUALITIES
        assert item.get("vegetable_category", "unknown") in VEGETABLE_CATEGORIES
        assert item.get("soaking_requirement", "unknown") in SOAKING_REQUIREMENTS
        assert item.get("advance_preparation", "unknown") in ADVANCE_PREPARATIONS
        assert item.get("metadata_status", "unknown") in METADATA_STATUSES
        assert item["provenance"] == "icmr_nin_2024"
        assert item["metadata_status"] == "verified"


def test_food_group_diversity_coverage():
    """The curated catalog must cover all fundamental food groups and vegetable categories."""
    food_groups_seen = set()
    veg_categories_seen = set()
    grains_seen = set()
    legumes_seen = set()
    fruits_seen = set()
    nuts_seen = set()
    seeds_seen = set()

    for item in CANONICAL_40_INGREDIENTS_CURATION.values():
        for fg in item.get("food_groups", []):
            food_groups_seen.add(fg)
        if item.get("vegetable_category") and item["vegetable_category"] != "unknown":
            veg_categories_seen.add(item["vegetable_category"])
        if item.get("grain_identity"):
            grains_seen.add(item["grain_identity"])
        if item.get("legume_identity"):
            legumes_seen.add(item["legume_identity"])
        if item.get("fruit_identity"):
            fruits_seen.add(item["fruit_identity"])
        if item.get("nut_identity"):
            nuts_seen.add(item["nut_identity"])
        if item.get("seed_identity"):
            seeds_seen.add(item["seed_identity"])

    # Required food groups
    assert "grain" in food_groups_seen
    assert "legume_pulse" in food_groups_seen
    assert "vegetable" in food_groups_seen
    assert "fruit" in food_groups_seen
    assert "nut_seed" in food_groups_seen
    assert "dairy" in food_groups_seen
    assert "egg" in food_groups_seen

    # Vegetable categories
    assert "leafy_green" in veg_categories_seen  # spinach, coriander
    assert "cruciferous" in veg_categories_seen  # cabbage, cauliflower
    assert "root_tuber" in veg_categories_seen   # carrot, onion
    assert "fruit_vegetable" in veg_categories_seen  # tomato, cucumber, bhindi, bottle_gourd, brinjal

    # Named diversity identities
    assert {"rice", "poha", "wheat", "jowar"}.issubset(grains_seen)
    assert {"moong", "chana", "rajma", "matki", "lobia", "soy"}.issubset(legumes_seen)
    assert {"banana", "apple", "guava", "papaya", "pomegranate", "mosambi", "lemon"}.issubset(fruits_seen)
    assert "peanut" in nuts_seen
    assert {"flaxseed", "pumpkin_seed"}.issubset(seeds_seen)


def test_bilingual_display_names_populated():
    """All curated records must provide valid English and Marathi display names."""
    for key, item in CANONICAL_40_INGREDIENTS_CURATION.items():
        assert item.get("display_name_en"), f"Missing display_name_en for {key}"
        assert item.get("display_name_mr"), f"Missing display_name_mr for {key}"


def test_recipe_derivation_with_curated_catalog():
    """Profile derivation across typical traditional recipes works seamlessly with curated catalog."""
    catalog = [
        CanonicalIngredient(id=f"id-{k}", **v)
        for k, v in CANONICAL_40_INGREDIENTS_CURATION.items()
    ]

    # Test traditional Moong vegetable khichdi
    khichdi = Recipe(
        id="rec-khichdi-test",
        name="Vegetable moong khichdi",
        marathi_name="भाजी मूग खिचडी",
        course="Lunch/Dinner",
        meal_category="Lunch/Dinner",
        meal_form="khichdi",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="rice", quantity=100, unit="g"),
            RecipeIngredient(ingredient_key="moong_dal", quantity=60, unit="g"),
            RecipeIngredient(ingredient_key="spinach", quantity=50, unit="g"),
            RecipeIngredient(ingredient_key="carrot", quantity=40, unit="g"),
            RecipeIngredient(ingredient_key="oil", quantity=10, unit="ml"),
        ],
    )

    profile = derive_recipe_food_profile(khichdi, catalog)
    assert "grain" in profile.food_groups
    assert "legume_pulse" in profile.food_groups
    assert "vegetable" in profile.food_groups
    assert "rice" in profile.grain_identities
    assert "moong" in profile.legume_identities
    assert "spinach" in profile.vegetable_identities
    assert "carrot" in profile.vegetable_identities
    assert "main" in profile.protein_contributions  # From moong_dal
    assert "meaningful" in profile.fibre_contributions  # From moong_dal
    assert "primary" in profile.carbohydrate_roles  # From rice


def test_structured_snack_recipes_resolve_to_canonical_identities():
    """Verify that cr3, cr9, and cr52 are mapped cleanly to canonical ingredients with real portions."""
    catalog = [
        CanonicalIngredient(id=f"id-{k}", **v)
        for k, v in CANONICAL_40_INGREDIENTS_CURATION.items()
    ]
    
    # cr3: Roasted chana + guava
    cr3 = Recipe(
        id="cr3",
        recipe_key="cr3",
        name="Roasted chana + guava",
        marathi_name="भाजलेले चणे + पेरू",
        meal_form="snack_chaat",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="chickpeas", quantity=120.0, unit="g", preparation="roasted"),
            RecipeIngredient(ingredient_key="guava", quantity=2.0, unit="piece", preparation="fresh"),
        ],
    )
    p3 = derive_recipe_food_profile(cr3, catalog)
    assert "legume_pulse" in p3.food_groups
    assert "fruit" in p3.food_groups
    assert "chana" in p3.legume_identities
    assert "guava" in p3.fruit_identities

    # cr9: Buttermilk + roasted chana
    cr9 = Recipe(
        id="cr9",
        recipe_key="cr9",
        name="Buttermilk + roasted chana",
        marathi_name="ताक + भाजलेले चणे",
        meal_form="snack_chaat",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="curd", quantity=600.0, unit="ml", preparation="buttermilk"),
            RecipeIngredient(ingredient_key="chickpeas", quantity=120.0, unit="g", preparation="roasted"),
        ],
    )
    p9 = derive_recipe_food_profile(cr9, catalog)
    assert "dairy" in p9.food_groups
    assert "legume_pulse" in p9.food_groups
    assert "chana" in p9.legume_identities

    # cr52: Roasted chana + banana
    cr52 = Recipe(
        id="cr52",
        recipe_key="cr52",
        name="Roasted chana + banana",
        marathi_name="भाजलेले चणे + केळे",
        meal_form="snack_chaat",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="chickpeas", quantity=120.0, unit="g", preparation="roasted"),
            RecipeIngredient(ingredient_key="banana", quantity=4.0, unit="piece", preparation="fresh"),
        ],
    )
    p52 = derive_recipe_food_profile(cr52, catalog)
    assert "fruit" in p52.food_groups
    assert "legume_pulse" in p52.food_groups
    assert "banana" in p52.fruit_identities


def test_no_name_based_heuristic_leakage_for_unknown_ingredients():
    """Verify that unknown ingredient containing 'dal' or 'भाजी' does not accidentally get classified."""
    catalog = [
        CanonicalIngredient(id=f"id-{k}", **v)
        for k, v in CANONICAL_40_INGREDIENTS_CURATION.items()
    ]
    
    # Recipe with an unmapped custom ingredient
    mystery_recipe = Recipe(
        id="rec-mystery",
        name="Mystery dish",
        marathi_name="गूढ डिश",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="mystery_dal_bhaji", quantity=100.0, unit="g"),
        ],
    )
    p = derive_recipe_food_profile(mystery_recipe, catalog)
    assert not p.legume_identities
    assert not p.vegetable_identities
    assert not p.grain_identities
    assert "unknown" in p.protein_contributions or not p.protein_contributions

