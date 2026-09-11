"""
Member-level diversity + same-day diversity regression.
"""
from backend.app.domain.models import Recipe, FamilyMember, DerivedRecipeFoodProfile, PracticalMetadata
from backend.app.planning.diversity import RollingDiversityTracker


def _recipe(rid: str, legume: str, grain: str = "wheat", form: str = "curry_sabji", veg: str | None = None) -> Recipe:
    fp = DerivedRecipeFoodProfile(
        legume_identities=frozenset({legume}) if legume else frozenset(),
        grain_identities=frozenset({grain}) if grain != "none" else frozenset(),
        vegetable_identities=frozenset({veg}) if veg else frozenset(),
        has_whole_grain_or_millet=(grain == "millet"),
    )
    return Recipe(
        id=rid,
        name=rid,
        marathi_name=rid,
        course="Lunch/Dinner",
        practical_metadata=PracticalMetadata(meal_form=form, primary_grain=grain, primary_protein_source="legume", time_minutes=30),
        food_profile=fp,
    )


def test_member_history_divergence():
    """Day1 egg primary vs alternate creates divergent member histories."""
    # Simulate: primary Egg Curry (egg) vs alternate Moong Dal (moong)
    egg_recipe = Recipe(id="egg-curry", name="Egg Curry", marathi_name="अंडा करी", course="Lunch/Dinner", practical_metadata=PracticalMetadata(meal_form="curry_sabji", primary_grain="wheat", time_minutes=30))
    egg_recipe.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"egg"}), grain_identities=frozenset({"wheat"}))
    egg_recipe.dietary_flags.contains_egg = True
    egg_recipe.dietary_flags.vegetarian = False

    alt_recipe = _recipe("moong-dal", "moong")
    alt_recipe.dietary_flags.contains_egg = False
    alt_recipe.dietary_flags.vegetarian = True

    # Build per-member histories as planning.py does
    member_histories = {
        "siddhesh": {"2026-09-12-Lunch": egg_recipe},
        "tejas": {"2026-09-12-Lunch": egg_recipe},
        "vikas": {"2026-09-12-Lunch": alt_recipe},
        "namrata": {"2026-09-12-Lunch": alt_recipe},
    }
    # Verify alternate represented
    assert member_histories["vikas"]["2026-09-12-Lunch"].id == "moong-dal"
    assert member_histories["siddhesh"]["2026-09-12-Lunch"].id == "egg-curry"
    # Verify histories differ
    assert member_histories["vikas"] != member_histories["siddhesh"]
    # Verify diversity tracker for Vikas would see moong, not egg
    tracker_vikas = RollingDiversityTracker(member_histories["vikas"])
    tracker_siddhesh = RollingDiversityTracker(member_histories["siddhesh"])
    # Candidate with moong should be penalized for Vikas (same pulse yesterday) but not Siddhesh
    cand_moong = _recipe("cand-moong", "moong")
    delta_vikas, _, pen_vikas = tracker_vikas.evaluate_candidate_diversity(cand_moong, "Lunch", "2026-09-13")
    delta_sidd, _, pen_sidd = tracker_siddhesh.evaluate_candidate_diversity(cand_moong, "Lunch", "2026-09-13")
    assert any("Same pulse" in p for p in pen_vikas)
    assert not any("Same pulse" in p for p in pen_sidd)


def test_same_day_pulse_penalty():
    """Lunch -> Dinner same day same pulse diff=0 must penalize."""
    moong_lunch = _recipe("r-moong", "moong")
    tracker = RollingDiversityTracker()
    tracker.record_meal("2026-09-12", "Lunch", moong_lunch)
    # Evaluate same pulse for dinner same day
    cand = _recipe("r-moong2", "moong")
    delta, _, penalties = tracker.evaluate_candidate_diversity(cand, "Dinner", "2026-09-12")
    assert delta < 0
    assert any("earlier today" in p for p in penalties)


def test_same_day_grain_and_vegetable_diversity():
    """Same-day vegetable/millet context must be considered."""
    wheat_lunch = _recipe("r-wheat", "moong", grain="wheat")
    tracker = RollingDiversityTracker()
    tracker.record_meal("2026-09-12", "Lunch", wheat_lunch)
    # Millet candidate should still get bonus because lunch was wheat not millet
    millet_cand = _recipe("r-millet", "chana", grain="millet", form="curry_sabji")
    millet_cand.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"chana"}), grain_identities=frozenset({"jowar"}), has_whole_grain_or_millet=True)
    delta, pos, _ = tracker.evaluate_candidate_diversity(millet_cand, "Dinner", "2026-09-12")
    assert delta > 0 or any("millet" in p.lower() for p in pos)


def test_same_day_vegetable_category_balance():
    veg1 = _recipe("r1", "moong", veg="spinach")
    veg1.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"moong"}), vegetable_identities=frozenset({"spinach"}))
    tracker = RollingDiversityTracker()
    tracker.record_meal("2026-09-12", "Lunch", veg1)
    # Same veg category next meal should NOT get bonus
    cand_same = _recipe("r2", "chana", veg="spinach")
    cand_same.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"chana"}), vegetable_identities=frozenset({"spinach"}))
    delta_same, pos_same, _ = tracker.evaluate_candidate_diversity(cand_same, "Dinner", "2026-09-12")
    # New veg should get bonus
    cand_new = _recipe("r3", "matki", veg="carrot")
    cand_new.food_profile = DerivedRecipeFoodProfile(legume_identities=frozenset({"matki"}), vegetable_identities=frozenset({"carrot"}))
    delta_new, pos_new, _ = tracker.evaluate_candidate_diversity(cand_new, "Dinner", "2026-09-12")
    # At least new veg gets more bonus than same veg
    assert delta_new >= delta_same
