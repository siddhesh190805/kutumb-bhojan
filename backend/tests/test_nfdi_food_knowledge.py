"""
NFDI-001A Canonical Food Knowledge Foundation Tests.

Validates:
- Schema and controlled qualitative taxonomy
- Canonical ingredient identity and alias resolution
- Recipe food-knowledge metadata
- Derivation of recipe food profiles from canonical ingredients
- Name-independence and zero substring/title inference
- Planner integration and representative fixtures
"""

import pytest
from backend.app.domain.models import (
    CanonicalIngredient,
    DerivedRecipeFoodProfile,
    DietaryFlags,
    Ingredient,
    PracticalMetadata,
    Recipe,
    RecipeIngredient,
)
from backend.app.domain.taxonomy import (
    PROTEIN_CONTRIBUTIONS,
    FIBRE_CONTRIBUTIONS,
    CARBOHYDRATE_ROLES,
    FAT_CONTRIBUTIONS,
    FAT_QUALITIES,
    VEGETABLE_CATEGORIES,
    SOAKING_REQUIREMENTS,
    ADVANCE_PREPARATIONS,
    FERMENTATION_REQUIREMENTS,
    PREPARATION_BURDENS,
    BATCH_PREP_SUITABILITIES,
    validate_ingredient_taxonomy,
    validate_recipe_prep_taxonomy,
    validate_taxonomy_value,
)
from backend.app.domain.fixtures import REPRESENTATIVE_INGREDIENTS
from backend.app.infrastructure.repositories.ingredient import IngredientRepository
from backend.app.nutrition.derivation import derive_recipe_food_profile


# ============================================================================
# 1. Controlled Taxonomy Validation Tests (Task 2 & 6)
# ============================================================================

def test_controlled_taxonomy_accepts_valid_classifications():
    """Valid qualitative classifications must be accepted."""
    for ing in REPRESENTATIVE_INGREDIENTS:
        data = {
            "protein_contribution": ing.protein_contribution,
            "fibre_contribution": ing.fibre_contribution,
            "carbohydrate_role": ing.carbohydrate_role,
            "fat_contribution": ing.fat_contribution,
            "fat_quality": ing.fat_quality,
            "vegetable_category": ing.vegetable_category,
            "soaking_requirement": ing.soaking_requirement,
            "advance_preparation": ing.advance_preparation,
            "metadata_status": ing.metadata_status,
        }
        validated = validate_ingredient_taxonomy(data)
        assert validated["protein_contribution"] in PROTEIN_CONTRIBUTIONS
        assert validated["fibre_contribution"] in FIBRE_CONTRIBUTIONS
        assert validated["carbohydrate_role"] in CARBOHYDRATE_ROLES
        assert validated["fat_contribution"] in FAT_CONTRIBUTIONS
        assert validated["fat_quality"] in FAT_QUALITIES


def test_controlled_taxonomy_rejects_invalid_values():
    """Invalid pseudo-clinical or numeric values must raise ValueError."""
    with pytest.raises(ValueError, match="protein_contribution"):
        validate_ingredient_taxonomy({"protein_contribution": "high"})

    with pytest.raises(ValueError, match="protein_contribution"):
        validate_ingredient_taxonomy({"protein_contribution": "30g"})

    with pytest.raises(ValueError, match="fat_quality"):
        validate_ingredient_taxonomy({"fat_quality": "healthy"})

    with pytest.raises(ValueError, match="fibre_contribution"):
        validate_ingredient_taxonomy({"fibre_contribution": "rich"})

    with pytest.raises(ValueError, match="vegetable_category"):
        validate_ingredient_taxonomy({"vegetable_category": "superfood"})


def test_controlled_taxonomy_accepts_unknown_as_valid_state():
    """Unknown is a valid state and must not be coerced into positive or negative."""
    data = {
        "protein_contribution": "unknown",
        "fibre_contribution": "unknown",
        "carbohydrate_role": "unknown",
        "fat_contribution": "unknown",
        "fat_quality": "unknown",
        "vegetable_category": "unknown",
        "soaking_requirement": "unknown",
    }
    validated = validate_ingredient_taxonomy(data)
    assert validated["protein_contribution"] == "unknown"
    assert validated["fat_quality"] == "unknown"
    assert validated["vegetable_category"] == "unknown"


