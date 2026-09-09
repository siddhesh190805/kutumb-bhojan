from typing import Any
from backend.app.domain.models import DietaryRule, FrequencyRule, Recipe, FamilyMember


DEFAULT_DIETARY_RULES = [
    DietaryRule(
        rule_key="egg-eligibility",
        ingredient_key="egg",
        allowed_member_ids=["tejas", "siddhesh"],
        disallowed_member_ids=["vikas", "namrata"],
        alternate_policy="vegetarian-existing",
        active=True,
    )
]

DEFAULT_FREQUENCY_RULES = [
    FrequencyRule(
        rule_key="paneer-monthly-frequency",
        ingredient_key="paneer",
        max_per_calendar_month=5,
        period="calendar-month",
        rule_type="ingredient_frequency",
        preference_type="household_planning",
        label="Paneer Frequency",
        marathi_label="पनीर वारंवारता",
        description="Household planning preference, not a medical restriction",
        marathi_description="घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही",
        active=True,
    )
]

SUPPORTED_UNITS = {"g", "kg", "ml", "L", "piece", "tsp", "tbsp", "cup"}


def normalize_unit(unit_str: str | None) -> str | None:
    if not unit_str:
        return None
    u = unit_str.strip().lower()
    if u in ("count", "nos", "no", "piece", "pieces"):
        return "piece"
    if u in SUPPORTED_UNITS:
        return u
    return None


def convert_quantity(qty: float, from_unit: str, to_unit: str) -> float | None:
    """Safely convert quantity between compatible units."""
    if from_unit == to_unit:
        return qty
    if from_unit == "kg" and to_unit == "g":
        return qty * 1000.0
    if from_unit == "g" and to_unit == "kg":
        return qty / 1000.0
    if from_unit == "L" and to_unit == "ml":
        return qty * 1000.0
    if from_unit == "ml" and to_unit == "L":
        return qty / 1000.0
    return None


def recipe_contains_ingredient(recipe: Recipe, ingredient_key: str) -> bool:
    """Check if a recipe contains the canonical ingredient."""
    target = ingredient_key.lower().strip()
    if target == "paneer":
        if "paneer" in recipe.name.lower() or "पनीर" in recipe.marathi_name:
            return True
        for ing in recipe.structured_ingredients:
            if ing.ingredient_key.lower() == "paneer":
                return True
        for text in recipe.ingredients:
            if "paneer" in text.lower() or "पनीर" in text:
                return True
        return False

    if target in ("egg", "eggs"):
        if recipe.dietary_flags.contains_egg:
            return True
        if "egg" in recipe.name.lower() or "अंडा" in recipe.marathi_name or "अंडे" in recipe.marathi_name:
            return True
        for ing in recipe.structured_ingredients:
            if ing.ingredient_key.lower() in ("egg", "eggs"):
                return True
        for text in recipe.ingredients:
            if "egg" in text.lower() or "अंड" in text:
                return True
        return False

    # Generic check
    for ing in recipe.structured_ingredients:
        if ing.ingredient_key.lower() == target:
            return True
    for text in recipe.ingredients:
        if target in text.lower():
            return True
    return False


def evaluate_member_eligibility(
    member: FamilyMember,
    recipe: Recipe,
    dietary_rules: list[DietaryRule] | None = None,
) -> tuple[bool, str | None]:
    """
    Check if a member is eligible to eat this recipe.
    Returns (eligible, reason).
    """
    rules = dietary_rules or DEFAULT_DIETARY_RULES
    for rule in rules:
        if not rule.active:
            continue
        if recipe_contains_ingredient(recipe, rule.ingredient_key):
            member_id = member.id.lower()
            member_key = member.member_key.lower()
            allowed = [x.lower() for x in rule.allowed_member_ids]
            disallowed = [x.lower() for x in rule.disallowed_member_ids]

            if member_id in disallowed or member_key in disallowed:
                return False, f"Rule '{rule.rule_key}' disallows member {member.name} for ingredient {rule.ingredient_key}"
            if allowed and (member_id not in allowed and member_key not in allowed):
                return False, f"Rule '{rule.rule_key}' limits ingredient {rule.ingredient_key} to {rule.allowed_member_ids}"

    return True, None
