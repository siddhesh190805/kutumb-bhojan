import pytest
from backend.app.domain.models import (
    Recipe,
    FamilyMember,
    RecipeIngredient,
    DietaryFlags,
    PracticalMetadata,
    NutritionMetadata,
    PlanningRequest,
)
from backend.app.domain.rules import (
    normalize_unit,
    convert_quantity,
    recipe_contains_ingredient,
    evaluate_member_eligibility,
    DEFAULT_DIETARY_RULES,
)


def test_unit_normalization():
    assert normalize_unit("kg") == "kg"
    assert normalize_unit("count") == "piece"
    assert normalize_unit("handful") is None


def test_safe_conversions():
    assert convert_quantity(1.0, "kg", "g") == 1000.0
    assert convert_quantity(1.0, "L", "ml") == 1000.0
    assert convert_quantity(1.0, "kg", "ml") is None


def test_member_egg_eligibility():
    egg_recipe = Recipe(
        id="egg-bhurji",
        name="Egg Bhurji + Roti",
        marathi_name="अंडा भुर्जी + पोळी",
        course="Breakfast",
        dietary_flags=DietaryFlags(contains_egg=True, vegetarian=False),
        structured_ingredients=[
            RecipeIngredient(ingredient_key="egg", quantity=8, unit="piece")
        ],
    )

    siddhesh = FamilyMember(id="siddhesh", member_key="siddhesh", name="Siddhesh", marathi_name="सिद्धेश", age=21)
    tejas = FamilyMember(id="tejas", member_key="tejas", name="Tejas", marathi_name="तेजस", age=14)
    vikas = FamilyMember(id="vikas", member_key="vikas", name="Vikas", marathi_name="विकास", age=50)
    namrata = FamilyMember(id="namrata", member_key="namrata", name="Namrata", marathi_name="नम्रता", age=40)

    assert evaluate_member_eligibility(siddhesh, egg_recipe, DEFAULT_DIETARY_RULES)[0] is True
    assert evaluate_member_eligibility(tejas, egg_recipe, DEFAULT_DIETARY_RULES)[0] is True
    assert evaluate_member_eligibility(vikas, egg_recipe, DEFAULT_DIETARY_RULES)[0] is False
    assert evaluate_member_eligibility(namrata, egg_recipe, DEFAULT_DIETARY_RULES)[0] is False


def test_paneer_detection():
    paneer_recipe = Recipe(
        id="palak-paneer",
        name="Palak Paneer + Roti",
        marathi_name="पालक पनीर + पोळी",
        ingredients=["400 g paneer", "500 g spinach"],
    )
    veg_recipe = Recipe(
        id="khichdi",
        name="Moong Khichdi",
        marathi_name="मूग डाळ खिचडी",
        ingredients=["180 g rice", "120 g moong dal"],
    )
    assert recipe_contains_ingredient(paneer_recipe, "paneer") is True
    assert recipe_contains_ingredient(veg_recipe, "paneer") is False
