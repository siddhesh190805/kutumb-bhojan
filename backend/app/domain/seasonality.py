"""
NFDI-001C Canonical Food Seasonality & Climate Intelligence.

Seasonal mapping for the canonical 40 ingredients grounded in
Western India / Maharashtra regional agricultural availability and culinary traditions.
Language-neutral, rule-based, and non-prohibitive.
"""

from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field
from backend.app.domain.taxonomy import (
    SEASONS,
    SEASONAL_AVAILABILITIES,
    CULINARY_SUITABILITIES,
    METADATA_STATUSES,
    validate_taxonomy_value,
)


class IngredientSeasonality(BaseModel):
    ingredient_key: str
    season: str
    region: str = "maharashtra_western_india"
    availability_status: str = "available"  # peak, available, scarce, unknown
    culinary_suitability: str = "neutral"  # cooling, warming, digestive, neutral, unknown
    provenance: str = "cultural_culinary_heuristic"
    metadata_status: str = "provisional"


# Authoritative seasonal classifications for the 40 canonical ingredients
CANONICAL_SEASONALITY_CATALOG: dict[str, list[dict[str, str]]] = {
    # 1. Vegetables
    "bottle_gourd": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "winter", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "cucumber": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "winter", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "spinach": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "warming"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "scarce", "culinary_suitability": "neutral"},
    ],
    "carrot": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "cauliflower": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "scarce", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "cabbage": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "bhindi": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "winter", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "brinjal": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "warming"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "onion": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "tomato": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "coriander": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "digestive"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],

    # 2. Grains & Millets
    "whole_wheat_flour": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "rice": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],
    "poha": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],
    "jowar_flour": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "warming"},
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],

    # 3. Legumes & Pulses
    "moong_dal": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],
    "chickpeas": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "besan": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "matki": [
        {"season": "monsoon", "availability_status": "peak", "culinary_suitability": "warming"},
        {"season": "winter", "availability_status": "available", "culinary_suitability": "warming"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "rajma": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "warming"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "lobia": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "soy_granules": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],

    # 4. Fruits
    "guava": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "digestive"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "banana": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],
    "apple": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "papaya": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],
    "pomegranate": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "summer", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "mosambi": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "monsoon", "availability_status": "available", "culinary_suitability": "cooling"},
        {"season": "winter", "availability_status": "available", "culinary_suitability": "cooling"},
    ],
    "lemon": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "cooling"},
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"},
    ],

    # 5. Dairy & Egg
    "curd": [
        {"season": "summer", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "milk": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "paneer": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "egg": [
        {"season": "winter", "availability_status": "available", "culinary_suitability": "neutral"},
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],

    # 6. Nuts & Seeds
    "peanuts": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "flaxseed": [
        {"season": "winter", "availability_status": "peak", "culinary_suitability": "neutral"},
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],
    "pumpkin_seeds": [
        {"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"},
    ],

    # 7. Culinary Staples
    "oil": [{"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"}],
    "cumin": [{"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"}],
    "turmeric": [{"season": "all_season", "availability_status": "available", "culinary_suitability": "digestive"}],
    "salt": [{"season": "all_season", "availability_status": "available", "culinary_suitability": "neutral"}],
}

_SEASONALITY_OVERRIDE_CACHE: dict[str, list[dict[str, str]]] | None = None
_SEASONALITY_CACHE_IS_DB: bool = False


def set_seasonality_cache(data: dict[str, list[dict[str, str]]] | list[dict[str, Any]] | None, is_db: bool = True) -> None:
    """Set active seasonality catalog from repository/database."""
    global _SEASONALITY_OVERRIDE_CACHE, _SEASONALITY_CACHE_IS_DB
    if data is None:
        _SEASONALITY_OVERRIDE_CACHE = None
        _SEASONALITY_CACHE_IS_DB = False
        return
    if isinstance(data, list):
        grouped: dict[str, list[dict[str, str]]] = {}
        for row in data:
            k = row.get("ingredient_key")
            if k:
                grouped.setdefault(k, []).append({
                    "season": row.get("season", "all_season"),
                    "availability_status": row.get("availability_status", "available"),
                    "culinary_suitability": row.get("culinary_suitability", "neutral"),
                })
        _SEASONALITY_OVERRIDE_CACHE = grouped
        _SEASONALITY_CACHE_IS_DB = is_db
    else:
        _SEASONALITY_OVERRIDE_CACHE = data
        _SEASONALITY_CACHE_IS_DB = is_db


def is_seasonality_cache_from_db() -> bool:
    return _SEASONALITY_CACHE_IS_DB


def get_active_seasonality_catalog() -> dict[str, list[dict[str, str]]]:
    """Retrieve active catalog (repository cache if loaded, otherwise canonical catalog)."""
    if _SEASONALITY_OVERRIDE_CACHE:
        return _SEASONALITY_OVERRIDE_CACHE
    return CANONICAL_SEASONALITY_CATALOG


def clear_seasonality_cache() -> None:
    """Clear runtime seasonality cache (useful for tests and request isolation)."""
    global _SEASONALITY_OVERRIDE_CACHE, _SEASONALITY_CACHE_IS_DB
    _SEASONALITY_OVERRIDE_CACHE = None
    _SEASONALITY_CACHE_IS_DB = False


def get_current_season(target_date: str | date) -> str:
    """
    Determine Indian / Maharashtra meteorological season from date:
    - Summer (March to June): months 3, 4, 5, 6
    - Monsoon (July to October): months 7, 8, 9, 10
    - Winter (November to February): months 11, 12, 1, 2
    """
    if isinstance(target_date, str):
        dt = datetime.strptime(target_date, "%Y-%m-%d")
    else:
        dt = target_date
    month = dt.month

    if 3 <= month <= 6:
        return "summer"
    elif 7 <= month <= 10:
        return "monsoon"
    else:
        return "winter"


def get_ingredient_seasonality_entries(ingredient_key: str) -> list[IngredientSeasonality]:
    """Retrieve validated seasonality records for an ingredient."""
    catalog = get_active_seasonality_catalog()
    raw_list = catalog.get(ingredient_key, [])
    results = []
    for item in raw_list:
        results.append(
            IngredientSeasonality(
                ingredient_key=ingredient_key,
                season=validate_taxonomy_value("season", item.get("season"), SEASONS),
                availability_status=validate_taxonomy_value(
                    "availability_status", item.get("availability_status"), SEASONAL_AVAILABILITIES
                ),
                culinary_suitability=validate_taxonomy_value(
                    "culinary_suitability", item.get("culinary_suitability"), CULINARY_SUITABILITIES
                ),
                provenance="cultural_culinary_heuristic",
                metadata_status="provisional",
            )
        )
    return results


def evaluate_ingredient_season(
    ingredient_key: str,
    season: str,
) -> tuple[bool, str, str]:
    """
    Check if an ingredient is in peak season or cooling/warming in the target season.
    Returns (is_peak, availability_status, culinary_suitability).
    """
    catalog = get_active_seasonality_catalog()
    entries = catalog.get(ingredient_key, [])
    for e in entries:
        if e.get("season") == season:
            return (
                e.get("availability_status") == "peak",
                e.get("availability_status", "available"),
                e.get("culinary_suitability", "neutral"),
            )
        if e.get("season") == "all_season":
            return (
                False,
                "available",
                e.get("culinary_suitability", "neutral"),
            )
    return (False, "unknown", "unknown")
