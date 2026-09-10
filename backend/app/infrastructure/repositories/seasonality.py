"""
Seasonality Repository for querying canonical ingredient climate & seasonal profiles.
"""

from typing import Any
from backend.app.domain.seasonality import (
    CANONICAL_SEASONALITY_CATALOG,
    IngredientSeasonality,
    get_current_season,
    evaluate_ingredient_season,
)
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client


class SeasonalityRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client
        self._cache: dict[str, list[dict[str, Any]]] = {}

    def get_seasonality_by_season(
        self,
        season: str,
        region: str = "maharashtra_western_india",
        auth_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get all peak/available ingredients for the target season."""
        cache_key = f"{season}:{region}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            rows = self.client.get(
                "ingredient_seasonality",
                {
                    "season": f"in.({season},all_season)",
                    "region": f"eq.{region}",
                },
                auth_token=auth_token,
            )
            if rows:
                self._cache[cache_key] = rows
                return rows
        except Exception:
            pass

        # In-memory fallback from domain catalog
        fallback_rows = []
        for ikey, items in CANONICAL_SEASONALITY_CATALOG.items():
            for item in items:
                if item.get("season") in (season, "all_season"):
                    fallback_rows.append({
                        "ingredient_key": ikey,
                        "season": item.get("season"),
                        "region": region,
                        "availability_status": item.get("availability_status", "available"),
                        "culinary_suitability": item.get("culinary_suitability", "neutral"),
                    })
        self._cache[cache_key] = fallback_rows
        return fallback_rows
