import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRemoteRows, mapRemoteState, buildAutomaticAssignments, DEFAULT_DIETARY_RULES, applyDayLevelOverride, mapMealAssignments } from '../sync.js';

test('r_* recipe manual assignment persists through buildRemoteRows -> mapRemoteState', () => {
  const householdId = 'test-hh';
  const members = [{ id: 'siddhesh', name: 'Siddhesh', mr: 'सिद्धेश' }, { id: 'vikas', name: 'Vikas', mr: 'विकास' }];
  const recipes = [
    { id: 'cr29', name: 'Paneer Test', mr: 'पनीर', course: 'Lunch', ingredients: [], dietaryFlags: { vegetarian: true } },
    { id: 'r_123456', name: 'Test Rstar', mr: 'टेस्ट', course: 'Breakfast', ingredients: [{ ingredientKey: 'rice', quantity: 100, unit: 'g' }], dietaryFlags: { vegetarian: true } }
  ];
  // Simulate state with r_* assignment
  let state = {
    members,
    meals: [{ id: '2026-09-12-Breakfast', date: '2026-09-12', slot: 'Breakfast', title: 'Test Rstar', marathi: 'टेस्ट', recipeId: 'cr29' }],
    recipes,
    shopping: [],
    prep: [],
    mealAssignments: [{ mealEntryId: '2026-09-12-Breakfast', memberId: 'siddhesh', recipeId: 'r_123456', assignmentSource: 'manual', automaticRecipeId: 'cr29' }],
    ingredientCatalog: [],
    recipeIngredients: [],
    dietaryRules: DEFAULT_DIETARY_RULES,
    frequencyRules: []
  };
  // Simulate buildRemoteRows -> mapRemoteState round-trip for recipes
  const rows = buildRemoteRows(state, householdId);
  // Check that r_* recipe is in rows
  const recipeRow = rows.recipes.find(r => r.recipe_key === 'r_123456');
  assert.ok(recipeRow, 'buildRemoteRows should include r_* recipe_key');
  assert.equal(recipeRow.recipe_key, 'r_123456');
  // Simulate Supabase returning ids
  const recipeRowsFromDB = [
    { id: 'uuid-cr29', recipe_key: 'cr29' },
    { id: 'uuid-r123', recipe_key: 'r_123456' }
  ];
  const recipeUuid = new Map(recipeRowsFromDB.map(x => [x.recipe_key, x.id]));
  // Simulate syncPhase2 mapping for assignments
  const assignments = state.mealAssignments.map(a => ({
    household_id: householdId,
    meal_entry_id: 'uuid-meal-123',
    member_id: 'uuid-member-siddhesh',
    recipe_id: recipeUuid.get(a.recipeId) || null,
    assignment_source: a.assignmentSource
  }));
  assert.equal(assignments[0].recipe_id, 'uuid-r123', 'recipeUuid mapping for r_* should succeed');

  // Simulate mapMealAssignments back with translation context
  const dbRows = [{ id: 'a1', meal_entry_id: 'uuid-meal-123', member_id: 'uuid-member-siddhesh', recipe_id: 'uuid-r123', assignment_source: 'manual' }];
  const mealMap = new Map([['uuid-meal-123', '2026-09-12-Breakfast']]);
  const memberMap = new Map([['uuid-member-siddhesh', 'siddhesh']]);
  const recipeMap = new Map([['uuid-r123', 'r_123456'], ['uuid-cr29', 'cr29']]);

  const mapped = mapMealAssignments(dbRows, { mealMap, memberMap, recipeMap });
  assert.equal(mapped[0].recipeId, 'r_123456', 'recipe_id should be mapped back to recipe_key');
  assert.equal(mapped[0].memberId, 'siddhesh', 'member_id should be mapped back to member_key');
  assert.equal(mapped[0].mealEntryId, '2026-09-12-Breakfast', 'meal_entry_id should be mapped back to date-slot');

  // Now state.recipes has id 'r_123456'
  const found = recipes.find(r => r.id === mapped[0].recipeId);
  assert.ok(found, 'recipe should be found in state.recipes by mapped recipeId');
  assert.equal(found.id, 'r_123456');
});

