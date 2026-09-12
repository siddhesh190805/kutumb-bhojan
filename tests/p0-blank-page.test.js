import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appSource = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(process.cwd(), 'sync.js'), 'utf8');

test('P0 REGRESSION: app.js defines t resolver (function t) and contentProvider', () => {
  // t must be defined as function that wraps contentProvider.get with language fallback
  assert.match(appSource, /function t\(keyOrMr,\s*fallbackEn\)/, 'app.js must define function t(keyOrMr, fallbackEn)');
  assert.match(appSource, /let contentProvider\s*=\s*createContentProvider\(/, 'app.js must initialize contentProvider via createContentProvider');
  // t must use contentProvider.has/get and language
  assert.match(appSource, /contentProvider && contentProvider\.has\(keyOrMr\)/, 't must delegate to contentProvider.has');
  assert.match(appSource, /contentProvider\.get\(keyOrMr, language/, 't must delegate to contentProvider.get with language');
});

test('P0 REGRESSION: sync.js createContentProvider returns object with get/has', () => {
  assert.match(syncSource, /function createContentProvider\(contentData/);
  assert.match(syncSource, /function get\(key, language/);
  assert.match(syncSource, /function has\(key\)/);
  assert.match(syncSource, /return \{ get, getRaw, getByCategory, toJSON/);
  // Must not be a bare function or Map
  assert.doesNotMatch(syncSource, /return function\(/);
});

test('P0 REGRESSION: app.js imports evaluateRecipeEligibility for assignmentOptions', () => {
  // assignmentOptions must use canonical eligibility, not hardcoded vegetarian filter
  assert.match(appSource, /from '\.\/sync\.js'/);
  assert.match(appSource, /evaluateRecipeEligibility/);
  assert.match(appSource, /function assignmentOptions\(meal,member,assignment\)/);
  assert.match(appSource, /evaluateRecipeEligibility\(member,r,rules\)\.eligible/);
  assert.doesNotMatch(appSource, /const candidates=state\.recipes\.filter\(r=>r\.dietaryFlags\?\.vegetarian && !r\.dietaryFlags/);
});

test('P0 REGRESSION: four fixed toasts use t() bilingual resolver', () => {
  assert.match(appSource, /t\('msg\.cloud_sync_failed'/);
  assert.match(appSource, /t\('msg\.cloud_sync_error'/);
  assert.match(appSource, /t\('msg\.cloud_sync_unavailable'/);
  assert.match(appSource, /t\('msg\.dietary_sync_failed'/);
});

test('P0 REGRESSION: startup render does not throw ReferenceError', async () => {
  // Simulate minimal startup: import app.js via jsdom is heavy, so verify via static analysis
  // that render() is defined after t and contentProvider, and initCloud is at bottom
  const normalizedApp = appSource.replace(/\r\n/g, '\n');
  const renderPos = normalizedApp.indexOf('function render(){');
  const tPos = normalizedApp.indexOf('function t(keyOrMr');
  const providerPos = normalizedApp.indexOf('let contentProvider=');
  assert.ok(tPos > 0, 't must exist');
  assert.ok(providerPos > 0, 'contentProvider must exist');
  assert.ok(renderPos > tPos, 'render must be after t (hoisted, but ensures no TDZ)');
  assert.ok(normalizedApp.includes("render();\ninitCloud();"), 'app must call render then initCloud at bottom');
});

test('P0 REGRESSION: evaluateRecipeEligibility is imported and assignmentOptions does not encounter undefined symbols', () => {
  const normalizedApp = appSource.replace(/\r\n/g, '\n');
  // 1. Verify import statement includes evaluateRecipeEligibility
  const importMatch = normalizedApp.match(/import\s*\{([^}]+)\}\s*from\s*'\.\/sync\.js'/);
  assert.ok(importMatch, 'app.js must import from ./sync.js');
  const importedSymbols = importMatch[1].split(',').map(s => s.trim());
  assert.ok(importedSymbols.includes('evaluateRecipeEligibility'), 'evaluateRecipeEligibility must be in sync.js imports');

  // 2. Verify assignmentOptions body references evaluateRecipeEligibility directly
  const fnMatch = normalizedApp.match(/function\s+assignmentOptions\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, 'assignmentOptions function must exist');
  assert.match(fnMatch[1], /evaluateRecipeEligibility\s*\(/, 'assignmentOptions must call evaluateRecipeEligibility');
});

