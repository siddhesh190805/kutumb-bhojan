from fastapi import APIRouter, Header, HTTPException
from typing import Any
from pydantic import BaseModel, Field, ConfigDict

from backend.app.domain.models import MealChangeResponse, CurrentMealContext
from backend.app.domain.errors import DomainError
from backend.app.infrastructure.supabase import supabase_client
from backend.app.infrastructure.repositories.recipe import RecipeRepository
from backend.app.infrastructure.repositories.household import HouseholdRepository
from backend.app.infrastructure.repositories.meal_entry import MealHistoryRepository
from backend.app.planning.engine import PlanningEngine

router = APIRouter()
planning_engine = PlanningEngine(beam_width=3)
recipe_repo = RecipeRepository(supabase_client)
household_repo = HouseholdRepository(supabase_client)
meal_repo = MealHistoryRepository(supabase_client)


class MealChangePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_meal: dict[str, Any] | None = Field(default=None, alias="currentMeal")
    reason: str = "not_in_mood"
    household_id: str | None = Field(default=None, alias="householdId")
    unavailable_ingredient: str | None = Field(default=None, alias="unavailableIngredient")
    unavailable_ingredients: list[str] = Field(default_factory=list, alias="unavailableIngredients")
    custom_constraint: str | None = Field(default=None, alias="customConstraint")


@router.post("/meal-change", response_model=MealChangeResponse)
@router.post("/api/planning/meal-change", response_model=MealChangeResponse)
def change_meal(
    payload: MealChangePayload,
    authorization: str | None = Header(default=None),
) -> MealChangeResponse:
    if not payload.current_meal:
        raise HTTPException(status_code=400, detail="currentMeal is required")

    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split("Bearer ", 1)[1].strip()

    household_id = payload.household_id
    if not household_id:
        try:
            household_id = supabase_client.bootstrap_household(auth_token=auth_token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to bootstrap household: {str(e)}")
    else:
        if not supabase_client.verify_household_member(household_id, auth_token=auth_token):
            raise HTTPException(status_code=403, detail="Cross-household access denied")

    try:
        catalog = recipe_repo.get_recipes(household_id, auth_token=auth_token)
        members = household_repo.get_family_members(household_id, auth_token=auth_token)
        dietary_rules = household_repo.get_dietary_rules(household_id, auth_token=auth_token)

        # Parse current_meal context
        cm = payload.current_meal
        target_date = cm.get("date") or cm.get("meal_date") or ""
        slot = cm.get("slot") or "Dinner"
        recipe_id = cm.get("recipeId") or cm.get("recipe_id") or ""
        title = cm.get("title") or ""

        current_recipe = None
        if recipe_id:
            current_recipe = recipe_repo.get_recipe_by_id(household_id, recipe_id, auth_token=auth_token)
        if not current_recipe and title:
            for r in catalog:
                if r.name.lower() == title.lower() or r.marathi_name == title:
                    current_recipe = r
                    break

        context = CurrentMealContext(
            date=target_date,
            slot=slot,
            recipe_id=recipe_id,
            title=title,
            recipe=current_recipe,
        )

        unavail = list(payload.unavailable_ingredients)
        if payload.unavailable_ingredient:
            unavail.append(payload.unavailable_ingredient)

        result = planning_engine.propose_meal_change(
            current_meal=context,
            reason=payload.reason,
            catalog=catalog,
            members=members,
            dietary_rules=dietary_rules,
            unavailable_ingredients=unavail,
            custom_constraint=payload.custom_constraint,
        )
        return result

    except HTTPException:
        raise
    except DomainError as de:
        raise HTTPException(status_code=400, detail={"code": de.code, "message": de.message})
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
