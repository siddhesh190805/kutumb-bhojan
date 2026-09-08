const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('AUDIT: No hardcoded family member lists in application logic', () => {
  // Members must come from DB/state (state.householdMembers), not hardcoded static arrays in app.js
  assert.doesNotMatch(appSource, /const\s+members\s*=\s*\[['"]Vikas['"]/i);
  assert.doesNotMatch(appSource, /let\s+members\s*=\s*\[['"]Vikas['"]/i);
  assert.doesNotMatch(appSource, /const\s+FAMILY\s*=\s*\[/);
});

test('AUDIT: No hardcoded static recipe catalog in application logic', () => {
  // Recipes must be loaded dynamically into state.recipes from DB or sync
  assert.doesNotMatch(appSource, /const\s+RECIPES\s*=\s*\[/);
  assert.doesNotMatch(appSource, /const\s+recipeCatalog\s*=\s*\[/);
});

test('AUDIT: No hardcoded health articles or medical content in app.js', () => {
  // Health tips and targets are fetched from 'health_tips' and 'health_targets' tables
  assert.match(appSource, /from\('health_tips'\)/);
  assert.match(appSource, /from\('health_targets'\)/);
  assert.doesNotMatch(appSource, /const\s+HEALTH_TIPS\s*=\s*\[/);
  assert.doesNotMatch(appSource, /const\s+HEALTH_GUIDE\s*=\s*\[/);
});

test('AUDIT: Configurable paneer monthly limit is driven by DB rules, not magic numbers', () => {
  // Paneer limit must be read dynamically from state.frequencyRules
  assert.match(appSource, /frequencyRules/);
  assert.match(appSource, /find\(r\s*=>\s*r\.ingredientKey\s*===\s*['"]paneer['"]\)/);
  // Ensure we don't have hardcoded `if (paneerCount >= 5)` in business logic without reading rule
  assert.doesNotMatch(appSource, /if\s*\(\s*paneerCount\s*>=\s*5\s*\)/);
});

test('AUDIT: UI components consume canonical content keys through t(key, fallback)', () => {
  // Key UI sections must query canonical keys
  const expectedKeys = [
    'identity.title',
    'nav.today',
    'nav.calendar',
    'nav.recipes',
    'nav.shopping',
    'nav.prep',
    'nav.family',
    'nav.health',
    'nav.settings',
    'tts.listen',
    'tts.stop',
    'settings.theme_title',
    'settings.lang_desc',
    'settings.cloud_title',
    'settings.reset_btn'
  ];

  for (const key of expectedKeys) {
    assert.ok(
      appSource.includes(`'${key}'`) || appSource.includes(`"${key}"`),
      `app.js must reference canonical content key: ${key}`
    );
  }
});

test('AUDIT: Classification of code literals is maintained and documented', () => {
  // Verified classifications:
  // A. Implementation contracts (e.g. 'household_id', 'click', 'input', 'dataset', 'class')
  // B. Database/domain data (loaded via Supabase queries to 'recipes', 'ingredients', etc.)
  // C. UI content (loaded via 'ui_content' table and createContentProvider)
  // D. Localization content (bilingual mr/en records in ui_content)
  // E. Configurable business rule (loaded via 'household_frequency_rules')
  // F. Schema/protocol identifiers (e.g. 'auth.jwt()', 'is_anonymous', 'public')
  // G. Unavoidable technical constants (e.g. 1000ms debounce, 30 days calendar generation)

  assert.ok(syncSource.includes('CANONICAL_UI_CONTENT'), 'sync.js must expose CANONICAL_UI_CONTENT seed/fallback');
  assert.ok(syncSource.includes('DEFAULT_FREQUENCY_RULES'), 'sync.js must expose DEFAULT_FREQUENCY_RULES seed/fallback');
  assert.ok(syncSource.includes('createContentProvider'), 'sync.js must provide createContentProvider interface');
});

test('AUDIT: index.html is an empty shell with zero hardcoded domain content', () => {
  // index.html should only contain viewport, meta tags, and root mounting div
  assert.doesNotMatch(htmlSource, /Moong vegetable chilla/i);
  assert.doesNotMatch(htmlSource, /Egg Bhurji/i);
  assert.doesNotMatch(htmlSource, /Handvo/i);
  assert.doesNotMatch(htmlSource, /Paneer/i);
  assert.doesNotMatch(htmlSource, /Vikas|Namrata|Tejas|Siddhesh/i);
  assert.match(htmlSource, /<div id="app"><\/div>/);
});
