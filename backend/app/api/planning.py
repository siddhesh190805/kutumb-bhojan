from fastapi import APIRouter, Header, HTTPException, Depends
from typing import Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime, timedelta

from backend.app.domain.models import PlanningResponse, PlanningRequest
from backend.app.domain.errors import DomainError
from backend.app.infrastructure.supabase import supabase_client
from backend.app.infrastructure.repositories.recipe import RecipeRepository
from backend.app.infrastructure.repositories.household import HouseholdRepository
from backend.app.infrastructure.repositories.meal_entry import MealHistoryRepository
from backend.app.infrastructure.repositories.prep_task import PrepTaskRepository
from backend.app.infrastructure.repositories.seasonality import SeasonalityRepository
from backend.app.domain.seasonality import set_seasonality_cache, clear_seasonality_cache
from backend.app.planning.engine import PlanningEngine

router = APIRouter()
planning_engine = PlanningEngine(beam_width=3)
recipe_repo = RecipeRepository(supabase_client)
household_repo = HouseholdRepository(supabase_client)
meal_repo = MealHistoryRepository(supabase_client)
prep_repo = PrepTaskRepository(supabase_client)
seasonality_repo = SeasonalityRepository(supabase_client)


class PlanningPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    start_date: str | None = Field(default=None, alias="startDate")
    visible_days: int = Field(default=7, alias="visibleDays")
    evaluation_days: int = Field(default=30, alias="evaluationDays")
    household_id: str | None = Field(default=None, alias="householdId")
    overrides: dict[str, Any] = Field(default_factory=dict)


@router.post("/plans", response_model=PlanningResponse)
@router.post("/api/planning/plans", response_model=PlanningResponse)
def create_plan(
    payload: PlanningPayload,
    authorization: str | None = Header(default=None),
) -> PlanningResponse:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split("Bearer ", 1)[1].strip()

    # 1. Resolve & verify household authorization
    household_id = payload.household_id
    if not household_id:
        try:
            household_id = supabase_client.bootstrap_household(auth_token=auth_token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to bootstrap household: {str(e)}")
    else:
        if not supabase_client.verify_household_member(household_id, auth_token=auth_token):
            raise HTTPException(status_code=403, detail="Cross-household access denied")

    # 2. Load authoritative canonical domain data from Supabase
    try:
        # Seasonality is canonical from Supabase — load once per request
        try:
            seasonality_rows, is_fallback = seasonality_repo.get_all_seasonality(auth_token=auth_token)
            set_seasonality_cache(seasonality_rows, is_db=not is_fallback)
        except Exception:
            # If DB unavailable, retain existing cache but surface warning
            pass

        recipes = recipe_repo.get_recipes(household_id, auth_token=auth_token)
        if not recipes:
            raise HTTPException(status_code=404, detail="No recipes found in canonical database")

        members = household_repo.get_family_members(household_id, auth_token=auth_token)
        frequency_rules = household_repo.get_frequency_rules(household_id, auth_token=auth_token)
        dietary_rules = household_repo.get_dietary_rules(household_id, auth_token=auth_token)

        start_date_str = payload.start_date or date.today().isoformat()

        # 3. Load recent history for repetition avoidance (past 14 days) — via assignments for member-aware diversity
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
        history_start = (start_dt - timedelta(days=14)).strftime("%Y-%m-%d")
        history_end = (start_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        recent_slots = meal_repo.get_meals_in_range(household_id, history_start, history_end, auth_token=auth_token)

        history_map = {}
        member_history: dict[str, dict[str, Any]] = {}
        for s in recent_slots:
            matched_rec = recipe_repo.get_recipe_by_id(household_id, s.recipe_id, auth_token=auth_token)
            if matched_rec:
                history_map[f"{s.date}-{s.slot}"] = matched_rec
            # Build per-member history from assignments (canonical)
            for assign in s.assignments:
                mid = str(assign.member_id)
                rid = assign.recipe_id or assign.automatic_recipe_id
                if rid:
                    arec = recipe_repo.get_recipe_by_id(household_id, rid, auth_token=auth_token)
                    if arec:
                        member_history.setdefault(mid, {})[f"{s.date}-{s.slot}"] = arec

        # 4. Generate plan using bounded beam search
        result = planning_engine.generate_plan(
            start_date=start_date_str,
            visible_days=payload.visible_days,
            evaluation_days=payload.evaluation_days,
            recipes=recipes,
            members=members,
            dietary_rules=dietary_rules,
            frequency_rules=frequency_rules,
            existing_history=history_map,
            member_histories=member_history if member_history else None,
            overrides=payload.overrides,
        )

        # Surface explicit fallback warning if seasonality used seed not DB
        from backend.app.domain.seasonality import is_seasonality_cache_from_db
        if not is_seasonality_cache_from_db():
            result.warnings.append("Seasonality fallback: using seed catalog (DB unavailable)")

        # 5. Persist the generated plan and prep tasks with reconciliation
        try:
            meal_repo.persist_plan(household_id, result.plan, auth_token=auth_token)
            if result.prep_tasks:
                # Reconcile within visible horizon only
                viz_start = start_date_str
                viz_end = (datetime.strptime(start_date_str, "%Y-%m-%d") + timedelta(days=payload.visible_days - 1)).strftime("%Y-%m-%d")
                # Prep tasks are keyed by task_date (D-1 for soak/ferment, D for batch); expand horizon to capture D-1
                prep_start = (datetime.strptime(viz_start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                prep_repo.reconcile_prep_tasks(household_id, result.prep_tasks, prep_start, viz_end, auth_token=auth_token)
        except Exception as persist_err:
            result.warnings.append(f"Persistence notice: {str(persist_err)}")

        return result

    except HTTPException:
        raise
    except DomainError as de:
        raise HTTPException(status_code=400, detail={"code": de.code, "message": de.message})
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
