from typing import Any
from backend.app.domain.models import Recipe, MealPlanSlot


def evaluate_meal_balance(recipes: list[Recipe]) -> dict[str, Any]:
    """
    Evaluate evidence-based meal balance without pseudo-precise numerical scores.
    Returns qualitative indicators and bilingual educational explanations.
    """
    has_protein = any(
        r.dietary_flags.contains_egg or r.dietary_flags.legumes or r.practical_metadata.primary_protein_source != "none"
        for r in recipes
    )
    has_whole_grain = any(r.dietary_flags.whole_grains for r in recipes)
    has_vegetables = any(r.dietary_flags.vegetables for r in recipes)
    has_fruit = any(r.dietary_flags.fruit for r in recipes)

    meal_forms = set(r.practical_metadata.meal_form for r in recipes)

    indicators: list[dict[str, Any]] = []

    if has_protein:
        indicators.append({
            "key": "protein_source",
            "present": True,
            "label": "Legume or protein source present",
            "marathi_label": "कडधान्य किंवा प्रथिने घटक समाविष्ट",
        })

    if has_whole_grain:
        indicators.append({
            "key": "whole_grains",
            "present": True,
            "label": "Whole-grain or millet representation present",
            "marathi_label": "पूर्ण धान्य किंवा भरडधान्य समाविष्ट",
        })

    if has_vegetables:
        indicators.append({
            "key": "vegetable_component",
            "present": True,
            "label": "Vegetable coverage present",
            "marathi_label": "भाजीपाल्याची उपस्थिती",
        })

    if has_fruit:
        indicators.append({
            "key": "fruit_coverage",
            "present": True,
            "label": "Fruit coverage present",
            "marathi_label": "फळांचा समावेश",
        })

    summary_text = "Good daily variety across food groups" if len(indicators) >= 3 else "Moderate food group representation"
    summary_mr = "अन्न घटकांमध्ये विविधता चांगली आहे" if len(indicators) >= 3 else "अन्न घटकांचे मध्यम प्रमाण"

    return {
        "indicators": indicators,
        "summary": summary_text,
        "marathiSummary": summary_mr,
        "distinctMealForms": len(meal_forms),
    }
