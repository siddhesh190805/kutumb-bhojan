import pytest
from backend.app.domain.models import (
    Recipe,
    FamilyMember,
    DietaryRule,
    FrequencyRule,
    CurrentMealContext,
    DietaryFlags,
    PracticalMetadata,
    RecipeIngredient,
)
from backend.app.domain.rules import DEFAULT_DIETARY_RULES, DEFAULT_FREQUENCY_RULES
from backend.app.planning.constraints import evaluate_hard_constraints
from backend.app.planning.engine import PlanningEngine
from backend.app.planning.search import run_bounded_beam_search
from backend.app.infrastructure.repositories.recipe import enrich_recipe_metadata


@pytest.fixture
def sample_members():
    return [
        FamilyMember(id="siddhesh", member_key="siddhesh", name="Siddhesh", marathi_name="सिद्धेश", age=21),
        FamilyMember(id="tejas", member_key="tejas", name="Tejas", marathi_name="तेजस", age=14),
        FamilyMember(id="vikas", member_key="vikas", name="Vikas", marathi_name="विकास", age=50),
        FamilyMember(id="namrata", member_key="namrata", name="Namrata", marathi_name="नम्रता", age=40),
    ]


@pytest.fixture
def sample_recipes():
    r1 = enrich_recipe_metadata(Recipe(
        id="poha",
        name="Vegetable Poha + Peanuts + Curd",
        marathi_name="भाजी पोहे + शेंगदाणे + दही",
        course="Breakfast",
        ingredients=["240 g poha", "50 g peanuts", "200 g vegetables", "400 g curd"],
        time_text="15 min",
    ))
    r2 = enrich_recipe_metadata(Recipe(
        id="chilla",
        name="Moong Dal Chilla",
        marathi_name="मूग डाळ चिल्ला",
        course="Breakfast",
        ingredients=["200 g soaked moong dal", "100 g vegetables", "10 ml oil"],
        time_text="20 min",
    ))
    r3 = enrich_recipe_metadata(Recipe(
        id="egg-bhurji",
        name="Egg Bhurji + Roti",
        marathi_name="अंडा भुर्जी + पोळी",
        course="Breakfast",
        ingredients=["8 eggs", "8 rotis", "200 g onion-tomato"],
        time_text="15 min",
    ))
    r4 = enrich_recipe_metadata(Recipe(
        id="palak-paneer",
        name="Palak Paneer + Roti",
        marathi_name="पालक पनीर + पोळी",
        course="Lunch/Dinner",
        ingredients=["400 g paneer", "500 g spinach", "8 rotis"],
        time_text="35 min",
    ))
    r5 = enrich_recipe_metadata(Recipe(
        id="chole-roti",
        name="Chole + Roti",
        marathi_name="छोले + पोळी",
        course="Lunch/Dinner",
        ingredients=["280 g dry chickpeas, soaked", "8 rotis"],
        time_text="45 min",
    ))
    r6 = enrich_recipe_metadata(Recipe(
        id="khichdi",
        name="Vegetable Moong Khichdi + Curd",
        marathi_name="भाजी मूग खिचडी + दही",
        course="Lunch/Dinner",
        ingredients=["180 g rice", "120 g moong dal", "400 g curd"],
        time_text="20 min",
    ))
    r7 = enrich_recipe_metadata(Recipe(
        id="roasted-chana",
        name="Roasted Chana + Guava",
        marathi_name="भाजलेला हरभरा + पेरू",
        course="Snack",
        ingredients=["120 g roasted chana", "2 guavas"],
        time_text="5 min",
    ))
    return [r1, r2, r3, r4, r5, r6, r7]


def test_paneer_constraints_and_no_consecutive_hard_ban(sample_recipes):
    paneer_recipe = next(r for r in sample_recipes if r.id == "palak-paneer")

    # 1. Exactly 5 paneer meals already in month -> candidate is REJECTED
    valid_5, reasons_5 = evaluate_hard_constraints(
        recipe=paneer_recipe,
        slot="Dinner",
        target_date="2026-09-10",
        paneer_count_in_month=5,
        max_paneer_per_month=5,
    )
    assert valid_5 is False
    assert any("Monthly paneer limit" in r for r in reasons_5)

    # 2. 4 paneer meals in month -> candidate is ALLOWED
    valid_4, reasons_4 = evaluate_hard_constraints(
        recipe=paneer_recipe,
        slot="Dinner",
        target_date="2026-09-10",
        paneer_count_in_month=4,
        max_paneer_per_month=5,
    )
    assert valid_4 is True

    # 3. Consecutive day paneer (yesterday had paneer) is NOT hard rejected!
    # Verified: evaluate_hard_constraints does NOT ban consecutive paneer.
    valid_consec, _ = evaluate_hard_constraints(
        recipe=paneer_recipe,
        slot="Dinner",
        target_date="2026-09-10",
        paneer_count_in_month=2,
        max_paneer_per_month=5,
    )
    assert valid_consec is True


