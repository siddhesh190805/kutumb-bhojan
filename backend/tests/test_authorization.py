import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.app.main import app
from backend.app.infrastructure.supabase import supabase_client


@pytest.fixture
def client():
    return TestClient(app)


def test_cross_household_access_denied_on_planning(client):
    # When an unauthorized household_id is provided, request should be rejected with 403
    with patch.object(supabase_client, "verify_household_member", return_value=False):
        payload = {
            "startDate": "2026-09-07",
            "visibleDays": 3,
            "evaluationDays": 5,
            "householdId": "00000000-0000-0000-0000-000000000099"
        }
        res = client.post(
            "/api/planning/plans",
            json=payload,
            headers={"Authorization": "Bearer fake_alien_token"}
        )
        assert res.status_code == 403
        assert "Cross-household access denied" in res.json()["detail"]


def test_cross_household_access_denied_on_meal_change(client):
    with patch.object(supabase_client, "verify_household_member", return_value=False):
        payload = {
            "currentMeal": {
                "date": "2026-09-07",
                "slot": "Dinner",
                "title": "Palak Paneer",
            },
            "reason": "want_lighter",
            "householdId": "00000000-0000-0000-0000-000000000099"
        }
        res = client.post(
            "/api/planning/meal-change",
            json=payload,
            headers={"Authorization": "Bearer fake_alien_token"}
        )
        assert res.status_code == 403
        assert "Cross-household access denied" in res.json()["detail"]


def test_cross_household_access_denied_on_shopping(client):
    with patch.object(supabase_client, "verify_household_member", return_value=False):
        res = client.get(
            "/api/shopping/derived?household_id=00000000-0000-0000-0000-000000000099",
            headers={"Authorization": "Bearer fake_alien_token"}
        )
        assert res.status_code == 403
        assert "Cross-household access denied" in res.json()["detail"]


def test_authorized_household_access_allowed_on_shopping(client):
    from backend.app.api.shopping import meal_repo, recipe_repo
    with patch.object(supabase_client, "verify_household_member", return_value=True), \
         patch.object(meal_repo, "get_meals_in_range", return_value=[]), \
         patch.object(recipe_repo, "get_recipes", return_value=[]):
        res = client.get(
            "/api/shopping/derived?household_id=336ed23c-e204-4a08-9325-74a6bfca1a8c",
            headers={"Authorization": "Bearer mocked_token"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "items" in data
