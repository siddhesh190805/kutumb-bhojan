import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');

test('THEME/LANGUAGE: storage reads must be guarded against unavailable Web Storage', () => {
  assert.match(
    source,
    /try\s*\{[\s\S]*localStorage\.getItem\(THEME_STORAGE\)[\s\S]*\}[\s\S]*catch/, 
    'theme localStorage read must be inside a try/catch'
  );
  assert.match(
    source,
    /try\s*\{[\s\S]*localStorage\.getItem\(LANGUAGE_STORAGE\)[\s\S]*\}[\s\S]*catch/,
    'language localStorage read must be inside a try/catch'
  );
});

test('THEME/LANGUAGE: storage writes must not escape as unhandled errors', () => {
  const themeMatch = source.match(/function setTheme\(value\)\{([\s\S]*?)\n\}/);
  const languageMatch = source.match(/function setLanguage\(value\)\{([\s\S]*?)\n\}/);
  assert.ok(themeMatch, 'setTheme function must be discoverable');
  assert.ok(languageMatch, 'setLanguage function must be discoverable');

  assert.match(themeMatch[1], /try\s*\{[\s\S]*localStorage\.setItem\(THEME_STORAGE[\s\S]*\}[\s\S]*catch/, 'theme localStorage write must be guarded');
  assert.match(languageMatch[1], /try\s*\{[\s\S]*localStorage\.setItem\(LANGUAGE_STORAGE[\s\S]*\}[\s\S]*catch/, 'language localStorage write must be guarded');
});