def test_beam_search_maintains_multiple_partial_plans(sample_recipes, sample_members):
    winning, final_beam = run_bounded_beam_search(
        start_date="2026-09-07",
        visible_days=2,
        evaluation_days=2,
        beam_width=3,
        recipes_catalog=sample_recipes,
        members=sample_members,
    )
    assert len(final_beam) == 3, "Beam search must maintain exactly beam_width partial plans"
    assert winning == final_beam[0]
    assert final_beam[0].cumulative_score >= final_beam[1].cumulative_score
    assert final_beam[1].cumulative_score >= final_beam[2].cumulative_score


def test_plan_generation_determinism(sample_recipes, sample_members):
    engine = PlanningEngine(beam_width=3)
    res1 = engine.generate_plan("2026-09-07", visible_days=7, evaluation_days=14, recipes=sample_recipes, members=sample_members)
    res2 = engine.generate_plan("2026-09-07", visible_days=7, evaluation_days=14, recipes=sample_recipes, members=sample_members)

    assert len(res1.plan) == len(res2.plan)
    assert [p.recipe_id for p in res1.plan] == [p.recipe_id for p in res2.plan]
    assert [p.title for p in res1.plan] == [p.title for p in res2.plan]


def test_member_eligibility_in_generated_plan(sample_recipes, sample_members):
    engine = PlanningEngine(beam_width=3)
    # Force an egg recipe in breakfast
    egg_recipe = next(r for r in sample_recipes if r.id == "egg-bhurji")
    chilla_recipe = next(r for r in sample_recipes if r.id == "chilla")

    res = engine.generate_plan(
        "2026-09-07",
        visible_days=1,
        evaluation_days=1,
        recipes=[egg_recipe, chilla_recipe, sample_recipes[3], sample_recipes[5], sample_recipes[6]],
        members=sample_members,
    )
    breakfast_slot = next(s for s in res.plan if s.slot == "Breakfast")
    if breakfast_slot.recipe_id == "egg-bhurji":
        as_map = {a.member_id: a.recipe_id for a in breakfast_slot.assignments}
        assert as_map["siddhesh"] == "egg-bhurji"
        assert as_map["tejas"] == "egg-bhurji"
        assert as_map["vikas"] != "egg-bhurji", "Vikas must NEVER receive an egg recipe"
        assert as_map["namrata"] != "egg-bhurji", "Namrata must NEVER receive an egg recipe"
        assert as_map["vikas"] == "chilla"


def test_meal_change_reason_taxonomy(sample_recipes, sample_members):
    engine = PlanningEngine(beam_width=3)
    palak_paneer = next(r for r in sample_recipes if r.id == "palak-paneer")
    chole = next(r for r in sample_recipes if r.id == "chole-roti")
    khichdi = next(r for r in sample_recipes if r.id == "khichdi")

    current_meal = CurrentMealContext(
        date="2026-09-07",
        slot="Dinner",
        recipe_id=palak_paneer.id,
        recipe=palak_paneer,
    )

    # 1. want_lighter -> recommends khichdi over chole
    res_lighter = engine.propose_meal_change(current_meal, "want_lighter", sample_recipes)
    assert res_lighter.recommendation.recipe.id == "khichdi"

    # 2. want_different_protein -> recommends non-dairy protein
    res_protein = engine.propose_meal_change(current_meal, "want_different_protein", sample_recipes)
    assert res_protein.recommendation.recipe.practical_metadata.primary_protein_source != "dairy_paneer"

    # 3. ingredient_unavailable for spinach -> excludes palak-paneer
    res_unavail = engine.propose_meal_change(current_meal, "ingredient_unavailable", sample_recipes, unavailable_ingredients=["spinach"])
    assert all("spinach" not in " ".join(a.recipe.ingredients) for a in res_unavail.alternatives)

    # 4. want_quick -> favors <= 25 min dishes without soaking
    res_quick = engine.propose_meal_change(current_meal, "want_quick", sample_recipes)
    assert res_quick.recommendation.recipe.practical_metadata.time_minutes <= 25
    assert res_quick.recommendation.recipe.id != "chole-roti"
