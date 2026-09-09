from datetime import datetime, timedelta
from typing import Any
from backend.app.domain.models import (
    Recipe,
    FamilyMember,
    DietaryRule,
    FrequencyRule,
    MealPlanSlot,
    MealAssignment,
    EvaluationSummary,
    PlanningResponse,
    AlternativeMeal,
    MealChangeResponse,
    CurrentMealContext,
)
from backend.app.domain.rules import (
    DEFAULT_DIETARY_RULES,
    DEFAULT_FREQUENCY_RULES,
    recipe_contains_ingredient,
    evaluate_member_eligibility,
)
from backend.app.planning.search import run_bounded_beam_search
from backend.app.planning.constraints import is_slot_compatible


def select_vegetarian_alternate(
    egg_recipe: Recipe,
    member: FamilyMember,
    catalog: list[Recipe],
) -> Recipe | None:
    """
    Select the best existing vegetarian alternate for a member.
    Prioritizes:
    1. same meal role
    2. similar dish form / function
    3. vegetarian compatibility
    4. similar protein role
    5. same meal category
    """
    candidates = [
        r for r in catalog
        if not r.dietary_flags.contains_egg and r.dietary_flags.vegetarian
    ]
    if not candidates:
        return None

    def rank_score(r: Recipe) -> tuple[int, str]:
        score = 0
        if r.meal_role == egg_recipe.meal_role:
            score += 50
        if r.practical_metadata.meal_form == egg_recipe.practical_metadata.meal_form:
            score += 30
        if r.meal_category == egg_recipe.meal_category or r.course == egg_recipe.course:
            score += 20
        if r.practical_metadata.primary_protein_source == egg_recipe.practical_metadata.primary_protein_source:
            score += 15
        return (-score, str(r.id or r.name))

    candidates.sort(key=rank_score)
    return candidates[0] if candidates else None


