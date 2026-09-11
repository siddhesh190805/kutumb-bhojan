"""
NFDI-001C-CORRECTION-001 Prep lifecycle regression tests (Cases A-F).
"""
import pytest
from backend.app.domain.models import Recipe, MealPlanSlot, PracticalMetadata, DerivedRecipeFoodProfile
from backend.app.planning.prep import generate_household_prep_tasks
from backend.app.infrastructure.repositories.prep_task import PrepTaskRepository


def _make_recipe(rid: str, name: str, soaking: str = "overnight", ferment: str = "none") -> Recipe:
    return Recipe(
        id=rid,
        name=name,
        marathi_name=name + " मराठी",
        course="Lunch/Dinner",
        soaking_requirement=soaking,
        fermentation_requirement=ferment,
        practical_metadata=PracticalMetadata(soaking_required=soaking == "overnight", fermentation_required=ferment == "overnight", meal_form="curry_sabji", primary_grain="wheat", time_minutes=30),
        food_profile=DerivedRecipeFoodProfile(legume_identities=frozenset({"chana"})),
    )


def test_prep_case_a_generate_one_task():
    r = _make_recipe("r1", "Chole")
    slot = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=r.name, marathi_title=r.marathi_name, recipe_id=r.id, recipe=r)
    tasks = generate_household_prep_tasks([slot])
    assert len(tasks) == 1
    assert tasks[0].id.startswith("soak-")


def test_prep_case_b_done_preserved_on_replan():
    """Case B: done=True must survive replanning via reconcile."""
    r = _make_recipe("r1", "Chole")
    slot = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=r.name, marathi_title=r.marathi_name, recipe_id=r.id, recipe=r)
    tasks = generate_household_prep_tasks([slot])
    payload = [t.model_dump() for t in tasks]

    # Mock client that stores tasks and preserves done logic
    class MockClient:
        def __init__(self):
            self.rows = []
            # Pre-populate with done=True for the task
            self.rows.append({"household_id": "hh1", "task_key": payload[0]["id"], "task": "old", "marathi_task": "old", "task_date": "2026-09-11", "done": True, "category": "evening_prep", "source": "planner"})

        def get(self, table, params, auth_token=None):
            if table == "prep_tasks":
                return self.rows
            return []

        def post(self, table, data, auth_token=None, upsert=False, on_conflict=None):
            for d in data:
                # Upsert logic: preserve done if existing was true
                for row in self.rows:
                    if row["task_key"] == d["task_key"]:
                        # If caller preserved done, respect it; our repo already does
                        row.update(d)
                        break
                else:
                    self.rows.append(dict(d))
            return data

        def delete_by_key(self, table, params, auth_token=None):
            tk = params["task_key"].replace("eq.", "")
            self.rows = [r for r in self.rows if r["task_key"] != tk]

    client = MockClient()
    repo = PrepTaskRepository(client)
    upserted, preserved, deleted = repo.reconcile_prep_tasks("hh1", payload, "2026-09-11", "2026-09-12")
    assert preserved == 1
    assert any(r["done"] is True for r in client.rows if r["task_key"] == payload[0]["id"])


def test_prep_case_c_obsolete_uncompleted_reconciled():
    """Case C: Recipe A -> B, obsolete uncompleted task deleted."""
    rA = _make_recipe("rA", "Chole")
    slotA = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=rA.name, marathi_title=rA.marathi_name, recipe_id=rA.id, recipe=rA)
    tasksA = generate_household_prep_tasks([slotA])
    payloadA = [t.model_dump() for t in tasksA]

    rB = _make_recipe("rB", "Rajma")
    slotB = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=rB.name, marathi_title=rB.marathi_name, recipe_id=rB.id, recipe=rB)
    tasksB = generate_household_prep_tasks([slotB])
    payloadB = [t.model_dump() for t in tasksB]

    # Existing is A uncompleted
    class MockClient:
        def __init__(self):
            self.rows = [{"household_id": "hh1", "task_key": payloadA[0]["id"], "task": "x", "marathi_task": "x", "task_date": "2026-09-11", "done": False, "category": "evening_prep", "source": "planner"}]

        def get(self, table, params, auth_token=None):
            return list(self.rows)

        def post(self, table, data, auth_token=None, upsert=False, on_conflict=None):
            for d in data:
                if not any(r["task_key"] == d["task_key"] for r in self.rows):
                    self.rows.append(dict(d))
                else:
                    for r in self.rows:
                        if r["task_key"] == d["task_key"]:
                            r.update(d)
            return data

        def delete_by_key(self, table, params, auth_token=None):
            tk = params["task_key"].replace("eq.", "")
            self.rows = [r for r in self.rows if r["task_key"] != tk]

    client = MockClient()
    repo = PrepTaskRepository(client)
    repo.reconcile_prep_tasks("hh1", payloadB, "2026-09-11", "2026-09-12")
    keys = {r["task_key"] for r in client.rows}
    assert payloadA[0]["id"] not in keys, "obsolete uncompleted task should be deleted"
    assert payloadB[0]["id"] in keys


