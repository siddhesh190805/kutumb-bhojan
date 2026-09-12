from backend.app.domain.models import FamilyMember, FrequencyRule, DietaryRule
from backend.app.domain.rules import DEFAULT_DIETARY_RULES, DEFAULT_FREQUENCY_RULES
from backend.app.domain.canonical import CANONICAL_FAMILY_MEMBERS
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class HouseholdRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client

    async def aget_family_members(self, household_id: str, auth_token: str | None = None, http_client=None) -> list[FamilyMember]:
        try:
            rows = await self.client.aget(
                "family_members",
                {"household_id": f"eq.{household_id}", "order": "sort_order"},
                auth_token=auth_token,
                http_client=http_client,
            )
        except Exception:
            rows = []
        if not rows:
            members_payload = [
                {
                    "household_id": household_id,
                    "member_key": m.member_key or m.id,
                    "name": m.name,
                    "marathi_name": m.marathi_name or m.name,
                    "age": m.age,
                    "sex": m.sex,
                    "weight_kg": float(m.weight_kg) if m.weight_kg is not None else None,
                    "height_cm": float(m.height_cm) if m.height_cm is not None else None,
                    "activity": m.activity,
                    "note": m.note,
                    "sort_order": m.sort_order,
                }
                for m in CANONICAL_FAMILY_MEMBERS
            ]
            try:
                await self.client.apost(
                    "family_members",
                    members_payload,
                    auth_token=auth_token,
                    upsert=True,
                    on_conflict="household_id,member_key",
                    http_client=http_client,
                )
            except Exception:
                pass
            return [m.model_copy() for m in CANONICAL_FAMILY_MEMBERS]
        return [
            FamilyMember(
                id=str(r.get("id")),
                member_key=r.get("member_key", ""),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                age=int(r.get("age", 30)),
                sex=r.get("sex"),
                weight_kg=float(r["weight_kg"]) if r.get("weight_kg") is not None else None,
                height_cm=float(r["height_cm"]) if r.get("height_cm") is not None else None,
                activity=r.get("activity"),
                note=r.get("note"),
                sort_order=int(r.get("sort_order", 0)),
            )
            for r in rows
        ]

    def get_family_members(self, household_id: str, auth_token: str | None = None) -> list[FamilyMember]:
        try:
            rows = self.client.get(
                "family_members",
                {"household_id": f"eq.{household_id}", "order": "sort_order"},
                auth_token=auth_token,
            )
        except Exception:
            rows = []
        if not rows:
            return [m.model_copy() for m in CANONICAL_FAMILY_MEMBERS]
        return [
            FamilyMember(
                id=str(r.get("id")),
                member_key=r.get("member_key", ""),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                age=int(r.get("age", 30)),
                sex=r.get("sex"),
                weight_kg=float(r["weight_kg"]) if r.get("weight_kg") is not None else None,
                height_cm=float(r["height_cm"]) if r.get("height_cm") is not None else None,
                activity=r.get("activity"),
                note=r.get("note"),
                sort_order=int(r.get("sort_order", 0)),
            )
            for r in rows
        ]

    async def aget_frequency_rules(self, household_id: str, auth_token: str | None = None, http_client=None) -> list[FrequencyRule]:
        try:
            rows = await self.client.aget(
                "household_frequency_rules",
                {"household_id": f"eq.{household_id}", "active": "eq.true"},
                auth_token=auth_token,
                http_client=http_client,
            )
        except Exception:
            return DEFAULT_FREQUENCY_RULES
        if not rows:
            return DEFAULT_FREQUENCY_RULES
        return [
            FrequencyRule(
                id=str(r.get("id")),
                rule_key=r.get("rule_key", ""),
                ingredient_key=r.get("ingredient_key", ""),
                max_per_calendar_month=int(r.get("max_per_calendar_month", 5)),
                period=r.get("period", "calendar-month"),
                rule_type=r.get("rule_type", "ingredient_frequency"),
                preference_type=r.get("preference_type", "household_planning"),
                label=r.get("label", "Frequency Rule"),
                marathi_label=r.get("marathi_label", "वारंवारता नियम"),
                description=r.get("description", ""),
                marathi_description=r.get("marathi_description", ""),
                active=r.get("active", True),
            )
            for r in rows
        ]

    def get_frequency_rules(self, household_id: str, auth_token: str | None = None) -> list[FrequencyRule]:
        try:
            rows = self.client.get(
                "household_frequency_rules",
                {"household_id": f"eq.{household_id}", "active": "eq.true"},
                auth_token=auth_token,
            )
        except Exception:
            return DEFAULT_FREQUENCY_RULES

        if not rows:
            return DEFAULT_FREQUENCY_RULES
        return [
            FrequencyRule(
                id=str(r.get("id")),
                rule_key=r.get("rule_key", ""),
                ingredient_key=r.get("ingredient_key", ""),
                max_per_calendar_month=int(r.get("max_per_calendar_month", 5)),
                period=r.get("period", "calendar-month"),
                rule_type=r.get("rule_type", "ingredient_frequency"),
                preference_type=r.get("preference_type", "household_planning"),
                label=r.get("label", "Frequency Rule"),
                marathi_label=r.get("marathi_label", "वारंवारता नियम"),
                description=r.get("description", ""),
                marathi_description=r.get("marathi_description", ""),
                active=r.get("active", True),
            )
            for r in rows
        ]

    async def aget_dietary_rules(self, household_id: str, auth_token: str | None = None, http_client=None) -> list[DietaryRule]:
        try:
            rows = await self.client.aget(
                "dietary_rules",
                {"household_id": f"eq.{household_id}", "active": "eq.true"},
                auth_token=auth_token,
                http_client=http_client,
            )
        except Exception:
            return DEFAULT_DIETARY_RULES
        if not rows:
            return DEFAULT_DIETARY_RULES
        return [
            DietaryRule(
                id=str(r.get("id")),
                rule_key=r.get("rule_key", ""),
                ingredient_key=r.get("ingredient_key", ""),
                allowed_member_ids=r.get("allowed_member_ids") or [],
                disallowed_member_ids=r.get("disallowed_member_ids") or [],
                alternate_policy=r.get("alternate_policy", "vegetarian-existing"),
                active=r.get("active", True),
            )
            for r in rows
        ]

    def get_dietary_rules(self, household_id: str, auth_token: str | None = None) -> list[DietaryRule]:
        try:
            rows = self.client.get(
                "dietary_rules",
                {"household_id": f"eq.{household_id}", "active": "eq.true"},
                auth_token=auth_token,
            )
        except Exception:
            return DEFAULT_DIETARY_RULES

        if not rows:
            return DEFAULT_DIETARY_RULES
        return [
            DietaryRule(
                id=str(r.get("id")),
                rule_key=r.get("rule_key", ""),
                ingredient_key=r.get("ingredient_key", ""),
                allowed_member_ids=r.get("allowed_member_ids") or [],
                disallowed_member_ids=r.get("disallowed_member_ids") or [],
                alternate_policy=r.get("alternate_policy", "vegetarian-existing"),
                active=r.get("active", True),
            )
            for r in rows
        ]
