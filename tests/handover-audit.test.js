const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');

test('HANDOVER-001: Browser boot requests server plan from POST /api/planning/plans', () => {
  assert.match(appSource, /fetch\(\s*['"]\/api\/planning\/plans['"]/);
  assert.match(appSource, /POST/);
  assert.match(appSource, /household_id:\s*remoteHouseholdId/);
});

test('HANDOVER-001: Browser does not execute generatePlan in app.js', () => {
  assert.doesNotMatch(appSource, /\bgeneratePlan\s*\(/);
});

test('HANDOVER-001: Browser does not fall back to proposeMealChange in app.js', () => {
  assert.doesNotMatch(appSource, /\bproposeMealChange\s*\(/);
});

test('HANDOVER-001: No hardcoded canonical recipe catalog in app.js', () => {
  assert.doesNotMatch(appSource, /const\s+recipes\s*=\s*\[/);
  assert.doesNotMatch(appSource, /const\s+calendarRecipeData\s*=\s*\[/);
  assert.doesNotMatch(appSource, /const\s+calendarRecipeObj\s*=/);
  assert.doesNotMatch(appSource, /const\s+recipeObj\s*=/);
});

test('HANDOVER-001: No hardcoded canonical family catalog in app.js', () => {
  assert.doesNotMatch(appSource, /const\s+family\s*=\s*\[/);
});

test('HANDOVER-001: Shopping UI consumes backend-derived result from state.derivedShopping', () => {
  assert.match(appSource, /state\.derivedShopping/);
  assert.match(appSource, /loadDerivedShopping/);
  assert.match(appSource, /\/api\/shopping\/derived/);
  // Ensure shopping() does not derive quantities locally
  const shoppingFn = appSource.match(/function\s+shopping\s*\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(shoppingFn, /buildShoppingFromAssignments/);
});

test('HANDOVER-001: Meal change calls backend POST /api/planning/meal-change with no client planner fallback', () => {
  assert.match(appSource, /fetch\(\s*['"]\/api\/planning\/meal-change['"]/);
  const applyReasonBlock = appSource.match(/data-apply-reason[\s\S]*?toast\(/)?.[0] || '';
  assert.doesNotMatch(applyReasonBlock, /proposeMealChange/);
});

test('HANDOVER-001: Forbidden terminology is completely removed from app.js and sync.js', () => {
  assert.doesNotMatch(appSource, /digestive\s+balance/i);
  assert.doesNotMatch(appSource, /digestive\s+profile/i);
  assert.doesNotMatch(syncSource, /digestive\s+balance/i);
  assert.doesNotMatch(syncSource, /digestive\s+profile/i);
});
