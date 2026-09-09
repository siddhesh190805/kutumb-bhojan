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

    metadata = DecisionMetadata(
        planner_version="fastapi-beam-v1",
        selected_because=reasons,
        applied_rules=["monthly_paneer_limit", "slot_compatibility", "member_dietary_eligibility"],
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
