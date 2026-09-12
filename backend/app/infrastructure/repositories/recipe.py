import re
from typing import Any
from backend.app.domain.models import Recipe, RecipeIngredient, DietaryFlags, PracticalMetadata, NutritionMetadata
from backend.app.domain.canonical import CANONICAL_RECIPES
from backend.app.infrastructure.supabase import SupabaseClient, supabase_client
from backend.app.nutrition.derivation import derive_recipe_food_profile

from backend.app.domain.enrichment import enrich_recipe_metadata, parse_time_minutes


class RecipeRepository:
    def __init__(self, client: SupabaseClient = supabase_client):
        self.client = client
        self._cache: dict[str, list[Recipe]] = {}

    async def aget_recipes(
        self,
        household_id: str,
        auth_token: str | None = None,
        refresh: bool = False,
        http_client=None,
    ) -> list[Recipe]:
        if not refresh and household_id in self._cache:
            return self._cache[household_id]
        # Parallelize three independent HTTP reads (reuse same http_client, bounded by caller's semaphore)
        import asyncio

        async def _fetch_recipes():
            return await self.client.aget(
                "recipes",
                {"household_id": f"eq.{household_id}"},
                auth_token=auth_token,
                http_client=http_client,
            )

        async def _fetch_ri():
            try:
                return await self.client.aget(
                    "recipe_ingredients",
                    {"household_id": f"eq.{household_id}", "order": "sort_order"},
                    auth_token=auth_token,
                    http_client=http_client,
                )
            except Exception:
                return []

        async def _fetch_ings():
            try:
                from backend.app.infrastructure.repositories.ingredient import IngredientRepository
                ing_repo = IngredientRepository(self.client)
                ings = await ing_repo.aget_all(auth_token=auth_token, http_client=http_client)
                return ings
            except Exception:
                return []

        try:
            rows, ri_rows, canonical_ings = await asyncio.gather(
                _fetch_recipes(),
                _fetch_ri(),
                _fetch_ings(),
            )
        except Exception:
            rows, ri_rows, canonical_ings = [], [], []
        if not rows:
            return [r.model_copy() for r in CANONICAL_RECIPES]
        # Build ing_map after all three complete (CPU dependency)
        try:
            ing_map = {str(i.id): i.canonical_key for i in canonical_ings if i and getattr(i, "id", None)}
        except Exception:
            ing_map = {}
            canonical_ings = canonical_ings if isinstance(canonical_ings, list) else []
        ri_by_recipe: dict[str, list[RecipeIngredient]] = {}
        for r in ri_rows:
            rec_id = str(r.get("recipe_id"))
            ing_id = str(r.get("ingredient_id") or "")
            canonical_key = str(r.get("ingredient_key") or ing_map.get(ing_id) or "")
            ri_by_recipe.setdefault(rec_id, []).append(
                RecipeIngredient(
                    ingredient_id=ing_id,
                    ingredient_key=canonical_key,
                    quantity=float(r.get("quantity", 0)),
                    unit=str(r.get("unit", "g")),
                    display_text=r.get("display_text"),
                    preparation=r.get("preparation"),
                    sort_order=int(r.get("sort_order", 0)),
                )
            )
        recipes = []
        for r in rows:
            rid = str(r["id"])
            ingredients_raw = r.get("ingredients") or []
            if isinstance(ingredients_raw, str):
                ingredients_raw = [ingredients_raw]
            method_raw = r.get("method") or []
            if isinstance(method_raw, str):
                method_raw = [method_raw]
            prep_time = r.get("preparation_time_minutes")
            if prep_time is not None:
                try:
                    prep_time = int(prep_time)
                except (ValueError, TypeError):
                    prep_time = None
            struct_ings = ri_by_recipe.get(rid, [])
            if not struct_ings:
                rkey = r.get("recipe_key")
                if rkey == "cr3":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=1),
                        RecipeIngredient(ingredient_key="guava", quantity=2, unit="piece", display_text="2 medium guavas", sort_order=2),
                    ]
                elif rkey == "cr9":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="curd", quantity=600, unit="ml", display_text="600 ml plain buttermilk", preparation="buttermilk", sort_order=1),
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=2),
                    ]
                elif rkey == "cr52":
                    struct_ings = [
                        RecipeIngredient(ingredient_key="chickpeas", quantity=120, unit="g", display_text="120 g roasted chana", preparation="roasted", sort_order=1),
                        RecipeIngredient(ingredient_key="banana", quantity=4, unit="piece", display_text="4 small bananas", sort_order=2),
                    ]
            recipe = Recipe(
                id=rid,
                recipe_key=r.get("recipe_key"),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                course=r.get("course") or "Lunch/Dinner",
                meal_category=r.get("meal_category") or r.get("course") or "Lunch/Dinner",
                meal_role=r.get("meal_role") or "main",
                servings=float(r.get("servings") or 4),
                time_text=r.get("time_text") or "30 min",
                cooking_method=r.get("cooking_method") or "Stovetop",
                description=r.get("description"),
                marathi_description=r.get("marathi_description"),
                meal_form=r.get("meal_form"),
                preparation_time_minutes=prep_time,
                preparation_burden=r.get("preparation_burden") or "unknown",
                soaking_requirement=r.get("soaking_requirement") or "unknown",
                fermentation_requirement=r.get("fermentation_requirement") or "unknown",
                batch_prep_suitability=r.get("batch_prep_suitability") or "unknown",
                ingredients=ingredients_raw,
                structured_ingredients=struct_ings,
                method=method_raw,
                note=r.get("note"),
            )
            if canonical_ings and recipe.structured_ingredients:
                recipe.food_profile = derive_recipe_food_profile(recipe, canonical_ings)
            enriched = enrich_recipe_metadata(recipe)
            recipes.append(enriched)
        # Deterministic normalization: sort by id
        recipes.sort(key=lambda r: str(r.id))
        self._cache[household_id] = recipes
        return recipes

    def get_recipes(
        self,
        household_id: str,
        auth_token: str | None = None,
        refresh: bool = False,
    ) -> list[Recipe]:
        if not refresh and household_id in self._cache:
            return self._cache[household_id]

        try:
            rows = self.client.get(
                "recipes",
                {"household_id": f"eq.{household_id}"},
                auth_token=auth_token,
            )
        except Exception:
            rows = []
        if not rows:
            return [r.model_copy() for r in CANONICAL_RECIPES]

        # Also get recipe_ingredients if present and map ingredient_id -> canonical_key
        try:
            ri_rows = self.client.get(
                "recipe_ingredients",
                {"household_id": f"eq.{household_id}", "order": "sort_order"},
                auth_token=auth_token,
            )
        except Exception:
            ri_rows = []

        # Fetch canonical ingredients to resolve ingredient_id -> canonical_key and derive food profiles
        ing_map: dict[str, str] = {}
        canonical_ings: list[Any] = []
        try:
            from backend.app.infrastructure.repositories.ingredient import IngredientRepository
            ing_repo = IngredientRepository(self.client)
            canonical_ings = ing_repo.get_all(auth_token=auth_token)
            ing_map = {str(i.id): i.canonical_key for i in canonical_ings if i.id}
        except Exception:
            ing_map = {}
            canonical_ings = []

        ri_by_recipe: dict[str, list[RecipeIngredient]] = {}
        for r in ri_rows:
            rec_id = str(r.get("recipe_id"))
            ing_id = str(r.get("ingredient_id") or "")
            canonical_key = str(r.get("ingredient_key") or ing_map.get(ing_id) or "")
            ri_by_recipe.setdefault(rec_id, []).append(
                RecipeIngredient(
                    ingredient_id=ing_id,
                    ingredient_key=canonical_key,
                    quantity=float(r.get("quantity", 0)),
                    unit=str(r.get("unit", "g")),
                    display_text=r.get("display_text"),
                    preparation=r.get("preparation"),
                    sort_order=int(r.get("sort_order", 0)),
                )
            )

        recipes = []
        for r in rows:
            rid = str(r["id"])
            ingredients_raw = r.get("ingredients") or []
            if isinstance(ingredients_raw, str):
                ingredients_raw = [ingredients_raw]

            method_raw = r.get("method") or []
            if isinstance(method_raw, str):
                method_raw = [method_raw]

            prep_time = r.get("preparation_time_minutes")
            if prep_time is not None:
                try:
                    prep_time = int(prep_time)
                except (ValueError, TypeError):
                    prep_time = None

            struct_ings = ri_by_recipe.get(rid, [])
            if not struct_ings:
                rkey = r.get("recipe_key")
                if rkey == "cr3":  # Roasted chana + guava
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="guava",
                            quantity=2,
                            unit="piece",
                            display_text="2 medium guavas",
                            sort_order=2,
                        ),
                    ]
                elif rkey == "cr9":  # Buttermilk + roasted chana
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="curd",
                            quantity=600,
                            unit="ml",
                            display_text="600 ml plain buttermilk",
                            preparation="buttermilk",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=2,
                        ),
                    ]
                elif rkey == "cr52":  # Roasted chana + banana
                    struct_ings = [
                        RecipeIngredient(
                            ingredient_key="chickpeas",
                            quantity=120,
                            unit="g",
                            display_text="120 g roasted chana",
                            preparation="roasted",
                            sort_order=1,
                        ),
                        RecipeIngredient(
                            ingredient_key="banana",
                            quantity=4,
                            unit="piece",
                            display_text="4 small bananas",
                            sort_order=2,
                        ),
                    ]

            recipe = Recipe(
                id=rid,
                recipe_key=r.get("recipe_key"),
                name=r.get("name", ""),
                marathi_name=r.get("marathi_name", ""),
                course=r.get("course") or "Lunch/Dinner",
                meal_category=r.get("meal_category") or r.get("course") or "Lunch/Dinner",
                meal_role=r.get("meal_role") or "main",
                servings=float(r.get("servings") or 4),
                time_text=r.get("time_text") or "30 min",
                cooking_method=r.get("cooking_method") or "Stovetop",
                description=r.get("description"),
                marathi_description=r.get("marathi_description"),
                meal_form=r.get("meal_form"),
                preparation_time_minutes=prep_time,
                preparation_burden=r.get("preparation_burden") or "unknown",
                soaking_requirement=r.get("soaking_requirement") or "unknown",
                fermentation_requirement=r.get("fermentation_requirement") or "unknown",
                batch_prep_suitability=r.get("batch_prep_suitability") or "unknown",
                ingredients=ingredients_raw,
                structured_ingredients=struct_ings,
                method=method_raw,
                note=r.get("note"),
            )

            # Derive food profile if structured ingredients and catalog are available
            if canonical_ings and recipe.structured_ingredients:
                recipe.food_profile = derive_recipe_food_profile(recipe, canonical_ings)

            enriched = enrich_recipe_metadata(recipe)
            recipes.append(enriched)

        self._cache[household_id] = recipes
        return recipes

    def get_recipe_by_id(
        self,
        household_id: str,
        recipe_id: str,
        auth_token: str | None = None,
    ) -> Recipe | None:
        all_recipes = self.get_recipes(household_id, auth_token=auth_token)
        for r in all_recipes:
            if r.id == recipe_id or r.recipe_key == recipe_id or r.name.lower() == recipe_id.lower():
                return r
        return None
