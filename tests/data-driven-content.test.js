const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createContentProvider,
  mapUiContent,
  mapFrequencyRules,
  CANONICAL_UI_CONTENT,
  DEFAULT_FREQUENCY_RULES,
  buildBackupPayload
} = require('../sync.js');

test('CONTENT: createContentProvider resolves mr, en, and both accurately', () => {
  const mockContent = [
    { content_key: 'test_greeting', mr_text: 'नमस्कार', en_text: 'Hello' },
    { content_key: 'test_mr_only', mr_text: 'फक्त मराठी', en_text: null },
    { content_key: 'test_en_only', mr_text: null, en_text: 'Only English' }
  ];

  const provider = createContentProvider(mockContent);

  // Marathi
  assert.equal(provider.get('test_greeting', 'mr'), 'नमस्कार');
  // English
  assert.equal(provider.get('test_greeting', 'en'), 'Hello');
  // Both
  assert.equal(provider.get('test_greeting', 'both'), 'नमस्कार · Hello');

  // Single-language fallbacks
  assert.equal(provider.get('test_mr_only', 'en'), 'फक्त मराठी');
  assert.equal(provider.get('test_mr_only', 'both'), 'फक्त मराठी');
  assert.equal(provider.get('test_en_only', 'mr'), 'Only English');
  assert.equal(provider.get('test_en_only', 'both'), 'Only English');

  // Missing key falls back to fallback argument or empty string
  assert.equal(provider.get('missing_key', 'mr', 'Fallback Text'), 'Fallback Text');
  assert.equal(provider.get('missing_key_no_fallback', 'mr'), '');
});

test('CONTENT: CANONICAL_UI_CONTENT contains all essential application surfaces', () => {
  assert.ok(typeof CANONICAL_UI_CONTENT === 'object' && CANONICAL_UI_CONTENT !== null);
  const keys = Object.keys(CANONICAL_UI_CONTENT);
  assert.ok(keys.length >= 200, `Expected at least 200 keys, found ${keys.length}`);

  const keySet = new Set(keys);
  // Key domain sections must be covered
  assert.ok(keySet.has('app.name') || keySet.has('identity.title'));
  assert.ok(keySet.has('nav.today'));
  assert.ok(keySet.has('nav.calendar'));
  assert.ok(keySet.has('nav.recipes'));
  assert.ok(keySet.has('nav.shopping'));
  assert.ok(keySet.has('nav.prep'));
  assert.ok(keySet.has('nav.family'));
  assert.ok(keySet.has('nav.health'));
  assert.ok(keySet.has('nav.settings'));
  assert.ok(keySet.has('slot.Breakfast') || keySet.has('slot.breakfast'));
  assert.ok(keySet.has('slot.Lunch') || keySet.has('slot.lunch'));
  assert.ok(keySet.has('slot.Snack') || keySet.has('slot.snack') || keySet.has('slot.snacks'));
  assert.ok(keySet.has('slot.Dinner') || keySet.has('slot.dinner'));
  assert.ok(keySet.has('tts.listen'));
  assert.ok(keySet.has('tts.stop'));
});

test('CONTENT: ContentProvider resolves all app.js UI aliases without leaking technical keys', () => {
  const provider = createContentProvider();
  
  // Test brand & learning keys specifically reported by user
  assert.equal(provider.get('identity.brand_tagline', 'mr'), 'सोपे कौटुंबिक जेवण');
  assert.equal(provider.get('identity.brand_sub', 'mr'), 'कुटुंबाची पोषण नियोजन पद्धत');
  assert.equal(provider.get('today.learning_title', 'mr'), 'अन्न → पोषण → शरीर');
  assert.equal(provider.get('today.learning_sub', 'mr'), 'प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.');
  assert.equal(provider.get('today.learning_cta', 'mr'), 'पोषण समजून घ्या');
  assert.equal(provider.get('today.learning_cta', 'en'), 'Learn about nutrition');

  // Verify has() returns true for all aliases
  assert.ok(provider.has('identity.brand_tagline'));
  assert.ok(provider.has('identity.brand_sub'));
  assert.ok(provider.has('today.learning_title'));
  assert.ok(provider.has('today.learning_sub'));
  assert.ok(provider.has('today.learning_cta'));
  assert.ok(provider.has('reason.want_lighter'));
  assert.ok(provider.has('meal.reason_change'));
});

test('RULES: household_frequency_rules mappings and default rules', () => {
  assert.ok(Array.isArray(DEFAULT_FREQUENCY_RULES));
  const paneerDefault = DEFAULT_FREQUENCY_RULES.find(r => r.ingredientKey === 'paneer' || r.ingredient_key === 'paneer');
  assert.ok(paneerDefault);
  assert.equal(paneerDefault.maxPerCalendarMonth || paneerDefault.max_per_calendar_month, 5);

  const mapped = mapFrequencyRules([
    {
      id: 'rule-1',
      household_id: 'hh-1',
      rule_key: 'paneer_monthly_limit',
      ingredient_key: 'paneer',
      max_per_calendar_month: 6,
      current_month_count: 2,
      warning_threshold: 4,
      is_active: true
    }
  ]);

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].maxPerCalendarMonth, 6);
});

test('BACKUP: buildBackupPayload definition in app.js includes uiContent and frequencyRules', () => {
  const appPath = path.join(__dirname, '..', 'app.js');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert.match(appCode, /function buildBackupPayload/);
  assert.match(appCode, /uiContent:\s*sourceState\.uiContent/);
  assert.match(appCode, /frequencyRules:\s*sourceState\.frequencyRules/);
});

test('SCHEMA: migration contains ui_content and household_frequency_rules definitions', () => {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260908_data_driven_content_and_rules.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migrationSql, /create table if not exists public\.ui_content/i);
  assert.match(migrationSql, /create table if not exists public\.household_frequency_rules/i);
  assert.match(migrationSql, /insert into public\.ui_content/i);
  assert.match(migrationSql, /enable row level security/i);
});

test('LAYOUT & THEME: CSS provides dropdown overflow constraints and semantic dark tokens', () => {
  const cssPath = path.join(__dirname, '..', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify dropdown containment
  assert.match(css, /\.assignment-change select/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /min-width:\s*0/);

  // Verify theme tokens
  assert.match(css, /--bg:/);
  assert.match(css, /--surface:/);
  assert.match(css, /--text:/);
  assert.match(css, /--text-muted:/);
  assert.match(css, /data-theme="dark"/);
});
