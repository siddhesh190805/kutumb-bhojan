import json
from datetime import date
from typing import Any
from backend.app.domain.models import MealPlanSlot, MealAssignment, DecisionMetadata
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class MealHistoryRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client

    def get_meals_in_range(
        self,
        household_id: str,
        start_date: str,
        end_date: str,
        auth_token: str | None = None,
    ) -> list[MealPlanSlot]:
        """Fetch meal entries within a date window."""
        rows = self.client.get(
            "meal_entries",
            {
                "household_id": f"eq.{household_id}",
                "meal_date": f"gte.{start_date}",
                "and": f"(meal_date.lte.{end_date})",
                "order": "meal_date,slot",
            },
            auth_token=auth_token,
        )
        if not rows:
            return []

        # Get meal assignments for these meals
        meal_ids = [str(r["id"]) for r in rows if r.get("id")]
        assignments_by_meal: dict[str, list[MealAssignment]] = {}
        if meal_ids:
            try:
                as_rows = self.client.get(
                    "meal_assignments",
                    {
                        "household_id": f"eq.{household_id}",
                        "meal_entry_id": f"in.({','.join(meal_ids)})",
                    },
                    auth_token=auth_token,
                )
                for a in as_rows:
                    mid = str(a.get("meal_entry_id"))
                    assignments_by_meal.setdefault(mid, []).append(
                        MealAssignment(
                            id=str(a.get("id")),
                            meal_entry_id=mid,
                            member_id=str(a.get("member_id")),
                            recipe_id=str(a["recipe_id"]) if a.get("recipe_id") else None,
                            portion_factor=float(a.get("portion_factor", 1.0)),
                            assignment_source=a.get("assignment_source", "automatic"),
                            automatic_recipe_id=str(a["automatic_recipe_id"]) if a.get("automatic_recipe_id") else None,
                            override_recipe_id=str(a["override_recipe_id"]) if a.get("override_recipe_id") else None,
                            override_reason=a.get("override_reason"),
                        )
                    )
            except Exception:
                pass

        results = []
        for r in rows:
            mid = str(r["id"])
            m_date = str(r.get("meal_date"))
            m_slot = str(r.get("slot"))
            explanation = r.get("decision_metadata") or {}
            results.append(
                MealPlanSlot(
                    id=f"{m_date}-{m_slot}",
                    date=m_date,
                    slot=m_slot,
                    title=r.get("title", ""),
                    marathi_title=r.get("marathi_title") or r.get("title", ""),
                    recipe_id=str(r.get("recipe_id") or ""),
                    status=r.get("status", "Planned"),
                    assignments=assignments_by_meal.get(mid, []),
                    explanation=explanation,
                )
            )
        return results

    def persist_plan(
        self,
        household_id: str,
        plan_slots: list[MealPlanSlot],
        auth_token: str | None = None,
    ) -> None:
        """Upsert meal entries and assignments into Supabase."""
        entries_payload = []
        for slot in plan_slots:
            payload: dict[str, Any] = {
                "household_id": household_id,
                "meal_date": slot.date,
                "slot": slot.slot,
                "title": slot.title,
                "marathi_title": slot.marathi_title,
                "status": slot.status,
            }
            if slot.recipe_id:
                payload["recipe_id"] = slot.recipe_id
            if slot.explanation:
                payload["decision_metadata"] = slot.explanation

            entries_payload.append(payload)

        if entries_payload:
            try:
                res = self.client.post(
                    "meal_entries",
                    entries_payload,
                    auth_token=auth_token,
                    upsert=True,
                    on_conflict="household_id,meal_date,slot",
                )
            except Exception as e:
                # If schema has not yet migrated recipe_id or decision_metadata, retry without them
                if "recipe_id" in str(e) or "decision_metadata" in str(e):
                    for p in entries_payload:
                        p.pop("recipe_id", None)
                        p.pop("decision_metadata", None)
                    self.client.post(
                        "meal_entries",
                        entries_payload,
                        auth_token=auth_token,
                        upsert=True,
                        on_conflict="household_id,meal_date,slot",
                    )
                else:
                    raise
