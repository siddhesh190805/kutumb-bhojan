from datetime import datetime, timedelta
from typing import Any
from backend.app.domain.models import Recipe, FamilyMember, DietaryRule, FrequencyRule
from backend.app.domain.rules import recipe_contains_ingredient
from backend.app.domain.seasonality import get_current_season
from backend.app.planning.constraints import evaluate_hard_constraints, is_slot_compatible
from backend.app.planning.scoring import score_candidate
from backend.app.planning.explanations import build_explanation
from backend.app.planning.diversity import RollingDiversityTracker


class PartialPlan:
    def __init__(
        self,
        cumulative_score: float = 0.0,
        slots: list[dict[str, Any]] | None = None,
        planned_meals_by_key: dict[str, Recipe] | None = None,
        meal_records: list[tuple[int, str, str, Recipe]] | None = None,
        dates_with_paneer: set[str] | None = None,
        paneer_counts_by_month: dict[str, int] | None = None,
        diversity_tracker: RollingDiversityTracker | None = None,
    ):
        self.cumulative_score = cumulative_score
        self.slots = list(slots or [])
        self.planned_meals_by_key = dict(planned_meals_by_key or {})
        self.dates_with_paneer = set(dates_with_paneer or set())
        self.paneer_counts_by_month = dict(paneer_counts_by_month or {})
        if meal_records is not None:
            self.meal_records = list(meal_records)
        else:
            self.meal_records = []
            for k, r in self.planned_meals_by_key.items():
                parts = k.split("-")
                if len(parts) >= 4:
                    d_s = f"{parts[0]}-{parts[1]}-{parts[2]}"
                    s_s = parts[3]
                    try:
                        self.meal_records.append((datetime.strptime(d_s, "%Y-%m-%d").toordinal(), d_s, s_s, r))
                    except Exception:
                        pass
        self.diversity_tracker = (
            diversity_tracker.copy()
            if diversity_tracker
            else RollingDiversityTracker(self.planned_meals_by_key)
        )

    def copy(self) -> "PartialPlan":
        return PartialPlan(
            cumulative_score=self.cumulative_score,
            slots=list(self.slots),
            planned_meals_by_key=dict(self.planned_meals_by_key),
            meal_records=list(self.meal_records),
            dates_with_paneer=set(self.dates_with_paneer),
            paneer_counts_by_month=dict(self.paneer_counts_by_month),
            diversity_tracker=self.diversity_tracker.copy(),
        )

    def add_decision(
        self,
        target_date: str,
        slot: str,
        recipe: Recipe,
        step_score: float,
        explanation: dict[str, Any],
        target_ordinal: int | None = None,
    ) -> None:
        key = f"{target_date}-{slot}"
        self.cumulative_score += step_score
        self.slots.append({
            "date": target_date,
            "slot": slot,
            "recipe": recipe,
            "score": step_score,
            "explanation": explanation,
        })
        self.planned_meals_by_key[key] = recipe
        if target_ordinal is None:
            try:
                target_ordinal = datetime.strptime(target_date, "%Y-%m-%d").toordinal()
            except Exception:
                target_ordinal = 0
        self.meal_records.append((target_ordinal, target_date, slot, recipe))
        self.diversity_tracker.record_meal(target_date, slot, recipe, target_ordinal=target_ordinal)

        if recipe_contains_ingredient(recipe, "paneer"):
            self.dates_with_paneer.add(target_date)
            month_key = target_date[:7]
            self.paneer_counts_by_month[month_key] = (
                self.paneer_counts_by_month.get(month_key, 0) + 1
            )