# ============================================================================
# 2. Canonical Ingredient Identity & Alias Resolution (Task 3)
# ============================================================================

def test_alias_resolution_curated_variants():
    """Curated variants such as 'Moong Dal', 'moong dal', 'Moong', and 'मूग डाळ' resolve to moong_dal."""
    repo = IngredientRepository()
    catalog = list(REPRESENTATIVE_INGREDIENTS)

    variants = ["Moong Dal", "moong dal", "Moong", "मूग डाळ", "yellow moong dal"]
    for variant in variants:
        resolved = repo.normalize_alias(variant, catalog=catalog)
        assert resolved == "moong_dal", f"Failed for variant: {variant}"


def test_alias_resolution_unknown_returns_none():
    """Unknown text must return None rather than guessing or substring inference."""
    repo = IngredientRepository()
    catalog = list(REPRESENTATIVE_INGREDIENTS)

    assert repo.normalize_alias("unregistered exotic grain", catalog=catalog) is None
    assert repo.normalize_alias("", catalog=catalog) is None
    assert repo.normalize_alias("   ", catalog=catalog) is None
    # Substring must NOT match: e.g. 'eggplant' must not resolve to 'egg'
    assert repo.normalize_alias("eggplant", catalog=catalog) is None


def test_resolve_canonical_returns_canonical_ingredient():
    """resolve_canonical returns typed CanonicalIngredient instance."""
    repo = IngredientRepository()
    catalog = list(REPRESENTATIVE_INGREDIENTS)

    res = repo.resolve_canonical("पालक", catalog=catalog)
    assert res is not None
    assert isinstance(res, CanonicalIngredient)
    assert res.canonical_key == "spinach"
    assert res.vegetable_category == "leafy_green"


# ============================================================================
# 3. Recipe Food-Knowledge Metadata (Task 4)
# ============================================================================

def test_recipe_metadata_complete():
    """Recipe with complete preparation metadata."""
    r = Recipe(
        id="rec-test-001",
        name="Jowar Bhakri",
        marathi_name="ज्वारी भाकरी",
        meal_form="bhakri_roti",
        cooking_method="Griddle / Tawa",
        preparation_time_minutes=25,
        preparation_burden="low",
        soaking_requirement="none",
        fermentation_requirement="none",
        batch_prep_suitability="moderate",
    )
    assert r.meal_form == "bhakri_roti"
    assert r.preparation_time_minutes == 25
    assert r.preparation_burden == "low"
    assert r.soaking_requirement == "none"
    assert r.fermentation_requirement == "none"
    assert r.batch_prep_suitability == "moderate"


def test_recipe_metadata_incomplete_remains_plannable():
    """Recipe with incomplete metadata defaults cleanly and remains loadable."""
    r = Recipe(
        id="rec-test-002",
        name="Simple Dish",
        marathi_name="साधा पदार्थ",
    )
    assert r.meal_form is None
    assert r.preparation_burden == "unknown"
    assert r.soaking_requirement == "unknown"
    assert r.fermentation_requirement == "unknown"
    assert r.batch_prep_suitability == "unknown"


# ============================================================================
# 4. Derived Recipe Food Profile From Structured Ingredients (Task 5)
# ============================================================================

def test_derived_recipe_food_profile_positive():
    """Positive derivation from structured ingredients (moong dal + rice + carrot)."""
    catalog = list(REPRESENTATIVE_INGREDIENTS)
    recipe = Recipe(
        id="rec-khichdi-001",
        name="Moong Dal Khichdi",
        marathi_name="मूग डाळ खिचडी",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="moong_dal", quantity=100, unit="g"),
            RecipeIngredient(ingredient_key="rice", quantity=100, unit="g"),
            RecipeIngredient(ingredient_key="carrot", quantity=50, unit="g"),
        ],
    )

    profile = derive_recipe_food_profile(recipe, catalog)
    assert isinstance(profile, DerivedRecipeFoodProfile)
    assert "moong" in profile.legume_identities
    assert "rice" in profile.grain_identities
    assert "carrot" in profile.vegetable_identities
    assert "legume_pulse" in profile.food_groups
    assert "grain" in profile.food_groups
    assert "vegetable" in profile.food_groups
    assert "main" in profile.protein_contributions
    assert "meaningful" in profile.fibre_contributions
    assert profile.provenance == "derived"


