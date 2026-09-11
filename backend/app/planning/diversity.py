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
        # Store internal records: list of (ordinal, date_str, slot, recipe)
        self.entries: list[tuple[int, str, str, Recipe]] = []
        self._cache_ordinal: int | None = None
        self._cache_by_diff: dict[int, list[tuple[str, Recipe]]] | None = None

        if history_by_date_slot:
            for key, rec in history_by_date_slot.items():
                parts = key.split("-")
                if len(parts) >= 4:
                    d_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
                    s_str = parts[3]
                    try:
                        d_ord = datetime.strptime(d_str, "%Y-%m-%d").toordinal()
                        self.entries.append((d_ord, d_str, s_str, rec))
                    except Exception:
                        continue

    @property
    def history(self) -> dict[str, Recipe]:
        """Backward-compatible dictionary view."""
        return {f"{d_str}-{s_str}": rec for _, d_str, s_str, rec in self.entries}

    def record_meal(self, target_date: str, slot: str, recipe: Recipe, target_ordinal: int | None = None) -> None:
        if target_ordinal is None:
            try:
                target_ordinal = datetime.strptime(target_date, "%Y-%m-%d").toordinal()
            except Exception:
                target_ordinal = 0
        self.entries.append((target_ordinal, target_date, slot, recipe))
        self._cache_ordinal = None
        self._cache_by_diff = None

    def copy(self) -> "RollingDiversityTracker":
        new_tracker = RollingDiversityTracker()
        new_tracker.entries = list(self.entries)
        return new_tracker

    def _get_recent_by_day_diff(self, curr_ordinal: int) -> dict[int, list[tuple[str, Recipe]]]:
        if self._cache_ordinal == curr_ordinal and self._cache_by_diff is not None:
            return self._cache_by_diff

        recent: dict[int, list[tuple[str, Recipe]]] = {}
        for d_ord, _, s_str, rec in self.entries:
            diff = curr_ordinal - d_ord
            if 0 <= diff <= 5:
                recent.setdefault(diff, []).append((s_str, rec))

        self._cache_ordinal = curr_ordinal
        self._cache_by_diff = recent
        return recent

    def evaluate_candidate_diversity(
        self,
        candidate: Recipe,
        slot: str,
        target_date: str,
        target_ordinal: int | None = None,
    ) -> tuple[float, list[str], list[str]]:
        """
        Evaluate rolling diversity score and explanations for a candidate recipe.
        Returns: (diversity_score_delta, positive_reasons, soft_penalties).
        """
        score_delta = 0.0
        positive_reasons: list[str] = []
        soft_penalties: list[str] = []

        if target_ordinal is None:
            curr_ordinal = datetime.strptime(target_date, "%Y-%m-%d").toordinal()
        else:
            curr_ordinal = target_ordinal

        recent_by_day_diff = self._get_recent_by_day_diff(curr_ordinal)

        fp = candidate.food_profile
        cand_legumes = set(fp.legume_identities) if fp else set()
        cand_grains = set(fp.grain_identities) if fp else set()
        cand_vegs = set(fp.vegetable_identities) if fp else set()
        cand_fruits = set(fp.fruit_identities) if fp else set()
        cand_form = candidate.practical_metadata.meal_form
        cand_grain_str = candidate.practical_metadata.primary_grain

        # 1. Pulse / Legume Rotation across 4-day window + same-day check
        if cand_legumes:
            # Same-day check (e.g. dinner following lunch on the same day)
            today_meals = recent_by_day_diff.get(0, [])
            today_legumes = set()
            for s, r in today_meals:
                if s != slot and r.food_profile:
                    today_legumes.update(r.food_profile.legume_identities)

            same_day_overlap = cand_legumes.intersection(today_legumes)
            if same_day_overlap:
                pulse_name = next(iter(same_day_overlap)).replace("_", " ").title()
                score_delta -= 15.0
                soft_penalties.append(f"Same pulse ({pulse_name}) served earlier today")
            else:
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
                    # Check if this pulse has NOT been served in the past 4 days (and not today)
                    past_4day_legumes = set(today_legumes)
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
        has_millet = (
            cand_grain_str == "millet"
            or bool(cand_grains.intersection({"jowar", "bajra", "ragi"}))
            or (fp is not None and fp.has_whole_grain_or_millet and "wheat" not in cand_grains and "rice" not in cand_grains)
        )
        if has_millet:
            recent_had_millet = False
            for d in (0, 1, 2):
                for s, r in recent_by_day_diff.get(d, []):
                    if d == 0 and s == slot:
                        continue
                    if r.practical_metadata.primary_grain == "millet":
                        recent_had_millet = True
                        break
                if recent_had_millet:
                    break
            if not recent_had_millet:
                score_delta += 10.0
                millet_name = next(iter(cand_grains.intersection({"jowar", "bajra", "ragi"})), "Millet").title()
                positive_reasons.append(f"Introduces wholesome millet diversity ({millet_name})")

        # 3. Vegetable Category Balance in Lunch/Dinner (including same-day)
        if slot.lower() in ("lunch", "dinner") and cand_vegs:
            past_vegs = set()
            # Include earlier today
            for s, r in recent_by_day_diff.get(0, []):
                if s != slot and s.lower() in ("lunch", "dinner") and r.food_profile:
                    past_vegs.update(r.food_profile.vegetable_identities)
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
