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


def generate_household_prep_tasks(
    plan_slots: list[MealPlanSlot],
) -> list[PrepTaskItem]:
    """
    Derive actionable prep tasks for the household from planned meals.
    Schedules overnight soaking and fermentation for the preceding evening (D-1).
    """
    prep_tasks: list[PrepTaskItem] = []
    seen_task_keys: set[str] = set()

    for slot in plan_slots:
        recipe = slot.recipe
        if not recipe:
            continue

        meal_date_str = slot.date
        meal_dt = datetime.strptime(meal_date_str, "%Y-%m-%d")
        prev_date_str = (meal_dt - timedelta(days=1)).strftime("%Y-%m-%d")

        # 1. Overnight Soaking Requirement
        if recipe.soaking_requirement == "overnight" or recipe.practical_metadata.soaking_required:
            task_key = f"soak-{prev_date_str}-{recipe.id}"
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
                        task=f"Soak {ing_name_en} overnight for tomorrow's {slot.slot.lower()} ({recipe.name})",
                        mr=f"उद्याच्या {slot.slot.lower()}साठी ({recipe.marathi_name}) {ing_name_mr} आज संध्याकाळी भिजत घाला",
                        area="evening_prep",
                        done=False,
                    )
                )

        # 2. Overnight Fermentation Requirement
        if recipe.fermentation_requirement == "overnight" or recipe.practical_metadata.fermentation_required:
            task_key = f"ferment-{prev_date_str}-{recipe.id}"
            if task_key not in seen_task_keys:
                seen_task_keys.add(task_key)
                prep_tasks.append(
                    PrepTaskItem(
                        id=task_key,
                        date=prev_date_str,
                        target_meal_date=meal_date_str,
                        target_slot=slot.slot,
                        recipe_id=recipe.id,
                        task=f"Set batter for overnight fermentation ({recipe.name})",
                        mr=f"उद्याच्या नाश्त्यासाठी ({recipe.marathi_name}) पीठ आज संध्याकाळी आंबवायला ठेवा",
                        area="evening_prep",
                        done=False,
                    )
                )

        # 3. Weekend Batch Preparation Opportunities
        is_weekend = meal_dt.weekday() in (5, 6)
        if is_weekend and recipe.batch_prep_suitability in ("high", "moderate"):
            task_key = f"batch-{meal_date_str}-{recipe.id}"
            if task_key not in seen_task_keys:
                seen_task_keys.add(task_key)
                prep_tasks.append(
                    PrepTaskItem(
                        id=task_key,
                        date=meal_date_str,
                        target_meal_date=meal_date_str,
                        target_slot=slot.slot,
                        recipe_id=recipe.id,
                        task=f"Batch prep opportunity: cook extra portion of {recipe.name} for upcoming weekday ease",
                        mr=f"बॅच कुकिंग: आठवड्याच्या सोयीसाठी {recipe.marathi_name} जास्त प्रमाणात तयार करा",
                        area="batch_prep",
                        done=False,
                    )
                )

    # Sort deterministically by date asc, area asc, recipe_id asc
    prep_tasks.sort(key=lambda t: (t.date, t.area, t.id))
    return prep_tasks
