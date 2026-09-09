import pytest
from backend.app.domain.models import Recipe, FamilyMember
from backend.app.infrastructure.repositories.recipe import enrich_recipe_metadata
from backend.app.infrastructure.repositories.household import HouseholdRepository
from backend.app.infrastructure.repositories.ingredient import IngredientRepository
from backend.app.infrastructure.supabase import SupabaseClient


def test_recipe_metadata_enrichment():
    recipe = Recipe(
        id="chole-roti",
        name="Chole + Roti + Cabbage-Peas + Apple",
        marathi_name="छोले + पोळी + कोबी-वाटाणा + सफरचंद",
        course="Lunch/Dinner",
        ingredients=[
            "280 g dry chickpeas, soaked",
            "8 whole-wheat rotis",
            "350 g cabbage",
            "1 apple",
        ],
        time_text="40 min",
    )
    enriched = enrich_recipe_metadata(recipe)
    assert enriched.practical_metadata.meal_density == "substantial"
    assert enriched.practical_metadata.meal_form == "curry_sabji"
    assert enriched.practical_metadata.primary_grain == "wheat"
    assert enriched.practical_metadata.primary_protein_source == "legume"
    assert enriched.practical_metadata.soaking_required is True
    assert enriched.dietary_flags.vegetables is True
    assert enriched.dietary_flags.fruit is True


def test_ingredient_alias_normalization():
    class DummyClient:
        def get(self, *args, **kwargs):
            return [
                {"canonical_key": "onion", "name": "Onion", "marathi_name": "कांदा", "aliases": ["onions", "कांदे"]},
                {"canonical_key": "paneer", "name": "Paneer", "marathi_name": "पनीर", "aliases": []},
            ]

    repo = IngredientRepository(DummyClient())
    catalog = repo.get_all()
    assert repo.normalize_alias("कांदे", catalog) == "onion"
    assert repo.normalize_alias("Onions", catalog) == "onion"
    assert repo.normalize_alias("paneer", catalog) == "paneer"
    assert repo.normalize_alias("unknown", catalog) is None
