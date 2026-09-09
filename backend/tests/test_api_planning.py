import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


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
    # Notice: Client does NOT pass candidateRecipes!
    payload = {
        "startDate": "2026-09-07",
        "visibleDays": 3,
        "evaluationDays": 5,
    }
    res = client.post("/api/planning/plans", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["plan"]) == 12  # 3 days * 4 slots
    assert data["evaluation_summary"]["total_meals_planned"] == 12

    first_slot = data["plan"][0]
    assert "title" in first_slot
    assert "recipe_id" in first_slot
    assert "explanation" in first_slot
    assert "assignments" in first_slot
    assert len(first_slot["assignments"]) == 4  # 4 family members


def test_api_meal_change_endpoint(client):
    # 1. Missing currentMeal returns 400
    res_bad = client.post("/api/planning/meal-change", json={})
    assert res_bad.status_code == 400

    # 2. Valid meal change request
    payload = {
        "currentMeal": {
            "date": "2026-09-07",
            "slot": "Dinner",
            "title": "Palak Paneer + Roti",
        },
        "reason": "want_lighter",
    }
    res = client.post("/api/planning/meal-change", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["reason_applied"] == "want_lighter"
    assert data["recommendation"] is not None
    assert len(data["alternatives"]) > 0


def test_api_tts_speak(client):
    # 1. Missing or empty text returns 422
    res_bad = client.post("/api/tts/speak", json={"text": ""})
    assert res_bad.status_code == 422

    # 2. Text without provider key returns fallback gracefully
    res = client.post("/api/tts/speak", json={"text": "आज रात्री मूग डाळ खिचडी आणि दही", "language": "mr-IN"})
    assert res.status_code == 200
    data = res.json()
    assert data["fallback"] is True
    assert data["language"] == "mr-IN"
