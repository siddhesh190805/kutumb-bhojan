import re
from backend.app.domain.models import CanonicalIngredient, Ingredient
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
            food_groups = r.get("food_groups") or []
            if isinstance(food_groups, str):
                food_groups = [food_groups]

            name = r.get("name", "")
            marathi_name = r.get("marathi_name", "")
            display_name_en = r.get("display_name_en") or name
            display_name_mr = r.get("display_name_mr") or marathi_name

            result.append(
                Ingredient(
                    id=str(r.get("id")),
                    canonical_key=r.get("canonical_key", ""),
                    name=name,
                    marathi_name=marathi_name,
                    display_name_en=display_name_en,
                    display_name_mr=display_name_mr,
                    aliases=aliases,
                    category=r.get("category"),
                    default_unit=r.get("default_unit", "g"),
                    active=r.get("active", True),
                    food_groups=food_groups,
                    protein_contribution=r.get("protein_contribution") or "unknown",
                    fibre_contribution=r.get("fibre_contribution") or "unknown",
                    carbohydrate_role=r.get("carbohydrate_role") or "unknown",
                    fat_contribution=r.get("fat_contribution") or "unknown",
                    fat_quality=r.get("fat_quality") or "unknown",
                    legume_identity=r.get("legume_identity"),
                    grain_identity=r.get("grain_identity"),
                    vegetable_identity=r.get("vegetable_identity"),
                    vegetable_category=r.get("vegetable_category") or "unknown",
                    fruit_identity=r.get("fruit_identity"),
                    seed_identity=r.get("seed_identity"),
                    nut_identity=r.get("nut_identity"),
                    whole_grain_or_millet=bool(r.get("whole_grain_or_millet", False)),
                    soaking_requirement=r.get("soaking_requirement") or "unknown",
                    advance_preparation=r.get("advance_preparation") or "unknown",
                    provenance=r.get("provenance") or "authored",
                    metadata_status=r.get("metadata_status") or "unknown",
                )
            )
        self._cache = result
        return result

    def get_canonical_ingredients(
        self, auth_token: str | None = None, refresh: bool = False
    ) -> list[CanonicalIngredient]:
        """Fetch ingredients as immutable CanonicalIngredient instances."""
        return [i.to_canonical() for i in self.get_all(auth_token=auth_token, refresh=refresh)]

    def normalize_alias(
        self, text: str, catalog: list[Ingredient | CanonicalIngredient] | None = None
    ) -> str | None:
        """
        Find canonical_key for given text or alias.
        
        Performs exact normalized matching across canonical_key, display names,
        and curated aliases. Does NOT guess by substring. Returns None if unknown.
        """
        if not text or not str(text).strip():
            return None

        clean = re.sub(r"\s+", " ", str(text).strip().lower())
        items = catalog or self._cache or self.get_all()

        for ing in items:
            canonical_key = ing.canonical_key
            aliases = ing.aliases

            if canonical_key.lower() == clean:
                return canonical_key

            # Check English / display names
            if hasattr(ing, "display_name_en") and ing.display_name_en and ing.display_name_en.strip().lower() == clean:
                return canonical_key
            if hasattr(ing, "name") and ing.name and ing.name.strip().lower() == clean:
                return canonical_key

            # Check Marathi names (trimmed)
            if hasattr(ing, "display_name_mr") and ing.display_name_mr and ing.display_name_mr.strip() == str(text).strip():
                return canonical_key
            if hasattr(ing, "marathi_name") and ing.marathi_name and ing.marathi_name.strip() == str(text).strip():
                return canonical_key

            # Check aliases
            for alias in aliases:
                alias_str = str(alias).strip()
                if alias_str.lower() == clean or alias_str == str(text).strip():
                    return canonical_key

        return None

    def resolve_canonical(
        self, text: str, catalog: list[Ingredient | CanonicalIngredient] | None = None
    ) -> CanonicalIngredient | None:
        """Resolve text/alias to CanonicalIngredient instance, or None if unresolved."""
        key = self.normalize_alias(text, catalog=catalog)
        if not key:
            return None

        items = catalog or self._cache or self.get_all()
        for ing in items:
            if ing.canonical_key == key:
                return ing.to_canonical() if isinstance(ing, Ingredient) else ing
        return None
