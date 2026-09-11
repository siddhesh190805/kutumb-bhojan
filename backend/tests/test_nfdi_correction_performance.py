"""
NFDI-001C-CORRECTION-001 Performance Regression Guard.
Validates in-memory PlanningEngine baseline for visible=7, eval=30, beam=3.
"""
import time
import pytest
from backend.app.domain.models import Recipe, DerivedRecipeFoodProfile, PracticalMetadata, RecipeIngredient
from backend.app.planning.search import run_bounded_beam_search


def _build_production_catalog(size: int = 30) -> list[Recipe]:
    templates = [
        ('Poha', 'Breakfast', 'poha', 'poha'),
        ('Chilla', 'Breakfast', 'chilla', 'none'),
        ('Egg Bhurji', 'Breakfast', 'bhurji', 'none'),
        ('Upma', 'Breakfast', 'poha', 'wheat'),
        ('Idli', 'Breakfast', 'dosa_uttapam', 'rice'),
        ('Palak Paneer', 'Lunch/Dinner', 'curry_sabji', 'wheat'),
        ('Chole', 'Lunch/Dinner', 'curry_sabji', 'wheat'),
        ('Khichdi', 'Lunch/Dinner', 'khichdi', 'rice'),
        ('Bhindi', 'Lunch/Dinner', 'curry_sabji', 'millet'),
        ('Rajma', 'Lunch/Dinner', 'curry_sabji', 'rice'),
        ('Dal Fry', 'Lunch/Dinner', 'curry_sabji', 'wheat'),
        ('Bottle Gourd', 'Lunch/Dinner', 'curry_sabji', 'millet'),
        ('Cabbage', 'Lunch/Dinner', 'curry_sabji', 'wheat'),
        ('Cauliflower', 'Lunch/Dinner', 'curry_sabji', 'wheat'),
        ('Misal', 'Lunch/Dinner', 'misal_usal', 'none'),
        ('Thalipeeth', 'Breakfast', 'thalipeeth_dashmi', 'millet'),
        ('Pulao', 'Lunch/Dinner', 'rice_dish', 'rice'),
        ('Kadhi', 'Lunch/Dinner', 'curry_sabji', 'none'),
        ('Thecha', 'Lunch/Dinner', 'curry_sabji', 'millet'),
        ('Roasted Chana', 'Snack', 'snack_chaat', 'none'),
        ('Fruit Bowl', 'Snack', 'snack_chaat', 'none'),
        ('Buttermilk', 'Snack', 'snack_chaat', 'none'),
    ]
    recipes: list[Recipe] = []
    for i, (name, course, form, grain) in enumerate(templates):
        r = Recipe(
            id=f"r{i:02d}",
            name=name,
            marathi_name=name,
            course=course,
            meal_category=course,
            structured_ingredients=[RecipeIngredient(ingredient_key='spinach', quantity=100, unit='g')],
            practical_metadata=PracticalMetadata(meal_form=form, primary_grain=grain, primary_protein_source='legume', time_minutes=30, meal_density='moderate'),
            food_profile=DerivedRecipeFoodProfile(legume_identities=frozenset({'moong'}), grain_identities=frozenset({grain}) if grain != 'none' else frozenset(), has_whole_grain_or_millet=(grain == 'millet')),
        )
        recipes.append(r)
    # pad to size
    while len(recipes) < size:
        idx = len(recipes)
        recipes.append(Recipe(
            id=f"rx{idx}",
            name=f"Extra {idx}",
            marathi_name=f"Extra {idx}",
            course='Lunch/Dinner',
            meal_category='Lunch/Dinner',
            structured_ingredients=[RecipeIngredient(ingredient_key='tomato', quantity=100, unit='g')],
            practical_metadata=PracticalMetadata(meal_form='curry_sabji', primary_grain='wheat', primary_protein_source='legume', time_minutes=30),
            food_profile=DerivedRecipeFoodProfile(legume_identities=frozenset({'chana'}), grain_identities=frozenset({'wheat'})),
        ))
    return recipes[:size]


def test_planner_benchmark_visible7_eval30_beam3():
    catalog = _build_production_catalog(30)
    start = time.perf_counter()
    winning, beam = run_bounded_beam_search(
        start_date="2026-09-12",
        visible_days=7,
        evaluation_days=30,
        beam_width=3,
        recipes_catalog=catalog,
        members=[],
    )
    elapsed = time.perf_counter() - start
    # Semantic invariants
    assert len(winning.slots) == 30 * 4  # 120 slots
    assert len(beam) == 3
    assert winning.cumulative_score >= beam[1].cumulative_score
    # Performance guard: generous for CI (not machine-dependent brittle)
    # Baseline on developer machine ~0.3s; allow 2.0s in CI
    assert elapsed < 2.0, f"Planner too slow: {elapsed:.3f}s for 30d/beam3 (expected <2.0s)"
    # Determinism
    winning2, _ = run_bounded_beam_search(
        start_date="2026-09-12",
        visible_days=7,
        evaluation_days=30,
        beam_width=3,
        recipes_catalog=catalog,
        members=[],
    )
    assert [s["recipe"].id for s in winning.slots] == [s["recipe"].id for s in winning2.slots]


def test_planner_candidate_evaluation_count():
    catalog = _build_production_catalog(20)
    winning, _ = run_bounded_beam_search(
        start_date="2026-09-12",
        visible_days=7,
        evaluation_days=7,
        beam_width=3,
        recipes_catalog=catalog,
        members=[],
    )
    # 7 days *4 slots =28 slots planned
    assert len(winning.slots) == 28
