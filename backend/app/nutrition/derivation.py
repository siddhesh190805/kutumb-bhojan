"""
NFDI-001A Recipe Food Profile Derivation Service.

Derives deterministic qualitative nutrition, diversity, and preparation profiles
exclusively from structured canonical ingredients. Does NOT infer nutrition or
diversity from recipe names, titles, descriptions, or substrings.
"""

from typing import Iterable
from backend.app.domain.models import (
    CanonicalIngredient,
    DerivedRecipeFoodProfile,
    Ingredient,
    Recipe,
    RecipeIngredient,
)


def derive_recipe_food_profile(
    recipe: Recipe,
    catalog: Iterable[CanonicalIngredient | Ingredient] | dict[str, CanonicalIngredient | Ingredient],
) -> DerivedRecipeFoodProfile:
    """
    Derive qualitative food profile for a recipe strictly from its structured ingredients.
    
    Guarantees:
    1. Deterministic and language-neutral.
    2. Zero inference from recipe names or descriptions.
    3. Missing or incomplete ingredients are safely represented without guessing.
    """
    # Build lookup table by canonical_key and id
    catalog_map: dict[str, CanonicalIngredient] = {}
    if isinstance(catalog, dict):
        items = catalog.values()
    else:
        items = catalog

    for item in items:
        canonical = item.to_canonical() if isinstance(item, Ingredient) else item
        catalog_map[canonical.canonical_key] = canonical
        catalog_map[str(canonical.id)] = canonical

    food_groups: set[str] = set()
    legume_identities: set[str] = set()
    grain_identities: set[str] = set()
    vegetable_identities: set[str] = set()
    fruit_identities: set[str] = set()
    seed_identities: set[str] = set()
    nut_identities: set[str] = set()
    has_whole_grain_or_millet = False
    protein_contributions: set[str] = set()
    fibre_contributions: set[str] = set()
    carbohydrate_roles: set[str] = set()
    fat_contributions: set[str] = set()
    fat_qualities: set[str] = set()

    for ri in recipe.structured_ingredients:
        # Match by key or ingredient_id
        ing = catalog_map.get(ri.ingredient_key) or (catalog_map.get(ri.ingredient_id) if ri.ingredient_id else None)
        if not ing:
            continue

        for fg in ing.food_groups:
            if fg:
                food_groups.add(fg)

        if ing.legume_identity:
            legume_identities.add(ing.legume_identity)
        if ing.grain_identity:
            grain_identities.add(ing.grain_identity)
        if ing.vegetable_identity:
            vegetable_identities.add(ing.vegetable_identity)
        if ing.fruit_identity:
            fruit_identities.add(ing.fruit_identity)
        if ing.seed_identity:
            seed_identities.add(ing.seed_identity)
        if ing.nut_identity:
            nut_identities.add(ing.nut_identity)

        if ing.whole_grain_or_millet:
            has_whole_grain_or_millet = True

        if ing.protein_contribution and ing.protein_contribution != "unknown":
            protein_contributions.add(ing.protein_contribution)
        if ing.fibre_contribution and ing.fibre_contribution != "unknown":
            fibre_contributions.add(ing.fibre_contribution)
        if ing.carbohydrate_role and ing.carbohydrate_role != "unknown":
            carbohydrate_roles.add(ing.carbohydrate_role)
        if ing.fat_contribution and ing.fat_contribution != "unknown":
            fat_contributions.add(ing.fat_contribution)
        if ing.fat_quality and ing.fat_quality != "unknown":
            fat_qualities.add(ing.fat_quality)

    return DerivedRecipeFoodProfile(
        food_groups=frozenset(food_groups),
        legume_identities=frozenset(legume_identities),
        grain_identities=frozenset(grain_identities),
        vegetable_identities=frozenset(vegetable_identities),
        fruit_identities=frozenset(fruit_identities),
        seed_identities=frozenset(seed_identities),
        nut_identities=frozenset(nut_identities),
        has_whole_grain_or_millet=has_whole_grain_or_millet,
        protein_contributions=frozenset(protein_contributions),
        fibre_contributions=frozenset(fibre_contributions),
        carbohydrate_roles=frozenset(carbohydrate_roles),
        fat_contributions=frozenset(fat_contributions),
        fat_qualities=frozenset(fat_qualities),
        provenance="derived",
    )
