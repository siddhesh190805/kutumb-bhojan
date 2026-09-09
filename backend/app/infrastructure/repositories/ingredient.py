from backend.app.domain.models import Ingredient
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class IngredientRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client
        self._cache: list[Ingredient] | None = None

    def get_all(self, auth_token: str | None = None, refresh: bool = False) -> list[Ingredient]:
        if self._cache is not None and not refresh:
            return self._cache

        rows = self.client.get("ingredients", {"active": "eq.true", "order": "canonical_key"}, auth_token=auth_token)
        result = []
        for r in rows:
            aliases = r.get("aliases") or []
            if isinstance(aliases, str):
                aliases = [aliases]
            result.append(
                Ingredient(
                    id=str(r.get("id")),
                    canonical_key=r.get("canonical_key", ""),
                    name=r.get("name", ""),
                    marathi_name=r.get("marathi_name", ""),
                    aliases=aliases,
                    category=r.get("category"),
                    default_unit=r.get("default_unit", "g"),
                    active=r.get("active", True),
                )
            )
        self._cache = result
        return result

    def normalize_alias(self, text: str, catalog: list[Ingredient] | None = None) -> str | None:
        """Find canonical_key for given text or alias."""
        clean = text.strip().lower()
        items = catalog or self._cache or self.get_all()
        for ing in items:
            if ing.canonical_key.lower() == clean or ing.name.lower() == clean or ing.marathi_name == clean:
                return ing.canonical_key
            for alias in ing.aliases:
                if str(alias).strip().lower() == clean:
                    return ing.canonical_key
        return None
