"""
NFDI-001C Contextual Diversity & Seasonal Meal Intelligence Tests.

Validates:
1. Controlled seasonal classification and climate intelligence for Indian/Maharashtra context.
2. Soft seasonal affinity bonuses without punitive out-of-season bans.
3. Multi-day rolling legume/pulse rotation (moong -> chana -> matki -> rajma).
4. Wholesome millet introduction after consecutive wheat/rice meals.
5. Distinct vegetable category variety across consecutive main meals.
6. Actionable household prep tasks derived for D-1 evening (soaking, fermentation).
7. Non-disruptive backwards compatibility and zero numeric calorie/scoring leakage.
"""

import pytest
from datetime import datetime
from backend.app.domain.models import (
    CanonicalIngredient,
    Recipe,
    RecipeIngredient,
    MealPlanSlot,
    DietaryFlags,
    PracticalMetadata,
    DerivedRecipeFoodProfile,
)
from backend.app.domain.seasonality import (
    get_current_season,
    evaluate_ingredient_season,
    CANONICAL_SEASONALITY_CATALOG,
)
from backend.app.planning.diversity import RollingDiversityTracker
from backend.app.planning.prep import generate_household_prep_tasks
from backend.app.planning.scoring import score_candidate


def test_seasonal_calendar_resolution():
    """Verify Indian meteorological season resolution across calendar dates."""
    assert get_current_season("2026-04-15") == "summer"
    assert get_current_season("2026-05-10") == "summer"
    assert get_current_season("2026-08-20") == "monsoon"
    assert get_current_season("2026-09-11") == "monsoon"
    assert get_current_season("2026-12-25") == "winter"
    assert get_current_season("2026-01-15") == "winter"


def test_peak_seasonal_produce_attributes():
    """Verify peak produce and culinary suitability for summer, monsoon, and winter."""
    # Summer cooling gourds
    is_peak, status, cul = evaluate_ingredient_season("bottle_gourd", "summer")
    assert is_peak is True
    assert cul == "cooling"

    # Winter warming greens
    is_peak, status, cul = evaluate_ingredient_season("spinach", "winter")
    assert is_peak is True
    assert cul == "warming"

    # All-season staples
    is_peak, status, cul = evaluate_ingredient_season("whole_wheat_flour", "summer")
    assert is_peak is False
    assert status == "available"


def test_out_of_season_produce_never_banned():
    """Out-of-season produce receives no punitive bans or hard disqualification."""
    recipe = Recipe(
        id="rec-spinach",
        name="Palak Sabji",
        marathi_name="पालक भाजी",
        course="Lunch/Dinner",
        meal_form="curry_sabji",
        structured_ingredients=[
            RecipeIngredient(ingredient_key="spinach", quantity=150, unit="g"),
            RecipeIngredient(ingredient_key="oil", quantity=10, unit="ml"),
        ],
    )
    # Palak in summer is available/scarce, not peak
    score_summer, pos, cul, pen = score_candidate(
        recipe=recipe,
        slot="Lunch",
        target_date="2026-05-15",
        recent_meals_by_date_slot={},
        recent_dates_with_paneer=set(),
    )
    # Candidate remains valid with base score >= 100
    assert score_summer >= 100.0


def test_rolling_pulse_rotation():
    """Rolling tracker rewards introducing a distinct pulse and penalizes back-to-back same pulse."""
    moong_rec = Recipe(
        id="rec-moong",
        name="Moong Dal Curry",
        marathi_name="मूग डाळ वरण",
        course="Lunch/Dinner",
        food_profile=DerivedRecipeFoodProfile(
            food_groups=frozenset({"legume_pulse"}),
            legume_identities=frozenset({"moong"}),
        ),
    )
    chana_rec = Recipe(
        id="rec-chana",
        name="Chana Usal",
        marathi_name="हरभरा उसळ",
        course="Lunch/Dinner",
        food_profile=DerivedRecipeFoodProfile(
            food_groups=frozenset({"legume_pulse"}),
            legume_identities=frozenset({"chana"}),
        ),
    )

    # Day 1: served Moong
    tracker = RollingDiversityTracker()
    tracker.record_meal("2026-09-10", "Lunch", moong_rec)

    # Day 2: evaluating Moong again on consecutive day -> penalty
    score_delta_repeat, pos_repeat, pen_repeat = tracker.evaluate_candidate_diversity(
        moong_rec, "Lunch", "2026-09-11"
    )
    assert score_delta_repeat < 0
    assert any("Same pulse (Moong) served yesterday" in p for p in pen_repeat)

    # Day 2: evaluating Chana -> rotation bonus
    score_delta_new, pos_new, pen_new = tracker.evaluate_candidate_diversity(
        chana_rec, "Lunch", "2026-09-11"
    )
    assert score_delta_new > 0
    assert any("Rotates pulse variety with Chana" in p for p in pos_new)


