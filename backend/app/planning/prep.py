"""
NFDI-001C Preparation-Ahead Intelligence & Household Task Derivation.

Generates proactive, time-aligned household kitchen tasks from structured recipe
preparation metadata (overnight soaking, fermentation, batch cooking).
"""

from datetime import datetime, timedelta
from typing import Any
from pydantic import BaseModel, Field
from backend.app.domain.models import MealPlanSlot, Recipe


class PrepTaskItem(BaseModel):
    id: str
    date: str  # Date when the task must be performed
    target_meal_date: str
    target_slot: str
    recipe_id: str
    task: str
    mr: str
    area: str = "evening_prep"  # evening_prep, morning_prep, batch_prep
    done: bool = False
    notes: str | None = None


SLOT_MARATHI: dict[str, str] = {
    "breakfast": "नाश्ता",
    "lunch": "दुपारचे जेवण",
    "dinner": "रात्रीचे जेवण",
    "snack": "अल्पोपहार",
}


def _slot_marathi(slot: str) -> str:
    return SLOT_MARATHI.get(slot.strip().lower(), "नाश्ता")


def _safe_recipe_display(recipe: Recipe) -> tuple[str, str]:
    """Return (en_name, mr_name) with safe fallbacks, never None."""
    en = (recipe.name or "").strip() or "Recipe"
    mr = (recipe.marathi_name or "").strip() or en
    return en, mr


def generate_household_prep_tasks(
    plan_slots: list[MealPlanSlot],
) -> list[PrepTaskItem]:
    """
    Derive actionable prep tasks for the household from planned meals.
    Schedules overnight soaking and fermentation for the preceding evening (D-1).
    Batch tasks are generated only when the same recipe or legume appears again in the weekly plan.
    """
    prep_tasks: list[PrepTaskItem] = []
    seen_task_keys: set[str] = set()

    # Precompute future usage for batch-prep gating (actual plan cross-reference)
    future_recipe_ids = {slot.recipe.id for slot in plan_slots if slot.recipe}
    future_legumes: set[str] = set()
    for slot in plan_slots:
        if slot.recipe and slot.recipe.food_profile:
            future_legumes.update(slot.recipe.food_profile.legume_identities)

    for slot in plan_slots:
        recipe = slot.recipe
        if not recipe:
            continue

        meal_date_str = slot.date
        meal_dt = datetime.strptime(meal_date_str, "%Y-%m-%d")
        prev_date_str = (meal_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        en_name, mr_name = _safe_recipe_display(recipe)
        slot_mr = _slot_marathi(slot.slot)

        # 1. Overnight Soaking Requirement
        if recipe.soaking_requirement == "overnight" or recipe.practical_metadata.soaking_required:
            task_key = f"soak-{prev_date_str}-{slot.slot.lower()}-{recipe.id}"
            if task_key not in seen_task_keys:
                seen_task_keys.add(task_key)

                # Determine legume / grain name if available
                ing_name_en = "dal / pulses"
                ing_name_mr = "डाळ / कडधान्य"
                if recipe.food_profile and recipe.food_profile.legume_identities:
                    legume = next(iter(recipe.food_profile.legume_identities)).title()
                    ing_name_en = legume
                    ing_name_mr = "कडधान्य"
                elif "chole" in recipe.name.lower() or "chana" in recipe.name.lower():
                    ing_name_en = "chickpeas (chana)"
                    ing_name_mr = "हरभरा / छोले"
                elif "rajma" in recipe.name.lower():
                    ing_name_en = "rajma"
                    ing_name_mr = "राजमा"

                prep_tasks.append(
                    PrepTaskItem(
                        id=task_key,
                        date=prev_date_str,
                        target_meal_date=meal_date_str,
                        target_slot=slot.slot,
                        recipe_id=recipe.id,
                        task=f"Soak {ing_name_en} overnight for tomorrow's {slot.slot.lower()} ({en_name})",
                        mr=f"उद्याच्या {slot_mr}साठी ({mr_name}) {ing_name_mr} आज संध्याकाळी भिजत घाला",
                        area="evening_prep",
                        done=False,
                    )
                )

        # 2. Overnight Fermentation Requirement
        if recipe.fermentation_requirement == "overnight" or recipe.practical_metadata.fermentation_required:
            task_key = f"ferment-{prev_date_str}-{slot.slot.lower()}-{recipe.id}"
            if task_key not in seen_task_keys:
                seen_task_keys.add(task_key)
                prep_tasks.append(
                    PrepTaskItem(
                        id=task_key,
                        date=prev_date_str,
                        target_meal_date=meal_date_str,
                        target_slot=slot.slot,
                        recipe_id=recipe.id,
                        task=f"Set batter for overnight fermentation ({en_name})",
                        mr=f"उद्याच्या {slot_mr}साठी ({mr_name}) पीठ आज संध्याकाळी आंबवायला ठेवा",
                        area="evening_prep",
                        done=False,
                    )
                )

        # 3. Weekend Batch Preparation Opportunities — only if future use exists
        is_weekend = meal_dt.weekday() in (5, 6)
        if is_weekend and recipe.batch_prep_suitability in ("high", "moderate"):
            # Gate: same recipe appears again later OR same legume family recurs
            has_future_use = False
            # Check if recipe appears on a later weekday
            later_occurrences = sum(1 for s in plan_slots if s.recipe and s.recipe.id == recipe.id and s.date > meal_date_str)
            if later_occurrences > 0:
                has_future_use = True
            elif recipe.food_profile and recipe.food_profile.legume_identities:
                # Check if same legume appears on later weekday
                for s in plan_slots:
                    if s.date > meal_date_str and s.recipe and s.recipe.food_profile:
                        if s.recipe.food_profile.legume_identities.intersection(recipe.food_profile.legume_identities):
                            has_future_use = True
                            break
            if has_future_use:
                task_key = f"batch-{meal_date_str}-{slot.slot.lower()}-{recipe.id}"
                if task_key not in seen_task_keys:
                    seen_task_keys.add(task_key)
                    prep_tasks.append(
                        PrepTaskItem(
                            id=task_key,
                            date=meal_date_str,
                            target_meal_date=meal_date_str,
                            target_slot=slot.slot,
                            recipe_id=recipe.id,
                            task=f"Batch prep opportunity: cook extra portion of {en_name} for upcoming weekday ease",
                            mr=f"बॅच कुकिंग: आठवड्याच्या सोयीसाठी {mr_name} जास्त प्रमाणात तयार करा",
                            area="batch_prep",
                            done=False,
                        )
                    )

    # Sort deterministically by date asc, area asc, recipe_id asc
    prep_tasks.sort(key=lambda t: (t.date, t.area, t.id))
    return prep_tasks