def run_bounded_beam_search(
    start_date: str,
    visible_days: int = 7,
    evaluation_days: int = 30,
    beam_width: int = 3,
    recipes_catalog: list[Recipe] | None = None,
    members: list[FamilyMember] | None = None,
    dietary_rules: list[DietaryRule] | None = None,
    frequency_rules: list[FrequencyRule] | None = None,
    existing_history: dict[str, Recipe] | None = None,
    member_histories: dict[str, dict[str, Any]] | None = None,
    unavailable_ingredients: list[str] | None = None,
) -> tuple[PartialPlan, list[PartialPlan]]:
    """
    Execute deterministic bounded beam search across evaluation_days.
    Returns (winning_plan, final_beam).
    """
    catalog = recipes_catalog or []
    slots_order = ["Breakfast", "Lunch", "Snack", "Dinner"]
    catalog_by_slot: dict[str, list[Recipe]] = {
        s: [r for r in catalog if is_slot_compatible(r, s)] for s in slots_order
    }

    # Initial frequency counts from existing history
    initial_dates_with_paneer: set[str] = set()
    initial_paneer_counts: dict[str, int] = {}
    history_map = dict(existing_history or {})

    for key, rec in history_map.items():
        m_date = key.split("-")[0] + "-" + key.split("-")[1] + "-" + key.split("-")[2]
        if recipe_contains_ingredient(rec, "paneer"):
            initial_dates_with_paneer.add(m_date)
            m_month = m_date[:7]
            initial_paneer_counts[m_month] = initial_paneer_counts.get(m_month, 0) + 1

    # Max paneer from frequency rules
    max_paneer = 5
    if frequency_rules:
        for fr in frequency_rules:
            if fr.ingredient_key.lower() == "paneer":
                max_paneer = fr.max_per_calendar_month

    # Initialize beam with one empty partial plan
    initial_plan = PartialPlan(
        cumulative_score=0.0,
        slots=[],
        planned_meals_by_key=history_map,
        dates_with_paneer=initial_dates_with_paneer,
        paneer_counts_by_month=initial_paneer_counts,
    )
    beam: list[PartialPlan] = [initial_plan]

    start_dt = datetime.strptime(start_date, "%Y-%m-%d")

    # Step through every day and slot in evaluation_days
    for day_idx in range(evaluation_days):
        current_dt = start_dt + timedelta(days=day_idx)
        current_date_str = current_dt.strftime("%Y-%m-%d")
        curr_ordinal = current_dt.toordinal()
        month_str = current_date_str[:7]
        is_weekend = current_dt.weekday() in (5, 6)
        current_season = get_current_season(current_dt)

        for slot in slots_order:
            successors: list[PartialPlan] = []

            for partial in beam:
                curr_paneer_month = partial.paneer_counts_by_month.get(month_str, 0)

                # 1. Filter candidates via hard constraints (pre-filtered by slot)
                candidate_pool = catalog_by_slot.get(slot, catalog)
                valid_candidates = []
                for rec in candidate_pool:
                    is_valid, _ = evaluate_hard_constraints(
                        recipe=rec,
                        slot=slot,
                        target_date=current_date_str,
                        paneer_count_in_month=curr_paneer_month,
                        max_paneer_per_month=max_paneer,
                        unavailable_ingredients=unavailable_ingredients,
                        recipes_catalog=catalog,
                        members=members,
                        dietary_rules=dietary_rules,
                    )
                    if is_valid:
                        valid_candidates.append(rec)

                # Fallback if no valid candidates found (e.g. strict filtering)
                if not valid_candidates:
                    valid_candidates = [r for r in candidate_pool if r.course in ("Lunch/Dinner", slot)]

                # 2. Score valid candidates using precomputed date/ordinal/season
                scored_candidates = []
                for cand in valid_candidates:
                    step_score, pos_reasons, cul_benefits, soft_pen = score_candidate(
                        recipe=cand,
                        slot=slot,
                        target_date=current_date_str,
                        recent_meals_by_date_slot=partial.planned_meals_by_key,
                        recent_dates_with_paneer=partial.dates_with_paneer,
                        diversity_tracker=partial.diversity_tracker,
                        target_ordinal=curr_ordinal,
                        target_dt=current_dt,
                        is_weekend=is_weekend,
                        current_season=current_season,
                        recent_meal_records=partial.meal_records,
                    )
                    scored_candidates.append((cand, step_score, pos_reasons, cul_benefits, soft_pen))

                # Deterministic candidate sorting: score desc, then recipe id asc
                scored_candidates.sort(
                    key=lambda item: (-item[1], str(item[0].id or item[0].name))
                )

                # Expand top successors (at most beam_width candidates per partial plan)
                top_to_expand = scored_candidates[:beam_width]
                for cand, step_score, pos_reasons, cul_benefits, soft_pen in top_to_expand:
                    alt_names = [sc[0].name for sc in scored_candidates if sc[0].id != cand.id]
                    explanation = build_explanation(
                        recipe=cand,
                        score=step_score,
                        positive_reasons=pos_reasons,
                        culinary_benefits=cul_benefits,
                        soft_penalties=soft_pen,
                        alternatives_considered=alt_names,
                        visible_days=visible_days,
                        evaluation_days=evaluation_days,
                    )
                    succ = partial.copy()
                    succ.add_decision(
                        target_date=current_date_str,
                        slot=slot,
                        recipe=cand,
                        step_score=step_score,
                        explanation=explanation,
                        target_ordinal=curr_ordinal,
                    )
                    successors.append(succ)

            # 3. Retain top beam_width partial plans deterministically
            successors.sort(
                key=lambda p: (
                    -p.cumulative_score,
                    # Stable tie-break by sequence of recipe IDs
                    tuple(s["recipe"].id for s in p.slots)
                )
            )
            beam = successors[:beam_width]

    winning_plan = beam[0]
    return winning_plan, beam
