const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');

test('hardcoded recipe catalog and calendarRecipeData are retired from app.js', () => {
  // P1 requirement: Remove production domain catalogs from app.js
  assert.doesNotMatch(source, /const\s+recipes\s*=\s*\[/);
  assert.doesNotMatch(source, /const\s+calendarRecipeData\s*=\s*\[/);
  assert.doesNotMatch(source, /const\s+calendarRecipeObj\s*=/);
  assert.doesNotMatch(source, /const\s+recipeObj\s*=/);
});

test('recipe lookup does not use unrelated fallback dishes', () => {
  const fn = source.match(/function findRecipe\(title\)\{(.*?)\n\}/s)?.[1] || '';
  assert.doesNotMatch(fn, /Matki Usal.*Tofu|Matki Usal.*Soy|Protein Thalipeeth.*Handvo/);
  assert.doesNotMatch(fn, /wanted=exact\[title\]\|\|title/);
});

test('recipe library keeps Pithla excluded and recipe names bilingual', () => {
  assert.doesNotMatch(source, /Pithla|पिठलं/);
  assert.match(source, /function findRecipe\(title\)/);
  assert.match(source, /state\.recipes\.find/);
});