def test_prep_case_d_completed_preserved_despite_plan_change():
    """Case D: completed historical task not destroyed when plan changes."""
    rA = _make_recipe("rA", "Chole")
    slotA = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=rA.name, marathi_title=rA.marathi_name, recipe_id=rA.id, recipe=rA)
    tasksA = generate_household_prep_tasks([slotA])
    payloadA = [t.model_dump() for t in tasksA]

    rB = _make_recipe("rB", "Rajma")
    slotB = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=rB.name, marathi_title=rB.marathi_name, recipe_id=rB.id, recipe=rB)
    tasksB = generate_household_prep_tasks([slotB])
    payloadB = [t.model_dump() for t in tasksB]

    class MockClient:
        def __init__(self):
            self.rows = [{"household_id": "hh1", "task_key": payloadA[0]["id"], "task": "x", "marathi_task": "x", "task_date": "2026-09-11", "done": True, "category": "evening_prep", "source": "planner"}]

        def get(self, table, params, auth_token=None):
            return list(self.rows)

        def post(self, table, data, auth_token=None, upsert=False, on_conflict=None):
            for d in data:
                if not any(r["task_key"] == d["task_key"] for r in self.rows):
                    self.rows.append(dict(d))
            return data

        def delete_by_key(self, table, params, auth_token=None):
            tk = params["task_key"].replace("eq.", "")
            self.rows = [r for r in self.rows if r["task_key"] != tk]

    client = MockClient()
    repo = PrepTaskRepository(client)
    repo.reconcile_prep_tasks("hh1", payloadB, "2026-09-11", "2026-09-12")
    keys = {r["task_key"] for r in client.rows}
    assert payloadA[0]["id"] in keys, "completed task must not be deleted"


def test_prep_case_e_manual_untouched():
    """Case E: manual task never deleted."""
    r = _make_recipe("r1", "Chole")
    slot = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=r.name, marathi_title=r.marathi_name, recipe_id=r.id, recipe=r)
    tasks = generate_household_prep_tasks([slot])
    payload = [t.model_dump() for t in tasks]

    class MockClient:
        def __init__(self):
            self.rows = [
                {"household_id": "hh1", "task_key": "manual-1", "task": "manual", "marathi_task": "manual", "task_date": "2026-09-11", "done": False, "category": "evening_prep", "source": "manual"},
                {"household_id": "hh1", "task_key": payload[0]["id"], "task": "old", "marathi_task": "old", "task_date": "2026-09-11", "done": False, "category": "evening_prep", "source": "planner"},
            ]

        def get(self, table, params, auth_token=None):
            return list(self.rows)

        def post(self, table, data, auth_token=None, upsert=False, on_conflict=None):
            for d in data:
                for r in self.rows:
                    if r["task_key"] == d["task_key"]:
                        r.update(d)
                        break
                else:
                    self.rows.append(dict(d))
            return data

        def delete_by_key(self, table, params, auth_token=None):
            tk = params["task_key"].replace("eq.", "")
            self.rows = [r for r in self.rows if r["task_key"] != tk]

    client = MockClient()
    repo = PrepTaskRepository(client)
    # Replan with empty desired (simulate no soak needed) — use different recipe without soak? Instead reuse same but test that manual stays
    # Empty desired would not trigger delete path for manual (since desired empty early return)
    # To trigger reconciliation, pass empty? Actually we pass payload which doesn't contain manual
    repo.reconcile_prep_tasks("hh1", payload, "2026-09-11", "2026-09-12")
    keys = {r["task_key"] for r in client.rows}
    assert "manual-1" in keys