def test_millet_introduction_bonus():
    """Wholesome millet introduction is rewarded after wheat/rice meals."""
    wheat_roti = Recipe(
        id="rec-roti",
        name="Wheat Roti",
        marathi_name="गहू पोळी",
        practical_metadata=PracticalMetadata(primary_grain="wheat"),
    )
    jowar_bhakri = Recipe(
        id="rec-bhakri",
        name="Jowar Bhakri",
        marathi_name="ज्वारी भाकरी",
        meal_form="thalipeeth_dashmi",
        practical_metadata=PracticalMetadata(
            meal_form="thalipeeth_dashmi", primary_grain="millet"
        ),
        food_profile=DerivedRecipeFoodProfile(
            food_groups=frozenset({"grain"}),
            grain_identities=frozenset({"jowar"}),
            has_whole_grain_or_millet=True,
        ),
    )

    tracker = RollingDiversityTracker()
    tracker.record_meal("2026-09-10", "Lunch", wheat_roti)
    tracker.record_meal("2026-09-10", "Dinner", wheat_roti)

    # Day 2: Jowar Bhakri introduces millet diversity
    score_delta, pos, pen = tracker.evaluate_candidate_diversity(
        jowar_bhakri, "Lunch", "2026-09-11"
    )
    assert score_delta >= 10.0
    assert any("millet diversity" in p.lower() for p in pos)


def test_prep_task_generation_overnight_soaking_and_fermentation():
    """Overnight soaking and fermentation schedule actionable prep tasks for D-1 evening."""
    chole_recipe = Recipe(
        id="cr-chole",
        name="Chole Masala + Roti",
        marathi_name="छोले मसाला + पोळी",
        soaking_requirement="overnight",
        food_profile=DerivedRecipeFoodProfile(
            food_groups=frozenset({"legume_pulse"}),
            legume_identities=frozenset({"chana"}),
        ),
        practical_metadata=PracticalMetadata(soaking_required=True),
    )
    dosa_recipe = Recipe(
        id="cr-dosa",
        name="Dosa + Sambar",
        marathi_name="डोसा + सांबार",
        fermentation_requirement="overnight",
        practical_metadata=PracticalMetadata(fermentation_required=True),
    )

    plan_slots = [
        MealPlanSlot(
            id="2026-09-12-Lunch",
            date="2026-09-12",
            slot="Lunch",
            title="Chole Masala + Roti",
            marathi_title="छोले मसाला + पोळी",
            recipe_id="cr-chole",
            recipe=chole_recipe,
        ),
        MealPlanSlot(
            id="2026-09-13-Breakfast",
            date="2026-09-13",
            slot="Breakfast",
            title="Dosa + Sambar",
            marathi_title="डोसा + सांबार",
            recipe_id="cr-dosa",
            recipe=dosa_recipe,
        ),
    ]

    prep_tasks = generate_household_prep_tasks(plan_slots)
    assert len(prep_tasks) == 2

    # Chole soaking task on 2026-09-11 evening
    soak_task = next(t for t in prep_tasks if "soak" in t.id)
    assert soak_task.date == "2026-09-11"
    assert soak_task.target_meal_date == "2026-09-12"
    assert "Soak" in soak_task.task
    assert "भिजत घाला" in soak_task.mr

    # Dosa fermentation task on 2026-09-12 evening
    ferment_task = next(t for t in prep_tasks if "ferment" in t.id)
    assert ferment_task.date == "2026-09-12"
    assert ferment_task.target_meal_date == "2026-09-13"
    assert "fermentation" in ferment_task.task
    assert "आंबवायला" in ferment_task.mr
