import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.app.main import app
from backend.app.domain.canonical import CANONICAL_RECIPES, CANONICAL_FAMILY_MEMBERS


@pytest.fixture
def client():
    return TestClient(app)


AUTH_HEADERS = {"Authorization": "Bearer test_token"}


def test_api_hello(client):
    res = client.get("/api/hello")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["service"] == "kutumb-bhojan-api"
    assert data["backend"] == "fastapi"


def test_api_hello_method_not_allowed(client):
    res = client.post("/api/hello")
    assert res.status_code == 405


def test_api_planning_plans_without_candidate_recipes(client):
    payload = {
        "startDate": "2026-09-07",
        "visibleDays": 3,
        "evaluationDays": 5,
    }
    with patch("backend.app.api.planning.supabase_client.abootstrap_household", return_value="test-household"), \
         patch("backend.app.api.planning.recipe_repo.aget_recipes", return_value=CANONICAL_RECIPES), \
         patch("backend.app.api.planning.household_repo.aget_family_members", return_value=CANONICAL_FAMILY_MEMBERS), \
         patch("backend.app.api.planning.household_repo.aget_frequency_rules", return_value=[]), \
         patch("backend.app.api.planning.household_repo.aget_dietary_rules", return_value=[]), \
         patch("backend.app.api.planning.meal_repo.aget_meals_in_range", return_value=[]), \
         patch("backend.app.api.planning.seasonality_repo.aget_all_seasonality", return_value=([], True)), \
         patch("backend.app.api.planning.meal_repo.apersist_plan", return_value=None), \
         patch("backend.app.api.planning.prep_repo.areconcile_prep_tasks", return_value=(0, 0, 0)):
        res = client.post("/api/planning/plans", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["plan"]) == 12
    assert data["evaluation_summary"]["total_meals_planned"] == 12

    first_slot = data["plan"][0]
    assert "title" in first_slot
    assert "recipe_id" in first_slot
    assert "explanation" in first_slot
    assert "assignments" in first_slot
    assert len(first_slot["assignments"]) == 4


def test_api_meal_change_endpoint(client):
    res_bad = client.post("/api/planning/meal-change", json={})
    assert res_bad.status_code == 400

    payload = {
        "currentMeal": {
            "date": "2026-09-07",
            "slot": "Dinner",
            "title": "Palak Paneer + Roti",
        },
        "reason": "want_lighter",
    }
    with patch("backend.app.api.meal_change.supabase_client.bootstrap_household", return_value="test-household"), \
         patch("backend.app.api.meal_change.recipe_repo.get_recipes", return_value=CANONICAL_RECIPES), \
         patch("backend.app.api.meal_change.recipe_repo.get_recipe_by_id", return_value=None), \
         patch("backend.app.api.meal_change.household_repo.get_family_members", return_value=CANONICAL_FAMILY_MEMBERS), \
         patch("backend.app.api.meal_change.household_repo.get_dietary_rules", return_value=[]):
        res = client.post("/api/planning/meal-change", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["reason_applied"] == "want_lighter"
    assert data["recommendation"] is not None
    assert len(data["alternatives"]) > 0


def test_api_tts_speak(client):
    res_bad = client.post("/api/tts/speak", json={"text": ""})
    assert res_bad.status_code == 422

    with patch("backend.app.api.tts.supabase_client.aget_user_from_token", return_value={"id": "test-user"}):
        res = client.post(
            "/api/tts/speak",
            json={"text": "आज रात्री मूग डाळ खिचडी आणि दही", "language": "mr-IN"},
            headers=AUTH_HEADERS,
        )
    assert res.status_code == 200
    data = res.json()
    assert data["fallback"] is True
    assert data["language"] == "mr-IN"


def test_api_tts_requires_authentication(client):
    res = client.post("/api/tts/speak", json={"text": "test"})
    assert res.status_code == 401