def test_prep_case_f_idempotent_no_duplicates():
    r = _make_recipe("r1", "Chole")
    slot = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=r.name, marathi_title=r.marathi_name, recipe_id=r.id, recipe=r)
    tasks = generate_household_prep_tasks([slot, slot])  # duplicate slot
    assert len(tasks) == 1, "same plan repeated must not duplicate tasks"

    # Also test task_key includes slot now
    assert "lunch" in tasks[0].id.lower()


def test_prep_marathi_slot_translation():
    r = _make_recipe("r1", "Chole")
    for slot_name, expected_mr in [("Breakfast", "नाश्ता"), ("Lunch", "दुपारचे जेवण"), ("Dinner", "रात्रीचे जेवण"), ("Snack", "अल्पोपहार")]:
        slot = MealPlanSlot(id=f"2026-09-12-{slot_name}", date="2026-09-12", slot=slot_name, title=r.name, marathi_title=r.marathi_name, recipe_id=r.id, recipe=r)
        tasks = generate_household_prep_tasks([slot])
        assert len(tasks) == 1
        assert expected_mr in tasks[0].mr, f"Marathi for {slot_name} should be {expected_mr}, got {tasks[0].mr}"
        assert "None" not in tasks[0].mr


def test_prep_marathi_never_none_when_recipe_marathi_missing():
    r = Recipe(id="r1", name="Test Recipe", marathi_name="", course="Lunch/Dinner", soaking_requirement="overnight", practical_metadata=PracticalMetadata(soaking_required=True))
    r.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"moong"}))
    slot = MealPlanSlot(id="2026-09-12-Lunch", date="2026-09-12", slot="Lunch", title=r.name, marathi_title="", recipe_id=r.id, recipe=r)
    tasks = generate_household_prep_tasks([slot])
    assert tasks[0].mr
    assert "None" not in tasks[0].mr
    assert "Test Recipe" in tasks[0].mr  # fallback to English


def test_batch_prep_gated_by_future_use():
    # Weekend recipe with no future use should NOT generate batch task
    r_weekend = Recipe(id="r1", name="Bhindi", marathi_name="भेंडी", course="Lunch/Dinner", batch_prep_suitability="high", practical_metadata=PracticalMetadata(meal_form="curry_sabji", primary_grain="wheat", time_minutes=30))
    r_weekend.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"chana"}))
    slot_sat = MealPlanSlot(id="2026-09-13-Lunch", date="2026-09-13", slot="Lunch", title=r_weekend.name, marathi_title=r_weekend.marathi_name, recipe_id=r_weekend.id, recipe=r_weekend)  # Saturday
    # Weekday unrelated recipe
    r_weekday = Recipe(id="r2", name="Khichdi", marathi_name="खिचडी", course="Lunch/Dinner", batch_prep_suitability="none", practical_metadata=PracticalMetadata(meal_form="khichdi", primary_grain="rice", time_minutes=20))
    r_weekday.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"moong"}))
    slot_mon = MealPlanSlot(id="2026-09-15-Lunch", date="2026-09-15", slot="Lunch", title=r_weekday.name, marathi_title=r_weekday.marathi_name, recipe_id=r_weekday.id, recipe=r_weekday)
    tasks = generate_household_prep_tasks([slot_sat, slot_mon])
    batch_tasks = [t for t in tasks if t.area == "batch_prep"]
    assert len(batch_tasks) == 0, "batch task should be gated when no future use"

    # Now add same recipe on weekday -> batch should appear
    slot_mon2 = MealPlanSlot(id="2026-09-15-Lunch", date="2026-09-15", slot="Lunch", title=r_weekend.name, marathi_title=r_weekend.marathi_name, recipe_id=r_weekend.id, recipe=r_weekend)
    tasks2 = generate_household_prep_tasks([slot_sat, slot_mon2])
    batch2 = [t for t in tasks2 if t.area == "batch_prep"]
    assert len(batch2) == 1
