import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');

function householdSettingsBody() {
  const normalized = source.replace(/\r\n/g, '\n');
  const match = normalized.match(/async function saveHouseholdSettings\(\)\s*\{([\s\S]*?)\n\}\nasync function syncLocalChanges/);
  assert.ok(match, 'saveHouseholdSettings function body must be discoverable');
  return match[1];
}

test('HOUSEHOLD SETTINGS: local persistence must be guarded against storage failures', () => {
  const body = householdSettingsBody();

  // A storage quota/private-mode failure must not escape as an unhandled rejection.
  // The current implementation performs this write before its remote-sync try/catch.
  assert.match(
    body,
    /try\s*\{[\s\S]*localStorage\.setItem\(STORAGE,\s*JSON\.stringify\(state\)\)[\s\S]*\}\s*catch\s*\(err\)/,
    'localStorage.setItem for household settings must be inside a try/catch'
  );
});
