from fastapi import APIRouter, Header, HTTPException
from typing import Any
from backend.app.infrastructure.supabase import supabase_client
from backend.app.infrastructure.repositories.meal_entry import MealHistoryRepository
from backend.app.infrastructure.repositories.recipe import RecipeRepository
from backend.app.shopping.service import derive_shopping_from_meal_events

router = APIRouter()
meal_repo = MealHistoryRepository(supabase_client)
recipe_repo = RecipeRepository(supabase_client)


@router.get("/derived")
@router.get("/api/shopping/derived")
def get_derived_shopping(
    start_date: str = "2026-09-07",
    end_date: str = "2026-09-14",
    household_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split("Bearer ", 1)[1].strip()

    if not household_id:
        household_id = supabase_client.bootstrap_household(auth_token=auth_token)

    meals = meal_repo.get_meals_in_range(household_id, start_date, end_date, auth_token=auth_token)
    recipes = recipe_repo.get_recipes(household_id, auth_token=auth_token)

    all_assignments = []
    for m in meals:
        all_assignments.extend(m.assignments)

    items = derive_shopping_from_meal_events(all_assignments, recipes)
    return {
        "success": True,
        "items": items,
        "dateRange": {"startDate": start_date, "endDate": end_date},
    }
