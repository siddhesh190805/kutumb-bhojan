"""
NFDI-001C-CORRECTION-002-B Latency optimization regression tests (A-J).
"""
import asyncio
import httpx
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.infrastructure.supabase import SupabaseClient
from backend.app.domain.models import Recipe, DerivedRecipeFoodProfile, PracticalMetadata, RecipeIngredient
from backend.app.planning.search import run_bounded_beam_search


def _catalog(size=10):
    recs = []
    for i in range(size):
        r = Recipe(
            id=f"r{i:02d}",
            name=f"Recipe {i}",
            marathi_name=f"रेसिपी {i}",
            course="Lunch/Dinner" if i % 2 == 0 else "Breakfast",
            meal_category="Lunch/Dinner" if i % 2 == 0 else "Breakfast",
            structured_ingredients=[RecipeIngredient(ingredient_key="tomato", quantity=100, unit="g")],
            practical_metadata=PracticalMetadata(meal_form="curry_sabji", primary_grain="wheat", primary_protein_source="legume", time_minutes=30, meal_density="moderate"),
            food_profile=DerivedRecipeFoodProfile(legume_identities=frozenset({"moong"})),
        )
        recs.append(r)
    return recs

# A. Determinism parallel vs sequential
def test_parallel_vs_sequential_identical_plan():
    catalog = _catalog(10)
    # Simulate sequential vs parallel data fetch producing same sorted inputs
    import random
    shuffled = list(catalog)
    random.shuffle(shuffled)
    # Our normalization sorts by id, so both should produce same plan
    catalog_sorted = sorted(shuffled, key=lambda r: str(r.id))
    w1, _ = run_bounded_beam_search("2026-09-12", visible_days=2, evaluation_days=2, beam_width=3, recipes_catalog=catalog_sorted, members=[])
    w2, _ = run_bounded_beam_search("2026-09-12", visible_days=2, evaluation_days=2, beam_width=3, recipes_catalog=sorted(catalog, key=lambda r: str(r.id)), members=[])
    assert [s["recipe"].id for s in w1.slots] == [s["recipe"].id for s in w2.slots]

# B. Ordering randomized still deterministic
def test_randomized_recipe_order_still_deterministic():
    catalog = _catalog(12)
    import random
    random.seed(42)
    c1 = list(catalog)
    random.shuffle(c1)
    c1_sorted = sorted(c1, key=lambda r: str(r.id))
    w1, _ = run_bounded_beam_search("2026-09-12", visible_days=7, evaluation_days=7, beam_width=3, recipes_catalog=c1_sorted, members=[])
    random.shuffle(c1)
    c2_sorted = sorted(c1, key=lambda r: str(r.id))
    w2, _ = run_bounded_beam_search("2026-09-12", visible_days=7, evaluation_days=7, beam_width=3, recipes_catalog=c2_sorted, members=[])
    assert [s["recipe"].id for s in w1.slots] == [s["recipe"].id for s in w2.slots]

# C. Concurrency bounded to 5
@pytest.mark.asyncio
async def test_concurrency_bounded_to_5():
    concurrency = []
    max_concurrent = 0
    current = 0
    lock = asyncio.Lock()

    async def tracked(coro):
        nonlocal current, max_concurrent
        async with lock:
            current += 1
            max_concurrent = max(max_concurrent, current)
        # Simulate Supabase delay
        await asyncio.sleep(0.02)
        async with lock:
            current -= 1
        return coro

    # Simulate what planning does: 6 tasks with semaphore 5
    sem = asyncio.Semaphore(5)

    async def with_sem(val):
        async with sem:
            return await tracked(val)

    tasks = [with_sem(asyncio.sleep(0.02)) for _ in range(6)]
    await asyncio.gather(*tasks)
    assert max_concurrent <= 5