class PlanningEngine:
    def __init__(self, beam_width: int = 3):
        self.beam_width = beam_width

    def generate_plan(
        self,
        start_date: str,
        visible_days: int = 7,
        evaluation_days: int = 30,
        recipes: list[Recipe] | None = None,
        members: list[FamilyMember] | None = None,
        dietary_rules: list[DietaryRule] | None = None,
        frequency_rules: list[FrequencyRule] | None = None,
        existing_history: dict[str, Recipe] | None = None,
        unavailable_ingredients: list[str] | None = None,
        overrides: dict[str, Any] | None = None,
    ) -> PlanningResponse:
        catalog = recipes or []
        fam_members = members or []
        d_rules = dietary_rules or DEFAULT_DIETARY_RULES
        f_rules = frequency_rules or DEFAULT_FREQUENCY_RULES

        winning_plan, final_beam = run_bounded_beam_search(
            start_date=start_date,
            visible_days=visible_days,
            evaluation_days=evaluation_days,
            beam_width=self.beam_width,
            recipes_catalog=catalog,
            members=fam_members,
            dietary_rules=d_rules,
            frequency_rules=f_rules,
            existing_history=existing_history,
            unavailable_ingredients=unavailable_ingredients,
        )

        # Slice to visible days
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        cutoff_date = (start_dt + timedelta(days=visible_days)).strftime("%Y-%m-%d")
        visible_slots_data = [s for s in winning_plan.slots if s["date"] < cutoff_date]

        plan_slots: list[MealPlanSlot] = []
        warnings: list[str] = []

        # Build assignments and plan slots
        for s in visible_slots_data:
            s_date = s["date"]
            s_slot = s["slot"]
            s_recipe: Recipe = s["recipe"]
            s_exp = s["explanation"]

            assignments: list[MealAssignment] = []
            for member in fam_members:
                eligible, _ = evaluate_member_eligibility(member, s_recipe, d_rules)
                if eligible:
                    assignments.append(
                        MealAssignment(
                            meal_entry_id=f"{s_date}-{s_slot}",
                            member_id=member.id,
                            recipe_id=s_recipe.id,
                            portion_factor=1.0,
                            assignment_source="automatic",
                            automatic_recipe_id=s_recipe.id,
                        )
                    )
                else:
                    # Find suitable vegetarian alternate
                    alt = select_vegetarian_alternate(s_recipe, member, catalog)
                    if alt:
                        assignments.append(
                            MealAssignment(
                                meal_entry_id=f"{s_date}-{s_slot}",
                                member_id=member.id,
                                recipe_id=alt.id,
                                portion_factor=1.0,
                                assignment_source="automatic",
                                automatic_recipe_id=alt.id,
                                override_reason="Vegetarian alternate for egg recipe",
                            )
                        )
                    else:
                        warnings.append(f"No vegetarian alternate found for member {member.name} on {s_date} {s_slot}")
                        assignments.append(
                            MealAssignment(
                                meal_entry_id=f"{s_date}-{s_slot}",
                                member_id=member.id,
                                recipe_id=None,
                                portion_factor=1.0,
                                assignment_source="automatic",
                                override_reason="No suitable alternate found",
                            )
                        )

            plan_slots.append(
                MealPlanSlot(
                    id=f"{s_date}-{s_slot}",
                    date=s_date,
                    slot=s_slot,
                    title=s_recipe.name,
                    marathi_title=s_recipe.marathi_name or s_recipe.name,
                    recipe_id=s_recipe.id,
                    recipe=s_recipe,
                    status="Planned",
                    assignments=assignments,
                    explanation=s_exp,
                )
            )

        # Quality Gate Pass
        month_paneer: dict[str, int] = {}
        for slot in plan_slots:
            if recipe_contains_ingredient(slot.recipe, "paneer"):
                m_key = slot.date[:7]
                month_paneer[m_key] = month_paneer.get(m_key, 0) + 1
                if month_paneer[m_key] > 5:
                    warnings.append(f"Quality Gate Warning: Paneer occurrences exceed monthly limit ({month_paneer[m_key]}/5)")

        return PlanningResponse(
            success=True,
            plan=plan_slots,
            warnings=warnings,
            evaluation_summary=EvaluationSummary(
                visible_days=visible_days,
                evaluation_days=evaluation_days,
                total_meals_planned=len(plan_slots),
                start_date=start_date,
            ),
        )

    def propose_meal_change(
        self,
        current_meal: CurrentMealContext,
        reason: str,
        catalog: list[Recipe],
        members: list[FamilyMember] | None = None,
        dietary_rules: list[DietaryRule] | None = None,
        recent_history: list[Recipe] | None = None,
        unavailable_ingredients: list[str] | None = None,
        custom_constraint: str | None = None,
    ) -> MealChangeResponse:
        current_recipe = current_meal.recipe
        slot = current_meal.slot
        target_date = current_meal.date

        # Filter by slot compatibility
        candidates = [
            r for r in catalog
            if is_slot_compatible(r, slot)
            and (current_recipe is None or r.id != current_recipe.id)
        ]

        scored_alts: list[AlternativeMeal] = []
        warnings: list[str] = []

        unavail = set(x.lower().strip() for x in (unavailable_ingredients or []))

        for cand in candidates:
            # Check unavailable ingredients
            if unavail and any(recipe_contains_ingredient(cand, ing) for ing in unavail):
                continue

            score = 100.0
            reasons = []

            if current_recipe:
                curr_form = current_recipe.practical_metadata.meal_form
                curr_grain = current_recipe.practical_metadata.primary_grain
                curr_protein = current_recipe.practical_metadata.primary_protein_source
                cand_form = cand.practical_metadata.meal_form
                cand_grain = cand.practical_metadata.primary_grain
                cand_protein = cand.practical_metadata.primary_protein_source

                if reason == "ingredient_unavailable":
                    score += 50.0
                    reasons.append("Contains only available ingredients")

                elif reason == "want_lighter":
                    if cand.practical_metadata.meal_density == "light":
                        score += 60.0
                        reasons.append("Lighter meal form with quick digestion")
                    elif cand.practical_metadata.meal_density in ("substantial", "heavy"):
                        score -= 50.0

                elif reason == "want_different_grain":
                    if cand_grain != curr_grain:
                        score += 50.0
                        reasons.append(f"Features {cand_grain} instead of {curr_grain}")
                    else:
                        score -= 40.0

                elif reason == "want_different_protein":
                    if cand_protein != curr_protein:
                        score += 50.0
                        reasons.append(f"Provides protein from {cand_protein.replace('_', ' ')} instead of {curr_protein.replace('_', ' ')}")
                    else:
                        score -= 40.0

                elif reason == "want_different_meal_form":
                    if cand_form != curr_form:
                        score += 50.0
                        reasons.append(f"Different preparation style ({cand_form.replace('_', ' ')})")
                    else:
                        score -= 40.0

                elif reason == "want_quick":
                    if cand.practical_metadata.soaking_required or cand.practical_metadata.fermentation_required:
                        score -= 60.0
                    if cand.practical_metadata.time_minutes <= 25:
                        score += 50.0
                        reasons.append(f"Quick preparation (~{cand.practical_metadata.time_minutes} min)")
                    else:
                        score -= 30.0

                elif reason == "not_in_mood":
                    # Multi-dimensional variation (form, grain, protein)
                    diff_dimensions = 0
                    if cand_form != curr_form:
                        diff_dimensions += 1
                    if cand_grain != curr_grain:
                        diff_dimensions += 1
                    if cand_protein != curr_protein:
                        diff_dimensions += 1

                    score += diff_dimensions * 25.0
                    reasons.append(f"Distinct profile across meal form and ingredients ({diff_dimensions} fresh dimensions)")

                elif reason == "too_repetitive":
                    # Inspect recent history
                    history = recent_history or []
                    rep_count = sum(1 for h in history if h.id == cand.id or h.practical_metadata.meal_form == cand_form)
                    score -= (rep_count * 20.0)
                    if rep_count == 0:
                        score += 40.0
                        reasons.append("Fresh dish not seen in recent meal history")

                elif reason == "custom":
                    if custom_constraint:
                        c_lower = custom_constraint.lower()
                        if c_lower in cand.name.lower() or any(c_lower in ing.lower() for ing in cand.ingredients):
                            score += 60.0
                            reasons.append(f"Satisfies custom constraint: '{custom_constraint}'")
                        else:
                            score -= 20.0
                    else:
                        reasons.append("Alternative choice")

            scored_alts.append(
                AlternativeMeal(
                    recipe=cand,
                    score=round(score, 1),
                    explanation={
                        "reasons": reasons or ["Suitable alternative"],
                        "meal_form": cand.practical_metadata.meal_form,
                        "primary_protein": cand.practical_metadata.primary_protein_source,
                    },
                )
            )

        # Sort deterministically
        scored_alts.sort(key=lambda a: (-a.score, str(a.recipe.id or a.recipe.name)))

        return MealChangeResponse(
            success=True,
            reason_applied=reason,
            alternatives=scored_alts,
            recommendation=scored_alts[0] if scored_alts else None,
            warnings=warnings,
        )
