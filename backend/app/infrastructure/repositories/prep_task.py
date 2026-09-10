"""
Prep Task Repository for persisting and retrieving household advance preparation tasks.
"""

from typing import Any
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class PrepTaskRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client

    def get_prep_tasks(
        self,
        household_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
        auth_token: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"household_id": f"eq.{household_id}"}
        if start_date:
            params["task_date"] = f"gte.{start_date}"
        if end_date:
            params["and"] = f"(task_date.lte.{end_date})"
        params["order"] = "task_date,task_key"

        try:
            return self.client.get("prep_tasks", params, auth_token=auth_token)
        except Exception:
            return []

    def persist_prep_tasks(
        self,
        household_id: str,
        tasks: list[dict[str, Any]],
        auth_token: str | None = None,
    ) -> None:
        """Upsert prep tasks into Supabase."""
        if not tasks:
            return

        payloads = []
        for t in tasks:
            payloads.append({
                "household_id": household_id,
                "task_key": t.get("id") or t.get("task_key"),
                "task": t.get("task"),
                "marathi_task": t.get("mr") or t.get("marathi_task") or t.get("task"),
                "task_date": t.get("date") or t.get("task_date"),
                "done": t.get("done", False),
                "category": t.get("area") or t.get("category", "evening_prep"),
                "notes": t.get("notes"),
            })

        try:
            self.client.post(
                "prep_tasks",
                payloads,
                auth_token=auth_token,
                upsert=True,
                on_conflict="household_id,task_key",
            )
        except Exception:
            # Non-blocking fallback if prep_tasks table is not yet migrated
            pass