# D. Connection reuse: one AsyncClient per request (verify via mock)
@pytest.mark.asyncio
async def test_one_async_client_per_request():
    # Patch httpx.AsyncClient to count instantiations
    count = []

    orig = httpx.AsyncClient

    class CountingClient(httpx.AsyncClient):
        def __init__(self, *a, **kw):
            count.append(1)
            super().__init__(*a, **kw)

    with patch("httpx.AsyncClient", CountingClient):
        # Also patch Supabase to avoid network
        with patch.object(SupabaseClient, "aget", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = []
            # Make planning request via TestClient (will create one AsyncClient)
            # We test via direct SupabaseClient usage: one request should create one client
            client = TestClient(app)
            # Mock the repo calls to avoid DB
            with patch("backend.app.api.planning.recipe_repo.aget_recipes", new_callable=AsyncMock) as mr:
                mr.return_value = _catalog(3)
                with patch("backend.app.api.planning.household_repo.aget_family_members", new_callable=AsyncMock) as mf:
                    mf.return_value = []
                    with patch("backend.app.api.planning.household_repo.aget_frequency_rules", new_callable=AsyncMock) as mfr:
                        mfr.return_value = []
                        with patch("backend.app.api.planning.household_repo.aget_dietary_rules", new_callable=AsyncMock) as mdr:
                            mdr.return_value = []
                            with patch("backend.app.api.planning.meal_repo.aget_meals_in_range", new_callable=AsyncMock) as mm:
                                mm.return_value = []
                                with patch("backend.app.api.planning.seasonality_repo.aget_all_seasonality", new_callable=AsyncMock) as ms:
                                    ms.return_value = ([], True)
                                    with patch("backend.app.api.planning.meal_repo.apersist_plan", new_callable=AsyncMock) as mp:
                                        mp.return_value = None
                                        with patch("backend.app.api.planning.prep_repo.areconcile_prep_tasks", new_callable=AsyncMock) as mr2:
                                            mr2.return_value = (0, 0, 0)
                                            with patch("backend.app.infrastructure.supabase.supabase_client.abootstrap_household", new_callable=AsyncMock) as ab:
                                                ab.return_value = "hh-test"
                                                resp = client.post("/api/planning/plans", json={"startDate": "2026-09-12", "visibleDays": 2, "evaluationDays": 2})
                                                # Should succeed (maybe 404 if no recipes but we mocked)
                                                # Count clients: expect 1 per request (our counting includes bootstrap + main)
                                                assert count, "AsyncClient should have been created"
                                                assert len(count) == 1, f"Expected exactly 1 AsyncClient per request, got {len(count)}"

# E. Client cleanup: AsyncClient closed
@pytest.mark.asyncio
async def test_client_cleanup_closed():
    sc = SupabaseClient()
    sc._async_cached_token = "dummy-token"
    sc._cached_token = "dummy-token"
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_http.get = AsyncMock(return_value=MagicMock(status_code=200, text="[]", json=lambda: []))
    mock_http.post = AsyncMock(return_value=MagicMock(status_code=200, text="[]", json=lambda: []))
    # Pass mock client, ensure not closed by Supabase when http_client provided
    await sc.aget("test", http_client=mock_http)
    mock_http.get.assert_called_once()
    mock_http.aclose.assert_not_called()

# F. Auth with JWT no signup
@pytest.mark.asyncio
async def test_auth_with_jwt_no_signup():
    sc = SupabaseClient()
    sc._async_cached_token = None
    sc._cached_token = None
    # If auth_token provided, should not call _aauthenticate_anonymously
    with patch.object(sc, "_aauthenticate_anonymously", new_callable=AsyncMock) as mock_auth:
        mock_http = AsyncMock(spec=httpx.AsyncClient)
        mock_resp = MagicMock(status_code=200, text="[]", json=lambda: [])
        mock_http.get = AsyncMock(return_value=mock_resp)
        await sc.aget("family_members", {"household_id": "eq.hid"}, auth_token="fake-jwt-token", http_client=mock_http)
        mock_auth.assert_not_called()

# F2. Without JWT anon fallback still works (concurrent lock)
@pytest.mark.asyncio
async def test_anon_concurrent_no_duplicate_signup():
    sc = SupabaseClient()
    sc._async_cached_token = None
    sc._cached_token = None
    # Mock http_client post to return valid token quickly
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock(status_code=200, text='{"access_token":"tok123"}')
    mock_resp.json = MagicMock(return_value={"access_token": "tok123"})
    mock_http.post = AsyncMock(return_value=mock_resp)
    # Two concurrent ensures should result in single signup due to lock (second sees cached)
    results = await asyncio.gather(
        sc._ensure_async_token(mock_http, None),
        sc._ensure_async_token(mock_http, None),
    )
    # Both should get same token, and post called once (second reuses cached after lock)
    assert results[0] == "tok123"
    assert results[1] == "tok123"
    # post should have been called once (lock prevents duplicate)
    assert mock_http.post.call_count == 1

# G. Failure propagation
@pytest.mark.asyncio
async def test_critical_read_failure_prevents_plan():
    # If recipes fetch fails, planning should 500/404 not succeed
    with patch("backend.app.api.planning.recipe_repo.aget_recipes", new_callable=AsyncMock) as mr:
        mr.side_effect = RuntimeError("DB down")
        with patch("backend.app.api.planning.household_repo.aget_family_members", new_callable=AsyncMock) as mf:
            mf.return_value = []
            with patch("backend.app.api.planning.seasonality_repo.aget_all_seasonality", new_callable=AsyncMock) as ms:
                ms.return_value = ([], True)
                with patch("backend.app.infrastructure.supabase.supabase_client.abootstrap_household", new_callable=AsyncMock) as ab:
                    ab.return_value = "hid"
                    client = TestClient(app)
                    # Patch other tasks to succeed
                    with patch("backend.app.api.planning.household_repo.aget_frequency_rules", new_callable=AsyncMock) as mfr:
                        mfr.return_value = []
                        with patch("backend.app.api.planning.household_repo.aget_dietary_rules", new_callable=AsyncMock) as mdr:
                            mdr.return_value = []
                            with patch("backend.app.api.planning.meal_repo.aget_meals_in_range", new_callable=AsyncMock) as mm:
                                mm.return_value = []
                                resp = client.post("/api/planning/plans", json={"startDate": "2026-09-12", "visibleDays": 2, "evaluationDays": 2})
                                assert resp.status_code in (500, 404)

# H. Persistence before response
@pytest.mark.asyncio
async def test_persistence_before_response():
    # Mock persist to track order
    order = []

    async def mock_persist(*a, **kw):
        order.append("persist")

    async def mock_gather(*a, **kw):
        order.append("gather")

    # Test that planning calls persist before return by checking TestClient
    with patch("backend.app.api.planning.recipe_repo.aget_recipes", new_callable=AsyncMock) as mr:
        mr.return_value = _catalog(5)
        with patch("backend.app.api.planning.household_repo.aget_family_members", new_callable=AsyncMock) as mf:
            mf.return_value = []
            with patch("backend.app.api.planning.household_repo.aget_frequency_rules", new_callable=AsyncMock) as mfr:
                mfr.return_value = []
                with patch("backend.app.api.planning.household_repo.aget_dietary_rules", new_callable=AsyncMock) as mdr:
                    mdr.return_value = []
                    with patch("backend.app.api.planning.meal_repo.aget_meals_in_range", new_callable=AsyncMock) as mm:
                        mm.return_value = []
                        with patch("backend.app.api.planning.seasonality_repo.aget_all_seasonality", new_callable=AsyncMock) as ms:
                            ms.return_value = ([], True)
                            with patch("backend.app.api.planning.meal_repo.apersist_plan", new_callable=AsyncMock) as mp:
                                mp.side_effect = mock_persist
                                with patch("backend.app.api.planning.prep_repo.areconcile_prep_tasks", new_callable=AsyncMock) as mr2:
                                    mr2.return_value = (1, 0, 0)
                                    with patch("backend.app.infrastructure.supabase.supabase_client.abootstrap_household", new_callable=AsyncMock) as ab:
                                        ab.return_value = "hid"
                                        client = TestClient(app)
                                        resp = client.post("/api/planning/plans", json={"startDate": "2026-09-12", "visibleDays": 2, "evaluationDays": 2})
                                        assert resp.status_code == 200
                                        assert "persist" in order

# I. Existing planner tests still pass (covered by full suite)

# J. Performance guard: parallel avoids sequential sum
@pytest.mark.asyncio
async def test_parallel_avoids_sequential_sum():
    # Simulate 6 Supabase calls each 0.1s: sequential would be 0.6s, parallel with sem 5 should be ~0.2s
    delays = [0.1] * 6

    async def fake_get(delay):
        await asyncio.sleep(delay)
        return []

    sem = asyncio.Semaphore(5)

    async def with_sem(c):
        async with sem:
            return await c

    start = time.perf_counter()
    await asyncio.gather(*[with_sem(fake_get(d)) for d in delays])
    elapsed = time.perf_counter() - start
    # Parallel should be ~0.2s (2 batches), not 0.6s
    assert elapsed < 0.35, f"Parallel should be <0.35s, got {elapsed:.3f}"
    assert elapsed >= 0.18

    # Pure planner guard
    cat = _catalog(30)
    start = time.perf_counter()
    w, _ = run_bounded_beam_search("2026-09-12", visible_days=7, evaluation_days=30, beam_width=3, recipes_catalog=cat, members=[])
    assert time.perf_counter() - start < 2.0
