"""
NFDI-001C Rolling Contextual Food Diversity Tracker.

Maintains multi-day rolling windows across:
- Legume / pulse rotation (moong, chana, matki, rajma, lobia, soy)
- Grain & millet diversity (jowar, bajra, ragi, wheat, rice, poha, oats)
- Vegetable category balance (leafy_green, cruciferous, root_tuber, fruit_vegetable)
- Fruit variety in snacks
- Meal form diversity across days
"""

from datetime import datetime
from typing import Any
from backend.app.domain.models import Recipe


class RollingDiversityTracker:
    def __init__(self, history_by_date_slot: dict[str, Recipe] | None = None):
        # Key: YYYY-MM-DD-Slot -> Recipe
        self.history: dict[str, Recipe] = dict(history_by_date_slot or {})

    def record_meal(self, target_date: str, slot: str, recipe: Recipe) -> None:
        self.history[f"{target_date}-{slot}"] = recipe

    def copy(self) -> "RollingDiversityTracker":
        return RollingDiversityTracker(self.history)

    def evaluate_candidate_diversity(
        self,
        candidate: Recipe,
        slot: str,
        target_date: str,
    ) -> tuple[float, list[str], list[str]]:
        """
        Evaluate rolling diversity score and explanations for a candidate recipe.
        Returns: (diversity_score_delta, positive_reasons, soft_penalties).
        """
        score_delta = 0.0
        positive_reasons: list[str] = []
        soft_penalties: list[str] = []

        curr_dt = datetime.strptime(target_date, "%Y-%m-%d")
        curr_ordinal = curr_dt.toordinal()

        # Collect recent meals by day difference (0 to 5 days back)
        recent_by_day_diff: dict[int, list[tuple[str, Recipe]]] = {}
        for key, rec in self.history.items():
            parts = key.split("-")
            if len(parts) < 4:
                continue
            d_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
            s_str = parts[3]
            try:
                d_ord = datetime.strptime(d_str, "%Y-%m-%d").toordinal()
                diff = curr_ordinal - d_ord
                if 0 <= diff <= 5:
                    recent_by_day_diff.setdefault(diff, []).append((s_str, rec))
            except Exception:
                continue

        fp = candidate.food_profile
        cand_legumes = set(fp.legume_identities) if fp else set()
        cand_grains = set(fp.grain_identities) if fp else set()
        cand_vegs = set(fp.vegetable_identities) if fp else set()
        cand_fruits = set(fp.fruit_identities) if fp else set()
        cand_form = candidate.practical_metadata.meal_form
        cand_grain_str = candidate.practical_metadata.primary_grain

        # 1. Pulse / Legume Rotation across 4-day window
        if cand_legumes:
            yesterday_meals = recent_by_day_diff.get(1, [])
            yesterday_legumes = set()
            for _, r in yesterday_meals:
                if r.food_profile:
                    yesterday_legumes.update(r.food_profile.legume_identities)

            overlap = cand_legumes.intersection(yesterday_legumes)
            if overlap:
                pulse_name = next(iter(overlap)).replace("_", " ").title()
                score_delta -= 15.0
                soft_penalties.append(f"Same pulse ({pulse_name}) served yesterday")
            else:
                # Check if this pulse has NOT been served in the past 4 days
                past_4day_legumes = set()
                for d in range(1, 5):
                    for _, r in recent_by_day_diff.get(d, []):
                        if r.food_profile:
                            past_4day_legumes.update(r.food_profile.legume_identities)
                novel_pulses = cand_legumes.difference(past_4day_legumes)
                if novel_pulses:
                    pulse_name = next(iter(novel_pulses)).replace("_", " ").title()
                    score_delta += 12.0
                    positive_reasons.append(f"Rotates pulse variety with {pulse_name}")

        # 2. Grain & Millet Diversity
        # If candidate features millet (jowar, bajra, ragi or has_whole_grain_or_millet)
        has_millet = (
            cand_grain_str == "millet"
            or bool(cand_grains.intersection({"jowar", "bajra", "ragi"}))
            or (fp is not None and fp.has_whole_grain_or_millet and "wheat" not in cand_grains and "rice" not in cand_grains)
        )
        if has_millet:
            # Check if last 2 days had mostly wheat/rice
            recent_had_millet = False
            for d in (1, 2):
                for _, r in recent_by_day_diff.get(d, []):
                    if r.practical_metadata.primary_grain == "millet":
                        recent_had_millet = True
                        break
            if not recent_had_millet:
                score_delta += 10.0
                millet_name = next(iter(cand_grains.intersection({"jowar", "bajra", "ragi"})), "Millet").title()
                positive_reasons.append(f"Introduces wholesome millet diversity ({millet_name})")

        # 3. Vegetable Category Balance in Lunch/Dinner
        if slot.lower() in ("lunch", "dinner") and cand_vegs:
            # Check vegetable categories covered in past 48 hours (diff 1 and 2)
            past_vegs = set()
            for d in (1, 2):
                for s, r in recent_by_day_diff.get(d, []):
                    if s.lower() in ("lunch", "dinner") and r.food_profile:
                        past_vegs.update(r.food_profile.vegetable_identities)

            new_vegs = cand_vegs.difference(past_vegs)
            if new_vegs:
                v_name = next(iter(new_vegs)).replace("_", " ").title()
                score_delta += 8.0
                positive_reasons.append(f"Features distinct vegetable variety ({v_name})")

        # 4. Fruit Variety in Snacks
        if slot.lower() == "snack" and cand_fruits:
            past_fruits = set()
            for d in (1, 2, 3):
                for _, r in recent_by_day_diff.get(d, []):
                    if r.food_profile:
                        past_fruits.update(r.food_profile.fruit_identities)
            new_fruits = cand_fruits.difference(past_fruits)
            if new_fruits:
                f_name = next(iter(new_fruits)).replace("_", " ").title()
                score_delta += 6.0
                positive_reasons.append(f"Fresh fruit variety ({f_name})")

        # 5. Meal Form Diversity over past 3 days
        if cand_form and cand_form != "unknown":
            form_count_past_3d = 0
            for d in (1, 2, 3):
                for _, r in recent_by_day_diff.get(d, []):
                    if r.practical_metadata.meal_form == cand_form:
                        form_count_past_3d += 1
            if form_count_past_3d >= 2:
                score_delta -= 12.0
                soft_penalties.append(f"Meal form repeated recently ({cand_form.replace('_', ' ')})")
            elif form_count_past_3d == 0:
                score_delta += 5.0
                positive_reasons.append(f"Diverse meal preparation ({cand_form.replace('_', ' ')})")

        return score_delta, positive_reasons, soft_penalties
