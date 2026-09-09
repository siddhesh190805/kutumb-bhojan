from typing import Any
from backend.app.domain.models import Recipe, RecipeIngredient, MealAssignment, Ingredient
from backend.app.domain.rules import convert_quantity, normalize_unit


class ShoppingDerivedItem:
    def __init__(self, canonical_key: str, quantity: float, unit: str, category: str = "Staples", name: str = ""):
        self.canonical_key = canonical_key
        self.quantity = quantity
        self.unit = unit
        self.category = category
        self.name = name or canonical_key.replace("_", " ").title()

    def to_dict(self) -> dict[str, Any]:
        return {
            "canonicalKey": self.canonical_key,
            "quantity": round(self.quantity, 2),
            "unit": self.unit,
            "category": self.category,
            "name": self.name,
        }


def aggregate_ingredient_lines(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Aggregate lines by ingredient_key and unit.
    Safely converts kg <-> g and L <-> ml. Incompatible units remain in distinct buckets.
    """
    aggregated: list[dict[str, Any]] = []

    for line in lines:
        ing_key = line["ingredientKey"]
        qty = float(line["quantity"])
        unit = normalize_unit(line["unit"]) or line["unit"]

        # Try to merge with existing bucket
        merged = False
        for bucket in aggregated:
            if bucket["ingredientKey"] != ing_key:
                continue

            b_unit = bucket["unit"]
            # Exact unit match
            if b_unit == unit:
                bucket["quantity"] += qty
                merged = True
                break

            # Compatible mass conversion (kg -> g)
            if b_unit == "g" and unit == "kg":
                bucket["quantity"] += (qty * 1000.0)
                merged = True
                break
            elif b_unit == "kg" and unit == "g":
                # Convert bucket to g or incoming to kg
                converted = qty / 1000.0
                bucket["quantity"] += converted
                merged = True
                break

            # Compatible volume conversion (L -> ml)
            if b_unit == "ml" and unit == "L":
                bucket["quantity"] += (qty * 1000.0)
                merged = True
                break
            elif b_unit == "L" and unit == "ml":
                converted = qty / 1000.0
                bucket["quantity"] += converted
                merged = True
                break

        if not merged:
            aggregated.append({
                "ingredientKey": ing_key,
                "quantity": qty,
                "unit": unit,
            })

    return aggregated


def derive_shopping_from_meal_events(
    assignments: list[MealAssignment],
    recipes: list[Recipe],
    catalog: list[Ingredient] | None = None,
    total_household_members: int = 4,
) -> list[dict[str, Any]]:
    """
    Derives shopping ingredients from effective household meal events.
    
    CRITICAL INVARIANT:
    A shared household meal (e.g. 4 members eating 1 recipe with servings=4)
    aggregates ingredients exactly ONCE (not 4 times).
    
    If members eat separate alternate meals in the same slot, each alternate
    contributes proportionally based on member assignments.
    """
    recipes_by_id = {r.id: r for r in recipes}
    for r in recipes:
        if r.recipe_key:
            recipes_by_id[r.recipe_key] = r

    # 1. Group assignments by effective meal event: (meal_entry_id, recipe_id)
    # This identifies distinct meal groups per slot
    events: dict[str, dict[str, list[MealAssignment]]] = {}
    for a in assignments:
        if not a.recipe_id:
            continue
        events.setdefault(a.meal_entry_id, {}).setdefault(a.recipe_id, []).append(a)

    raw_ingredient_lines: list[dict[str, Any]] = []

    for meal_entry_id, recipe_groups in events.items():
        total_assigned_in_slot = sum(len(grp) for grp in recipe_groups.values())
        slot_members_count = max(total_assigned_in_slot, total_household_members)

        for recipe_id, group_assignments in recipe_groups.items():
            recipe = recipes_by_id.get(recipe_id)
            if not recipe:
                continue

            servings = float(recipe.servings or 4.0)
            members_eating_this_recipe = len(group_assignments)

            # Effective event scaling factor:
            # If all members in the household (or slot) are sharing this recipe,
            # scale factor is 1.0 (the recipe batch covers the household meal).
            if len(recipe_groups) == 1 and members_eating_this_recipe == total_assigned_in_slot:
                scale_factor = 1.0
            else:
                # Members are split between multiple distinct recipes in this slot.
                # Scale by the proportion of members eating this recipe relative to recipe servings
                scale_factor = members_eating_this_recipe / servings

            # Aggregate ingredients for this recipe
            if recipe.structured_ingredients:
                for ing in recipe.structured_ingredients:
                    raw_ingredient_lines.append({
                        "ingredientKey": ing.ingredient_key,
                        "quantity": ing.quantity * scale_factor,
                        "unit": ing.unit,
                    })
            else:
                # Parse from legacy lines if structured_ingredients is empty
                for line in recipe.ingredients:
                    import re
                    m = re.match(r"^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$", str(line).strip())
                    if m:
                        qty = float(m.group(1)) * scale_factor
                        unit = m.group(2) or "piece"
                        label = m.group(3)
                        # Extract canonical key or label
                        raw_ingredient_lines.append({
                            "ingredientKey": label.lower().split()[0],
                            "quantity": qty,
                            "unit": unit,
                        })

    # 2. Safely aggregate quantities
    return aggregate_ingredient_lines(raw_ingredient_lines)
