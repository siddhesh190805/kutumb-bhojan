import test from 'node:test';
import assert from 'node:assert/strict';
import plansHandler from '../api/planning/plans.js';
import mealChangeHandler from '../api/planning/meal-change.js';
import ttsSpeakHandler from '../api/tts/speak.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

test('API: POST /api/planning/plans rejects non-POST requests with 405', async () => {
  const req = { method: 'GET' };
  const res = createMockRes();
  await plansHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'Method Not Allowed');
});

test('API: POST /api/planning/plans generates a multi-day plan', async () => {
  const req = {
    method: 'POST',
    body: {
      startDate: '2026-09-07',
      visibleDays: 3,
      candidateRecipes: [
        { id: 'poha', name: 'Kanda Poha', course: 'Breakfast', ingredients: ['poha', 'onion'] },
        { id: 'chole', name: 'Chole + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas', 'roti'] },
        { id: 'khichdi', name: 'Moong Khichdi', course: 'Lunch/Dinner', ingredients: ['moong dal', 'rice'] },
        { id: 'peanuts', name: 'Roasted Peanuts', course: 'Snack', ingredients: ['peanuts'] }
      ]
    }
  };
  const res = createMockRes();
  await plansHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.plan.length, 3 * 4); // 3 days * 4 slots
  assert.equal(res.body.evaluationSummary.totalMealsPlanned, 12);
});

test('API: POST /api/planning/meal-change rejects missing currentMeal with 400', async () => {
  const req = { method: 'POST', body: {} };
  const res = createMockRes();
  await mealChangeHandler(req, res);
  assert.equal(res.statusCode, 400);
});

test('API: POST /api/planning/meal-change suggests reason-aware alternative', async () => {
  const req = {
    method: 'POST',
    body: {
      currentMeal: {
        date: '2026-09-07',
        slot: 'Dinner',
        recipeId: 'chole',
        recipe: { id: 'chole', name: 'Chole + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas', 'roti'] }
      },
      reason: 'want_lighter',
      candidateRecipes: [
        { id: 'chole', name: 'Chole + Roti', course: 'Lunch/Dinner', ingredients: ['chickpeas', 'roti'] },
        { id: 'khichdi', name: 'Moong Khichdi + Curd', course: 'Lunch/Dinner', ingredients: ['moong dal', 'rice', 'curd'] }
      ]
    }
  };
  const res = createMockRes();
  await mealChangeHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.recommendation.recipe.id, 'khichdi');
});

test('API: POST /api/tts/speak returns SpeechSynthesis fallback when no API key configured', async () => {
  const req = {
    method: 'POST',
    body: { text: 'आज रात्री मूग डाळ खिचडी आणि दही', language: 'mr-IN' }
  };
  const res = createMockRes();
  await ttsSpeakHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.fallback, true);
  assert.equal(res.body.language, 'mr-IN');
});
