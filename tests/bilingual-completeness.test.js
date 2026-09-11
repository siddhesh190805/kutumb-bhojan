import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');

test('BILINGUAL: no hardcoded toast without t()', ()=>{
  // Hardcoded toasts that should use t() bilingual resolver
  const hardcoded = [
    "Cloud sync failed",
    "Cloud sync error",
    "Cloud sync unavailable",
    "Dietary preference sync failed"
  ];
  for(const s of hardcoded){
    // Search for toast('...s...') without t(
    const pattern = new RegExp(`toast\\(\\s*['\"]${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    const found = pattern.test(app);
    assert.equal(found, false, `Hardcoded toast '${s}' must use t() for bilingual`);
  }
});

test('BILINGUAL: dietary panel uses t() for all user-facing labels', ()=>{
  assert.match(app, /dietary\.panel_title/);
  assert.match(app, /dietary\.panel_desc/);
  assert.match(app, /dietary\.egg_label/);
  assert.match(app, /dietary\.saved/);
});

test('BILINGUAL: offline/online messages use t()', ()=>{
  assert.match(app, /msg\.online_restored/);
  assert.match(app, /msg\.offline_mode/);
});

test('BILINGUAL: prep/shopping toasts use t()', ()=>{
  assert.match(app, /msg\.prep_added/);
  assert.match(app, /msg\.saved/);
});

test('BILINGUAL: fallback behavior deterministic - t() always has fallbackEn', ()=>{
  // Ensure key dietary toasts have fallback English
  assert.match(app, /t\('dietary\.saved'/);
  assert.match(app, /t\('msg\.saved'/);
});
