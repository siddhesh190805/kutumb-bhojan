from datetime import datetime, timedelta
from typing import Any
from backend.app.domain.models import Recipe, FamilyMember, DietaryRule, FrequencyRule
from backend.app.domain.rules import recipe_contains_ingredient
from backend.app.planning.constraints import evaluate_hard_constraints
from backend.app.planning.scoring import score_candidate
from backend.app.planning.explanations import build_explanation


from backend.app.planning.diversity import RollingDiversityTracker


class PartialPlan:
    def __init__(
        self,
        cumulative_score: float = 0.0,
        slots: list[dict[str, Any]] | None = None,
        planned_meals_by_key: dict[str, Recipe] | None = None,
        dates_with_paneer: set[str] | None = None,
        paneer_counts_by_month: dict[str, int] | None = None,
        diversity_tracker: RollingDiversityTracker | None = None,
    ):
        self.cumulative_score = cumulative_score
        self.slots = list(slots or [])
        self.planned_meals_by_key = dict(planned_meals_by_key or {})
        self.dates_with_paneer = set(dates_with_paneer or set())
        self.paneer_counts_by_month = dict(paneer_counts_by_month or {})
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
        self.diversity_tracker.record_meal(target_date, slot, recipe)

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
    unavailable_ingredients: list[str] | None = None,
) -> tuple[PartialPlan, list[PartialPlan]]:
    """
    Execute deterministic bounded beam search across evaluation_days.
    Returns (winning_plan, final_beam).
    """
    catalog = recipes_catalog or []
    slots_order = ["Breakfast", "Lunch", "Snack", "Dinner"]

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
        current_date_str = (start_dt + timedelta(days=day_idx)).strftime("%Y-%m-%d")
        month_str = current_date_str[:7]

        for slot in slots_order:
            successors: list[PartialPlan] = []

            for partial in beam:
                curr_paneer_month = partial.paneer_counts_by_month.get(month_str, 0)

                # 1. Filter candidates via hard constraints
                valid_candidates = []
                for rec in catalog:
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
                    valid_candidates = [r for r in catalog if r.course in ("Lunch/Dinner", slot)]

                # 2. Score valid candidates
                scored_candidates = []
                for cand in valid_candidates:
                    step_score, pos_reasons, cul_benefits, soft_pen = score_candidate(
                        recipe=cand,
                        slot=slot,
                        target_date=current_date_str,
                        recent_meals_by_date_slot=partial.planned_meals_by_key,
                        recent_dates_with_paneer=partial.dates_with_paneer,
                        diversity_tracker=partial.diversity_tracker,
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
