"""
NFDI-001A Canonical Food Knowledge Taxonomy & Validation.

Centralized controlled qualitative classifications, diversity identities,
preparation metadata, and provenance rules.
"""

from typing import Any

PROTEIN_CONTRIBUTIONS = frozenset({"main", "supporting", "minimal", "none", "unknown"})
FIBRE_CONTRIBUTIONS = frozenset({"meaningful", "supporting", "minimal", "none", "unknown"})
CARBOHYDRATE_ROLES = frozenset({"primary", "supporting", "minimal", "none", "unknown"})
FAT_CONTRIBUTIONS = frozenset({"meaningful", "supporting", "minimal", "none", "unknown"})
FAT_QUALITIES = frozenset({
    "predominantly_unsaturated",
    "mixed",
    "predominantly_saturated",
    "not_meaningful",
    "unknown",
})

VEGETABLE_CATEGORIES = frozenset({
    "leafy_green",
    "cruciferous",
    "root_tuber",
    "fruit_vegetable",
    "legume_vegetable",
    "other",
    "unknown",
})

SOAKING_REQUIREMENTS = frozenset({"none", "short", "overnight", "optional", "unknown"})
ADVANCE_PREPARATIONS = frozenset({"none", "soaking", "sprouting", "fermentation", "prep_ahead", "unknown"})
FERMENTATION_REQUIREMENTS = frozenset({"none", "short", "overnight", "optional", "unknown"})
PREPARATION_BURDENS = frozenset({"minimal", "low", "moderate", "high", "unknown"})
BATCH_PREP_SUITABILITIES = frozenset({"high", "moderate", "low", "none", "unknown"})
METADATA_STATUSES = frozenset({"verified", "draft", "unknown"})
SEASONS = frozenset({"summer", "monsoon", "winter", "all_season"})
SEASONAL_AVAILABILITIES = frozenset({"peak", "available", "scarce", "unknown"})
CULINARY_SUITABILITIES = frozenset({"cooling", "warming", "digestive", "neutral", "unknown"})


def validate_taxonomy_value(field: str, value: str | None, allowed: frozenset[str], default: str = "unknown") -> str:
    """Validate a single controlled value against allowed set."""
    if value is None:
        return default
    val = str(value).strip().lower()
    if val not in allowed:
        raise ValueError(f"Invalid {field}: {value!r}. Must be one of {sorted(allowed)}")
    return val


def validate_ingredient_taxonomy(data: dict[str, Any]) -> dict[str, Any]:
    """Validate ingredient qualitative taxonomy fields."""
    result = dict(data)
    if "protein_contribution" in result:
        result["protein_contribution"] = validate_taxonomy_value(
            "protein_contribution", result.get("protein_contribution"), PROTEIN_CONTRIBUTIONS
        )
    if "fibre_contribution" in result:
        result["fibre_contribution"] = validate_taxonomy_value(
            "fibre_contribution", result.get("fibre_contribution"), FIBRE_CONTRIBUTIONS
        )
    if "carbohydrate_role" in result:
        result["carbohydrate_role"] = validate_taxonomy_value(
            "carbohydrate_role", result.get("carbohydrate_role"), CARBOHYDRATE_ROLES
        )
    if "fat_contribution" in result:
        result["fat_contribution"] = validate_taxonomy_value(
            "fat_contribution", result.get("fat_contribution"), FAT_CONTRIBUTIONS
        )
    if "fat_quality" in result:
        result["fat_quality"] = validate_taxonomy_value(
            "fat_quality", result.get("fat_quality"), FAT_QUALITIES
        )
    if "vegetable_category" in result:
        result["vegetable_category"] = validate_taxonomy_value(
            "vegetable_category", result.get("vegetable_category"), VEGETABLE_CATEGORIES
        )
    if "soaking_requirement" in result:
        result["soaking_requirement"] = validate_taxonomy_value(
            "soaking_requirement", result.get("soaking_requirement"), SOAKING_REQUIREMENTS
        )
    if "advance_preparation" in result:
        result["advance_preparation"] = validate_taxonomy_value(
            "advance_preparation", result.get("advance_preparation"), ADVANCE_PREPARATIONS
        )
    if "metadata_status" in result:
        result["metadata_status"] = validate_taxonomy_value(
            "metadata_status", result.get("metadata_status"), METADATA_STATUSES
        )
    return result


def validate_recipe_prep_taxonomy(data: dict[str, Any]) -> dict[str, Any]:
    """Validate recipe preparation taxonomy fields."""
    result = dict(data)
    if "preparation_burden" in result:
        result["preparation_burden"] = validate_taxonomy_value(
            "preparation_burden", result.get("preparation_burden"), PREPARATION_BURDENS
        )
    if "soaking_requirement" in result:
        result["soaking_requirement"] = validate_taxonomy_value(
            "soaking_requirement", result.get("soaking_requirement"), SOAKING_REQUIREMENTS
        )
    if "fermentation_requirement" in result:
        result["fermentation_requirement"] = validate_taxonomy_value(
            "fermentation_requirement", result.get("fermentation_requirement"), FERMENTATION_REQUIREMENTS
        )
    if "batch_prep_suitability" in result:
        result["batch_prep_suitability"] = validate_taxonomy_value(
            "batch_prep_suitability", result.get("batch_prep_suitability"), BATCH_PREP_SUITABILITIES
        )
    return result
