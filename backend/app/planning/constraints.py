from typing import Any
from backend.app.domain.models import Recipe, FamilyMember, DietaryRule, FrequencyRule
from backend.app.domain.rules import recipe_contains_ingredient, evaluate_member_eligibility


def is_slot_compatible(recipe: Recipe, slot: str) -> bool:
    """Check if the recipe course/category matches the target meal slot."""
    course = (recipe.meal_category or recipe.course or "").strip()
    s = slot.strip().lower()

    if s == "breakfast":
        return any(c in course.lower() for c in ("breakfast", "नाश्ता"))
    elif s in ("lunch", "dinner"):
        return any(c in course.lower() for c in ("lunch", "dinner", "दुपार", "रात्र"))
    elif s == "snack":
        return any(c in course.lower() for c in ("snack", "breakfast", "अल्पोपहार"))
    return True


def evaluate_hard_constraints(
    recipe: Recipe,
    slot: str,
    target_date: str,
    paneer_count_in_month: int,
    max_paneer_per_month: int = 5,
    unavailable_ingredients: list[str] | None = None,
    recipes_catalog: list[Recipe] | None = None,
    members: list[FamilyMember] | None = None,
    dietary_rules: list[DietaryRule] | None = None,
) -> tuple[bool, list[str]]:
    """
    Evaluate hard constraints for a recipe candidate on target date and slot.
    Returns (is_valid, violation_reasons).
    """
    violations: list[str] = []

    # 1. Slot compatibility
    if not is_slot_compatible(recipe, slot):
        violations.append(f"Recipe '{recipe.name}' (course: {recipe.course}) is not compatible with slot '{slot}'")

    # 2. Unavailable ingredients
    if unavailable_ingredients:
        for ing in unavailable_ingredients:
            if recipe_contains_ingredient(recipe, ing):
                violations.append(f"Recipe '{recipe.name}' requires unavailable ingredient '{ing}'")
                break

    # 3. Monthly Paneer Limit
    if recipe_contains_ingredient(recipe, "paneer"):
        if paneer_count_in_month >= max_paneer_per_month:
            violations.append(
                f"Monthly paneer limit reached ({paneer_count_in_month}/{max_paneer_per_month} in month {target_date[:7]})"
            )

    # Note: NO consecutive-day paneer hard constraint exists!

    # 4. Member eligibility & alternate availability
    if recipe.dietary_flags.contains_egg and members and recipes_catalog:
        veg_members = [
            m for m in members
            if not evaluate_member_eligibility(m, recipe, dietary_rules)[0]
        ]
        if veg_members:
            # Check if there is at least one suitable vegetarian recipe for this slot
            has_veg_alt = any(
                r.id != recipe.id
                and not r.dietary_flags.contains_egg
                and is_slot_compatible(r, slot)
                for r in recipes_catalog
            )
            if not has_veg_alt:
                violations.append(
                    f"Egg recipe '{recipe.name}' has no available vegetarian alternate for members: {[m.name for m in veg_members]}"
                )

    return len(violations) == 0, violations
