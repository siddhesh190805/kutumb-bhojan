from fastapi import APIRouter, Header, HTTPException
from typing import Any
from backend.app.infrastructure.supabase import supabase_client
from backend.app.infrastructure.repositories.meal_entry import MealHistoryRepository
from backend.app.infrastructure.repositories.recipe import RecipeRepository
from backend.app.infrastructure.repositories.ingredient import IngredientRepository
from backend.app.shopping.service import derive_shopping_from_meal_events

router = APIRouter()
meal_repo = MealHistoryRepository(supabase_client)
recipe_repo = RecipeRepository(supabase_client)
ingredient_repo = IngredientRepository(supabase_client)


def require_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return token


@router.get("/derived")
@router.get("/api/shopping/derived")
def get_derived_shopping(
    start_date: str = "2026-09-07",
    end_date: str = "2026-09-14",
    household_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    auth_token = require_bearer_token(authorization)

    if not household_id:
        try:
            household_id = supabase_client.bootstrap_household(auth_token=auth_token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to bootstrap household: {str(e)}")
    else:
        if not supabase_client.verify_household_member(household_id, auth_token=auth_token):
            raise HTTPException(status_code=403, detail="Cross-household access denied")

    meals = meal_repo.get_meals_in_range(household_id, start_date, end_date, auth_token=auth_token)
    recipes = recipe_repo.get_recipes(household_id, auth_token=auth_token)
    try:
        catalog = ingredient_repo.get_ingredients(auth_token=auth_token)
    except Exception:
        catalog = []

    all_assignments = []
    for m in meals:
        all_assignments.extend(m.assignments)

    items = derive_shopping_from_meal_events(all_assignments, recipes, catalog=catalog)
    return {
        "success": True,
        "items": items,
        "dateRange": {"startDate": start_date, "endDate": end_date},
    }
