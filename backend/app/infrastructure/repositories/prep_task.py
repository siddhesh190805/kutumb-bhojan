"""
Prep Task Repository for persisting and retrieving household advance preparation tasks.
"""

from typing import Any
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class PrepTaskRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client

    async def aget_prep_tasks(
        self,
        household_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
        auth_token: str | None = None,
        http_client=None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"household_id": f"eq.{household_id}"}
        if start_date:
            params["task_date"] = f"gte.{start_date}"
        if end_date:
            params["and"] = f"(task_date.lte.{end_date})"
        params["order"] = "task_date,task_key"
        try:
            return await self.client.aget("prep_tasks", params, auth_token=auth_token, http_client=http_client)
        except Exception:
            return []

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

    async def areconcile_prep_tasks(
        self,
        household_id: str,
        desired_tasks: list[dict[str, Any]],
        start_date: str,
        end_date: str,
        auth_token: str | None = None,
        http_client=None,
    ) -> tuple[int, int, int]:
        if not desired_tasks:
            return 0, 0, 0
        existing = await self.aget_prep_tasks(household_id, start_date, end_date, auth_token=auth_token, http_client=http_client)
        def is_planner_owned(row: dict[str, Any]) -> bool:
            src = row.get("source")
            if src == "planner":
                return True
            if src is None:
                tk = str(row.get("task_key", ""))
                return tk.startswith("soak-") or tk.startswith("ferment-") or tk.startswith("batch-")
            return False
        existing_by_key: dict[str, dict[str, Any]] = {str(r.get("task_key")): r for r in existing}
        desired_keys = {str(t.get("id") or t.get("task_key")) for t in desired_tasks}
        payloads = []
        preserved = 0
        for t in desired_tasks:
            tkey = str(t.get("id") or t.get("task_key"))
            existing_row = existing_by_key.get(tkey)
            done_val = bool(t.get("done", False))
            if existing_row and bool(existing_row.get("done")):
                done_val = True
                preserved += 1
            payloads.append({
                "household_id": household_id,
                "task_key": tkey,
                "task": t.get("task"),
                "marathi_task": t.get("mr") or t.get("marathi_task") or t.get("task"),
                "task_date": t.get("date") or t.get("task_date"),
                "done": done_val,
                "category": t.get("area") or t.get("category", "evening_prep"),
                "notes": t.get("notes"),
                "source": "planner",
            })
        if payloads:
            try:
                await self.client.apost(
                    "prep_tasks",
                    payloads,
                    auth_token=auth_token,
                    upsert=True,
                    on_conflict="household_id,task_key",
                    http_client=http_client,
                )
            except Exception:
                pass
        deleted = 0
        for ekey, erow in existing_by_key.items():
            if ekey not in desired_keys and is_planner_owned(erow) and not bool(erow.get("done")):
                try:
                    await self.client.adelete_by_key(
                        "prep_tasks",
                        {"household_id": f"eq.{household_id}", "task_key": f"eq.{ekey}"},
                        auth_token=auth_token,
                        http_client=http_client,
                    )
                    deleted += 1
                except Exception:
                    pass
        return len(payloads), preserved, deleted

    def reconcile_prep_tasks(
        self,
        household_id: str,
        desired_tasks: list[dict[str, Any]],
        start_date: str,
        end_date: str,
        auth_token: str | None = None,
    ) -> tuple[int, int, int]:
        """
        Idempotent reconciliation for planner-generated tasks.
        Preserves done=True, reconciles obsolete uncompleted planner tasks,
        leaves manual tasks and completed tasks intact.
        Returns (upserted, preserved_done, deleted).
        """
        if not desired_tasks:
            return 0, 0, 0

        # Fetch existing in horizon
        existing = self.get_prep_tasks(household_id, start_date, end_date, auth_token=auth_token)
        # Determine ownership: planner-owned if source == 'planner' or (fallback) task_key starts with soak-/ferment-/batch- and source missing
        def is_planner_owned(row: dict[str, Any]) -> bool:
            src = row.get("source")
            if src == "planner":
                return True
            if src is None:
                tk = str(row.get("task_key", ""))
                return tk.startswith("soak-") or tk.startswith("ferment-") or tk.startswith("batch-")
            return False

        existing_by_key: dict[str, dict[str, Any]] = {str(r.get("task_key")): r for r in existing}
        desired_keys = {str(t.get("id") or t.get("task_key")) for t in desired_tasks}

        # Build upsert payloads preserving done=True
        payloads = []
        preserved = 0
        for t in desired_tasks:
            tkey = str(t.get("id") or t.get("task_key"))
            existing_row = existing_by_key.get(tkey)
            done_val = bool(t.get("done", False))
            if existing_row and bool(existing_row.get("done")):
                done_val = True
                preserved += 1
            payloads.append({
                "household_id": household_id,
                "task_key": tkey,
                "task": t.get("task"),
                "marathi_task": t.get("mr") or t.get("marathi_task") or t.get("task"),
                "task_date": t.get("date") or t.get("task_date"),
                "done": done_val,
                "category": t.get("area") or t.get("category", "evening_prep"),
                "notes": t.get("notes"),
                "source": "planner",
            })

        if payloads:
            try:
                self.client.post(
                    "prep_tasks",
                    payloads,
                    auth_token=auth_token,
                    upsert=True,
                    on_conflict="household_id,task_key",
                )
            except Exception:
                pass

        # Reconcile obsolete planner-owned uncompleted tasks
        deleted = 0
        for ekey, erow in existing_by_key.items():
            if ekey not in desired_keys and is_planner_owned(erow) and not bool(erow.get("done")):
                # Task was planner-generated, uncompleted, and no longer desired → delete
                try:
                    self.client.delete_by_key(
                        "prep_tasks",
                        {"household_id": f"eq.{household_id}", "task_key": f"eq.{ekey}"},
                        auth_token=auth_token,
                    )
                    deleted += 1
                except Exception:
                    pass

        return len(payloads), preserved, deleted

    def persist_prep_tasks(
        self,
        household_id: str,
        tasks: list[dict[str, Any]],
        auth_token: str | None = None,
    ) -> None:
        """Legacy upsert without reconciliation — now delegates to reconcile with horizon awareness."""
        if not tasks:
            return
        # Infer horizon from task dates for backward compatibility
        dates = [str(t.get("date") or t.get("task_date")) for t in tasks if t.get("date") or t.get("task_date")]
        if dates:
            start = min(dates)
            end = max(dates)
            self.reconcile_prep_tasks(household_id, tasks, start, end, auth_token=auth_token)
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
                "source": "planner",
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
            pass
