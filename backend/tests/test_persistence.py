import pytest
from backend.app.domain.models import MealPlanSlot, Recipe, DecisionMetadata
from backend.app.infrastructure.repositories.meal_entry import MealHistoryRepository


def test_decision_metadata_survives_persistence_format():
    slot = MealPlanSlot(
        id="2026-09-07-Dinner",
        date="2026-09-07",
        slot="Dinner",
        title="Vegetable Moong Khichdi + Curd",
        marathi_title="भाजी मूग खिचडी + दही",
        recipe_id="khichdi-001",
        explanation={
            "score": 135.0,
            "reasons": ["Light dinner follows substantial lunch", "Quick preparation (~20 min)"],
            "culinaryBenefits": ["Digestive ease with lighter evening meal"],
            "decision_metadata": {
                "planner_version": "fastapi-beam-v1",
                "selected_because": ["Light dinner follows substantial lunch"],
                "applied_rules": ["monthly_paneer_limit", "slot_compatibility"],
                "soft_penalties": [],
                "alternatives_considered": ["Chole Masala", "Paneer Bhurji"],
                "planning_horizon": {"visible_days": 7, "evaluation_days": 30},
            },
        },
    )

    # Simulate database roundtrip
    saved_row = {
        "id": "uuid-meal-1",
        "household_id": "hh-001",
        "meal_date": slot.date,
        "slot": slot.slot,
        "title": slot.title,
        "marathi_title": slot.marathi_title,
        "status": slot.status,
        "recipe_id": slot.recipe_id,
        "decision_metadata": slot.explanation,
    }

    class MockClient:
        def get(self, *args, **kwargs):
            return [saved_row]

    repo = MealHistoryRepository(MockClient())
    loaded_slots = repo.get_meals_in_range("hh-001", "2026-09-07", "2026-09-07")
    assert len(loaded_slots) == 1
    loaded = loaded_slots[0]

    assert loaded.recipe_id == "khichdi-001"
    assert loaded.title == "Vegetable Moong Khichdi + Curd"
    assert loaded.explanation["score"] == 135.0
    assert loaded.explanation["decision_metadata"]["planner_version"] == "fastapi-beam-v1"
    assert loaded.explanation["decision_metadata"]["planning_horizon"]["evaluation_days"] == 30
    assert "Light dinner follows substantial lunch" in loaded.explanation["decision_metadata"]["selected_because"]
