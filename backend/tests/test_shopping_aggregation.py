import pytest
from backend.app.domain.models import Recipe, RecipeIngredient, MealAssignment
from backend.app.shopping.service import derive_shopping_from_meal_events, aggregate_ingredient_lines


def test_shared_paneer_meal_aggregates_once():
    """
    CRITICAL REGRESSION TEST:
    1 shared household meal of 400g paneer eaten by 4 members
    must result in 400g paneer in the shopping list (NOT 1600g).
    """
    paneer_recipe = Recipe(
        id="palak-paneer",
        name="Palak Paneer + Roti",
        marathi_name="पालक पनीर + पोळी",
        servings=4.0,
        structured_ingredients=[
            RecipeIngredient(ingredient_key="paneer", quantity=400.0, unit="g"),
            RecipeIngredient(ingredient_key="spinach", quantity=500.0, unit="g"),
            RecipeIngredient(ingredient_key="wheat_roti", quantity=8.0, unit="piece"),
        ],
    )

    # 4 members assigned to the same meal slot
    assignments = [
        MealAssignment(meal_entry_id="2026-09-07-Dinner", member_id="siddhesh", recipe_id="palak-paneer"),
        MealAssignment(meal_entry_id="2026-09-07-Dinner", member_id="tejas", recipe_id="palak-paneer"),
        MealAssignment(meal_entry_id="2026-09-07-Dinner", member_id="vikas", recipe_id="palak-paneer"),
        MealAssignment(meal_entry_id="2026-09-07-Dinner", member_id="namrata", recipe_id="palak-paneer"),
    ]

    shopping = derive_shopping_from_meal_events(
        assignments=assignments,
        recipes=[paneer_recipe],
        total_household_members=4,
    )

    paneer_item = next(x for x in shopping if x["ingredientKey"] == "paneer")
    assert paneer_item["quantity"] == 400.0, f"Expected 400g paneer, but got {paneer_item['quantity']}g!"

    spinach_item = next(x for x in shopping if x["ingredientKey"] == "spinach")
    assert spinach_item["quantity"] == 500.0, f"Expected 500g spinach, but got {spinach_item['quantity']}g!"


def test_separate_alternate_meals_contribute_independently():
    """
    Two genuinely different effective meals:
    2 members eat chilla (200g moong dal base for 4 servings -> 100g for 2 members)
    2 members eat egg bhurji (8 eggs base for 4 servings -> 4 eggs for 2 members)
    """
    chilla = Recipe(
        id="chilla",
        name="Moong Dal Chilla",
        marathi_name="मूग डाळ चिल्ला",
        servings=4.0,
        structured_ingredients=[
            RecipeIngredient(ingredient_key="moong_dal", quantity=200.0, unit="g"),
            RecipeIngredient(ingredient_key="oil", quantity=20.0, unit="ml"),
        ],
    )
    bhurji = Recipe(
        id="egg-bhurji",
        name="Egg Bhurji",
        marathi_name="अंडा भुर्जी",
        servings=4.0,
        structured_ingredients=[
            RecipeIngredient(ingredient_key="egg", quantity=8.0, unit="piece"),
            RecipeIngredient(ingredient_key="oil", quantity=20.0, unit="ml"),
        ],
    )

    assignments = [
        MealAssignment(meal_entry_id="2026-09-07-Breakfast", member_id="siddhesh", recipe_id="egg-bhurji"),
        MealAssignment(meal_entry_id="2026-09-07-Breakfast", member_id="tejas", recipe_id="egg-bhurji"),
        MealAssignment(meal_entry_id="2026-09-07-Breakfast", member_id="vikas", recipe_id="chilla"),
        MealAssignment(meal_entry_id="2026-09-07-Breakfast", member_id="namrata", recipe_id="chilla"),
    ]

    shopping = derive_shopping_from_meal_events(
        assignments=assignments,
        recipes=[chilla, bhurji],
        total_household_members=4,
    )

    moong = next(x for x in shopping if x["ingredientKey"] == "moong_dal")
    assert moong["quantity"] == 100.0, f"Expected 100g moong dal for 2 members, got {moong['quantity']}g"

    egg = next(x for x in shopping if x["ingredientKey"] == "egg")
    assert egg["quantity"] == 4.0, f"Expected 4 eggs for 2 members, got {egg['quantity']} piece"

    oil = next(x for x in shopping if x["ingredientKey"] == "oil")
    assert oil["quantity"] == 20.0, f"Expected 20ml oil total, got {oil['quantity']}ml"


def test_incompatible_units_remain_separate():
    lines = [
        {"ingredientKey": "onion", "quantity": 500.0, "unit": "g"},
        {"ingredientKey": "onion", "quantity": 2.0, "unit": "piece"},
    ]
    aggregated = aggregate_ingredient_lines(lines)
    assert len(aggregated) == 2
    assert any(x["quantity"] == 500.0 and x["unit"] == "g" for x in aggregated)
    assert any(x["quantity"] == 2.0 and x["unit"] == "piece" for x in aggregated)
