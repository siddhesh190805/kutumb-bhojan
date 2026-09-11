from typing import Any
from backend.app.domain.models import Recipe, DecisionMetadata


def build_explanation(
    recipe: Recipe,
    score: float,
    positive_reasons: list[str],
    culinary_benefits: list[str],
    soft_penalties: list[str],
    alternatives_considered: list[str],
    visible_days: int = 7,
    evaluation_days: int = 30,
) -> dict[str, Any]:
    """Generate structured bilingual decision metadata that survives persistence and reload."""
    reasons = list(positive_reasons)
    if not reasons:
        reasons.append(f"Well balanced {recipe.practical_metadata.meal_form} for household routine")

    # Truthful applied_rules: only include rules that actually affected this candidate
    applied: list[str] = []
    # Hard constraints always evaluated (slot_compatibility, paneer limit, member eligibility)
    applied.append("slot_compatibility")
    if any("paneer" in p.lower() or "Paneer" in r for r in reasons for p in [r]):
        # If paneer reasoning present, include paneer limit
        pass
    # Derive from actual soft penalties and reasons
    penalty_text = " ".join(soft_penalties).lower()
    reason_text = " ".join(reasons).lower()
    if "paneer" in penalty_text or "paneer" in reason_text:
        applied.append("monthly_paneer_limit")
    if "pulse" in penalty_text or "pulse" in reason_text or "millet" in reason_text or "vegetable" in reason_text or "meal form" in penalty_text:
        applied.append("diversity_heuristics")
    if "seasonal" in reason_text:
        applied.append("seasonality_bonus")
    if "heavy" in penalty_text or "light dinner" in reason_text or "cooking burden" in penalty_text or "quick preparation" in reason_text:
        applied.append("practicality_burden")
    if "repeated" in penalty_text or "same recipe" in penalty_text:
        applied.append("repetition_avoidance")
    if not applied or applied == ["slot_compatibility"]:
        # Always include at minimum slot_compatibility and member eligibility (evaluated per candidate in search)
        applied = ["slot_compatibility", "member_dietary_eligibility"]
        if "monthly_paneer_limit" not in applied and ("paneer" in penalty_text or "paneer" in reason_text):
            applied.append("monthly_paneer_limit")
    else:
        if "slot_compatibility" not in applied:
            applied.insert(0, "slot_compatibility")
        if "member_dietary_eligibility" not in applied:
            applied.append("member_dietary_eligibility")
    # Deduplicate preserving order
    seen = set()
    deduped: list[str] = []
    for r in applied:
        if r not in seen:
            seen.add(r)
            deduped.append(r)

    metadata = DecisionMetadata(
        planner_version="fastapi-beam-v1",
        selected_because=reasons,
        applied_rules=deduped,
        soft_penalties=soft_penalties,
        alternatives_considered=alternatives_considered[:5],
        planning_horizon={"visible_days": visible_days, "evaluation_days": evaluation_days},
    )

    return {
        "score": round(score, 1),
        "reasons": reasons,
        "culinaryBenefits": culinary_benefits,
        "nutritionBenefits": [
            f"{recipe.practical_metadata.primary_protein_source.replace('_', ' ').title()} protein",
            "Balanced meal"
        ],
        "decision_metadata": metadata.model_dump(),
    }
