from datetime import datetime
from backend.app.domain.models import Recipe
from backend.app.domain.rules import recipe_contains_ingredient
from backend.app.domain.seasonality import get_current_season, evaluate_ingredient_season
from backend.app.planning.diversity import RollingDiversityTracker


def score_candidate(
    recipe: Recipe,
    slot: str,
    target_date: str,
    recent_meals_by_date_slot: dict[str, Recipe],
    recent_dates_with_paneer: set[str],
    diversity_tracker: RollingDiversityTracker | None = None,
    target_ordinal: int | None = None,
    target_dt: datetime | None = None,
    is_weekend: bool | None = None,
    current_season: str | None = None,
    recent_meal_records: list[tuple[int, str, str, Recipe]] | None = None,
) -> tuple[float, list[str], list[str], list[str]]:
    """
    Score a valid candidate recipe.
    Returns (score, positive_reasons, culinary_benefits, soft_penalties).
    """
    score = 100.0
    positive_reasons: list[str] = []
    culinary_benefits: list[str] = []
    soft_penalties: list[str] = []

    if target_dt is None:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
    else:
        dt = target_dt

    if target_ordinal is None:
        curr_ordinal = dt.toordinal()
    else:
        curr_ordinal = target_ordinal

    if is_weekend is None:
        weekend = dt.weekday() in (5, 6)
    else:
        weekend = is_weekend

    if current_season is None:
        season = get_current_season(dt)
    else:
        season = current_season

    # 1. Heaviness Spacing
    if slot.lower() == "dinner":
        lunch_recipe = recent_meals_by_date_slot.get(f"{target_date}-Lunch")
        if lunch_recipe:
            lunch_density = lunch_recipe.practical_metadata.meal_density
            cand_density = recipe.practical_metadata.meal_density

            if lunch_density in ("substantial", "heavy"):
                if cand_density == "light":
                    score += 35.0
                    positive_reasons.append("Light dinner follows substantial lunch")
                    culinary_benefits.append("Digestive ease with lighter evening meal")
                elif cand_density in ("substantial", "heavy"):
                    score -= 30.0
                    soft_penalties.append("Back-to-back heavy meals on the same day")
            elif lunch_density == "light":
                if cand_density in ("moderate", "substantial"):
                    score += 15.0
                    positive_reasons.append("Satisfying dinner complements light lunch")

    # 2. Soft Paneer Spacing (Heuristic only, NEVER hard constraint)
    if recipe_contains_ingredient(recipe, "paneer"):
        yesterday_str = datetime.fromordinal(curr_ordinal - 1).strftime("%Y-%m-%d")
        if yesterday_str in recent_dates_with_paneer:
            score -= 15.0
            soft_penalties.append("Soft spacing preference: paneer was served yesterday")
        else:
            positive_reasons.append("Paneer meal within monthly allowance")

    # 3. Recipe Repetition within recent days
    if recent_meal_records is not None:
        for prev_ord, prev_date, prev_slot, prev_rec in recent_meal_records:
            day_diff = abs(curr_ordinal - prev_ord)
            if prev_rec.id == recipe.id or prev_rec.name.lower() == recipe.name.lower():
                if day_diff == 0:
                    score -= 60.0
                    soft_penalties.append(f"Same recipe served earlier today")
                elif day_diff <= 3:
                    score -= 40.0
                    soft_penalties.append(f"Same recipe served {day_diff} days ago")
                elif day_diff <= 7:
                    score -= 20.0
                    soft_penalties.append(f"Same recipe served within the past week")

            # Meal form and grain repetition on consecutive days
            if day_diff == 1 and slot == prev_slot:
                if prev_rec.practical_metadata.meal_form == recipe.practical_metadata.meal_form:
                    score -= 15.0
                    soft_penalties.append(f"Repeated meal form ({recipe.practical_metadata.meal_form}) in {slot}")
                if (
                    prev_rec.practical_metadata.primary_grain != "none"
                    and prev_rec.practical_metadata.primary_grain == recipe.practical_metadata.primary_grain
                ):
                    score -= 10.0
                    soft_penalties.append(f"Repeated grain ({recipe.practical_metadata.primary_grain})")
                if prev_rec.practical_metadata.primary_protein_source == recipe.practical_metadata.primary_protein_source:
                    score -= 10.0
                    soft_penalties.append(f"Repeated protein source ({recipe.practical_metadata.primary_protein_source})")
    else:
        for key, prev_rec in recent_meals_by_date_slot.items():
            parts = key.split("-")
            if len(parts) >= 4:
                prev_date = f"{parts[0]}-{parts[1]}-{parts[2]}"
                prev_slot = parts[3]
            else:
                prev_date = key
                prev_slot = slot
            try:
                prev_ord = datetime.strptime(prev_date, "%Y-%m-%d").toordinal()
                day_diff = abs(curr_ordinal - prev_ord)
            except Exception:
                day_diff = 99

            if prev_rec.id == recipe.id or prev_rec.name.lower() == recipe.name.lower():
                if day_diff == 0:
                    score -= 60.0
                    soft_penalties.append(f"Same recipe served earlier today")
                elif day_diff <= 3:
                    score -= 40.0
                    soft_penalties.append(f"Same recipe served {day_diff} days ago")
                elif day_diff <= 7:
                    score -= 20.0
                    soft_penalties.append(f"Same recipe served within the past week")

            # Meal form and grain repetition on consecutive days
            if day_diff == 1 and slot == prev_slot:
                if prev_rec.practical_metadata.meal_form == recipe.practical_metadata.meal_form:
                    score -= 15.0
                    soft_penalties.append(f"Repeated meal form ({recipe.practical_metadata.meal_form}) in {slot}")
                if (
                    prev_rec.practical_metadata.primary_grain != "none"
                    and prev_rec.practical_metadata.primary_grain == recipe.practical_metadata.primary_grain
                ):
                    score -= 10.0
                    soft_penalties.append(f"Repeated grain ({recipe.practical_metadata.primary_grain})")
                if prev_rec.practical_metadata.primary_protein_source == recipe.practical_metadata.primary_protein_source:
                    score -= 10.0
                    soft_penalties.append(f"Repeated protein source ({recipe.practical_metadata.primary_protein_source})")

    # 4. Culinary and Nutrition Bonuses
    if recipe.dietary_flags.vegetables:
        score += 10.0
        culinary_benefits.append("Vegetable variety included")
    if recipe.dietary_flags.whole_grains:
        score += 10.0
        culinary_benefits.append("Whole grains / millet contribution")
    if recipe.dietary_flags.legumes:
        score += 10.0
        culinary_benefits.append("Plant protein / legumes present")
    if recipe.dietary_flags.fruit:
        score += 5.0
        culinary_benefits.append("Fresh fruit accompaniment")

    # 5. Practicality & Burden
    time_min = recipe.practical_metadata.time_minutes
    if not weekend and time_min > 35:
        score -= 15.0
        soft_penalties.append(f"Cooking burden on weekday (~{time_min} min)")
    elif time_min <= 20:
        score += 10.0
        positive_reasons.append(f"Quick preparation (~{time_min} min)")

    # 6. Seasonal Produce Alignment (Soft bonus; out-of-season NEVER penalized)
    peak_seasonal_ingredients: list[str] = []
    for ing in recipe.structured_ingredients:
        is_peak, status, cul = evaluate_ingredient_season(ing.ingredient_key, season)
        if is_peak:
            peak_seasonal_ingredients.append(ing.ingredient_key.replace("_", " ").title())
    if peak_seasonal_ingredients:
        score += 10.0
        unique_peak = sorted(set(peak_seasonal_ingredients))
        positive_reasons.append(f"Features seasonal {season} produce ({', '.join(unique_peak)})")
        culinary_benefits.append(f"Seasonal fresh produce ({', '.join(unique_peak)})")

    # 7. Multi-Day Contextual Diversity
    if diversity_tracker:
        div_score, div_pos, div_pen = diversity_tracker.evaluate_candidate_diversity(
            recipe, slot, target_date, target_ordinal=curr_ordinal
        )
        score += div_score
        positive_reasons.extend(div_pos)
        soft_penalties.extend(div_pen)

    return score, positive_reasons, culinary_benefits, soft_penalties
