import asyncio
import httpx
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
async def create_plan(
    payload: PlanningPayload,
    authorization: str | None = Header(default=None),
) -> PlanningResponse:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split("Bearer ", 1)[1].strip()

    # One request-scoped AsyncClient with pooling (max 10, keepalive 5, timeout 15s per invariant)
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        http2=False,
    ) as http_client:
        # 1. Resolve & verify household authorization (sequential dependency)
        household_id = payload.household_id
        if not household_id:
            try:
                household_id = await supabase_client.abootstrap_household(auth_token=auth_token, http_client=http_client)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to bootstrap household: {str(e)}")
        else:
            if not await supabase_client.averify_household_member(household_id, auth_token=auth_token, http_client=http_client):
                raise HTTPException(status_code=403, detail="Cross-household access denied")

        # 2. Load authoritative canonical domain data concurrently (bounded 5)
        try:
            # Parallel independent reads after household_id resolved
            sem = asyncio.Semaphore(5)

            async def with_sem(coro):
                async with sem:
                    return await coro

            # Create tasks for independent branches
            seasonality_task = with_sem(seasonality_repo.aget_all_seasonality(auth_token=auth_token, http_client=http_client))
            recipes_task = with_sem(recipe_repo.aget_recipes(household_id, auth_token=auth_token, http_client=http_client))
            members_task = with_sem(household_repo.aget_family_members(household_id, auth_token=auth_token, http_client=http_client))
            frequency_task = with_sem(household_repo.aget_frequency_rules(household_id, auth_token=auth_token, http_client=http_client))
            dietary_task = with_sem(household_repo.aget_dietary_rules(household_id, auth_token=auth_token, http_client=http_client))

            # Meal history depends on dates, create after computing start_date_str
            start_date_str = payload.start_date or date.today().isoformat()
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            history_start = (start_dt - timedelta(days=14)).strftime("%Y-%m-%d")
            history_end = (start_dt - timedelta(days=1)).strftime("%Y-%m-%d")
            history_task = with_sem(meal_repo.aget_meals_in_range(household_id, history_start, history_end, auth_token=auth_token, http_client=http_client))

            # Gather all independent reads
            seasonality_res, recipes, members, frequency_rules, dietary_rules, recent_slots = await asyncio.gather(
                seasonality_task, recipes_task, members_task, frequency_task, dietary_task, history_task
            )

            # Handle seasonality cache and warning
            try:
                seasonality_rows, is_fallback = seasonality_res
                set_seasonality_cache(seasonality_rows, is_db=not is_fallback)
            except Exception:
                pass

            if not recipes:
                raise HTTPException(status_code=404, detail="No recipes found in canonical database")

            # Deterministic normalization
            recipes = sorted(recipes, key=lambda r: str(r.id))
            recent_slots = sorted(recent_slots, key=lambda s: (s.date, s.slot))

            # O(1) catalog_by_id for history enrichment (deterministic, no DB)
            catalog_by_id: dict[str, Any] = {}
            for r in recipes:
                catalog_by_id[str(r.id)] = r
                if getattr(r, "recipe_key", None):
                    catalog_by_id[str(r.recipe_key)] = r

            def lookup_recipe(rid: str | None):
                if not rid:
                    return None
                # Direct id, then try lower, then fallback to linear for name (rare)
                rec = catalog_by_id.get(str(rid))
                if rec:
                    return rec
                # Preserve missing-recipe handling: try name lower
                low = str(rid).lower()
                for r in recipes:
                    if r.name.lower() == low:
                        return r
                return None

            history_map = {}
            member_history: dict[str, dict[str, Any]] = {}
            for s in recent_slots:
                matched_rec = lookup_recipe(s.recipe_id)
                if matched_rec:
                    history_map[f"{s.date}-{s.slot}"] = matched_rec
                for assign in s.assignments:
                    mid = str(assign.member_id)
                    rid = assign.recipe_id or assign.automatic_recipe_id
                    arec = lookup_recipe(rid)
                    if arec:
                        member_history.setdefault(mid, {})[f"{s.date}-{s.slot}"] = arec

            # 4. Generate plan (CPU, no I/O)
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

            from backend.app.domain.seasonality import is_seasonality_cache_from_db
            if not is_seasonality_cache_from_db():
                result.warnings.append("Seasonality fallback: using seed catalog (DB unavailable)")

            # 5. Persist (must remain on correctness path, same http_client)
            try:
                await meal_repo.apersist_plan(household_id, result.plan, auth_token=auth_token, http_client=http_client)
                if result.prep_tasks:
                    viz_start = start_date_str
                    viz_end = (datetime.strptime(start_date_str, "%Y-%m-%d") + timedelta(days=payload.visible_days - 1)).strftime("%Y-%m-%d")
                    prep_start = (datetime.strptime(viz_start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                    await prep_repo.areconcile_prep_tasks(household_id, result.prep_tasks, prep_start, viz_end, auth_token=auth_token, http_client=http_client)
                    # Surface compat warning if source column missing (current prod schema)
                    compat_warn = getattr(prep_repo, "_last_compat_warning", None)
                    if compat_warn:
                        result.warnings.append(compat_warn)
            except Exception as persist_err:
                result.warnings.append(f"Persistence notice: {str(persist_err)}")

            result.recipes = recipes
            result.members = members
            return result

        except HTTPException:
            raise
        except DomainError as de:
            raise HTTPException(status_code=400, detail={"code": de.code, "message": de.message})
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))
