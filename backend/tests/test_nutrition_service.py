import pytest
from backend.app.domain.models import Recipe, DietaryFlags, PracticalMetadata
from backend.app.nutrition.service import evaluate_meal_balance


def test_meal_balance_reports_qualitative_evidence_without_fake_score():
    r1 = Recipe(
        id="chole",
        name="Chole + Roti + Cabbage-Peas + Apple",
        marathi_name="छोले + पोळी + कोबी-वाटाणा + सफरचंद",
        dietary_flags=DietaryFlags(
            vegetarian=True,
            legumes=True,
            whole_grains=True,
            vegetables=True,
            fruit=True,
        ),
        practical_metadata=PracticalMetadata(
            meal_form="curry_sabji",
            primary_protein_source="legume",
        ),
    )
    res = evaluate_meal_balance([r1])
    assert "score" not in res, "Meal balance must NOT include a pseudo-precise numerical health score"
    assert any(i["key"] == "protein_source" for i in res["indicators"])
    assert any(i["key"] == "vegetable_component" for i in res["indicators"])
    assert any(i["key"] == "whole_grains" for i in res["indicators"])
    assert any(i["key"] == "fruit_coverage" for i in res["indicators"])
    assert res["summary"] == "Good daily variety across food groups"