def test_derived_recipe_food_profile_name_independence():
    """Two differently named recipes with identical structured ingredients produce identical food profiles."""
    catalog = list(REPRESENTATIVE_INGREDIENTS)
    ingredients = [
        RecipeIngredient(ingredient_key="moong_dal", quantity=100, unit="g"),
        RecipeIngredient(ingredient_key="spinach", quantity=50, unit="g"),
    ]

    recipe_a = Recipe(
        id="rec-a",
        name="Traditional Moong Palak",
        marathi_name="पारंपरिक मूग पालक",
        structured_ingredients=ingredients,
    )
    recipe_b = Recipe(
        id="rec-b",
        name="Green Power Stew",
        marathi_name="हिरवा भाजी सूप",
        structured_ingredients=ingredients,
    )

    profile_a = derive_recipe_food_profile(recipe_a, catalog)
    profile_b = derive_recipe_food_profile(recipe_b, catalog)

    assert profile_a == profile_b
    assert profile_a.legume_identities == frozenset({"moong"})
    assert profile_a.vegetable_identities == frozenset({"spinach"})


def test_derived_recipe_food_profile_misleading_name_not_inferred():
    """A recipe named 'Moong Surprise' but containing ONLY rice and egg must NOT receive moong identity."""
    catalog = list(REPRESENTATIVE_INGREDIENTS)
    recipe = Recipe(
        id="rec-misleading",
        name="Special Moong Surprise",
        marathi_name="विशेष मूग सरप्राइज",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="rice", quantity=150, unit="g"),
            RecipeIngredient(ingredient_key="egg", quantity=2, unit="piece"),
        ],
    )

    profile = derive_recipe_food_profile(recipe, catalog)
    # MUST NOT have moong!
    assert "moong" not in profile.legume_identities
    assert len(profile.legume_identities) == 0
    assert "rice" in profile.grain_identities
    assert "egg" in profile.food_groups


# ============================================================================
# 5. Planner Distinguishability & Data Contract (Tasks 7 & 8)
# ============================================================================

def test_recipes_with_distinct_identities_are_distinguishable():
    """Recipes with different structured legume/grain/vegetable identities are distinguishable."""
    catalog = list(REPRESENTATIVE_INGREDIENTS)

    r_jowar = Recipe(
        id="r1",
        name="Dish 1",
        marathi_name="पदार्थ १",
        structured_ingredients=[RecipeIngredient(ingredient_key="jowar", quantity=100, unit="g")],
    )
    r_rice = Recipe(
        id="r2",
        name="Dish 2",
        marathi_name="पदार्थ २",
        structured_ingredients=[RecipeIngredient(ingredient_key="rice", quantity=100, unit="g")],
    )

    p1 = derive_recipe_food_profile(r_jowar, catalog)
    p2 = derive_recipe_food_profile(r_rice, catalog)

    assert p1.has_whole_grain_or_millet is True
    assert p2.has_whole_grain_or_millet is False
    assert p1.grain_identities == frozenset({"jowar"})
    assert p2.grain_identities == frozenset({"rice"})


def test_egg_remains_machine_readable_for_eligibility():
    """Egg is machine-readable from canonical identity so eligibility is preserved."""
    catalog = list(REPRESENTATIVE_INGREDIENTS)
    egg_recipe = Recipe(
        id="r-egg",
        name="Breakfast Bhurji",
        marathi_name="सकाळची भुर्जी",
        structured_ingredients=[RecipeIngredient(ingredient_key="egg", quantity=2, unit="piece")],
    )
    profile = derive_recipe_food_profile(egg_recipe, catalog)
    assert "egg" in profile.food_groups
    assert "main" in profile.protein_contributions
