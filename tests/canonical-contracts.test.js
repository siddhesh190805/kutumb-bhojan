import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appSource = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
const searchSource = fs.readFileSync(path.join(process.cwd(), 'backend/app/planning/search.py'), 'utf8');

test('CANONICAL MEAL ORDER: slots must be Breakfast,Lunch,Dinner,Snack', () => {
  assert.match(appSource, /const slots=\['Breakfast','Lunch','Dinner','Snack'\]/);
  assert.match(searchSource, /slots_order = \["Breakfast", "Lunch", "Dinner", "Snack"\]/);
});

test('CANONICAL MEAL ORDER: today() sorts meals by canonical slots', () => {
  assert.match(appSource, /state\.meals\.filter\(x=>x\.date===selectedDate\)\.sort\(\(a,b\)=> slots\.indexOf\(a\.slot\)/);
});

test('CALENDAR: dates sorted chronologically', () => {
  assert.match(appSource, /\[\.\.\.new Set\(state\.meals\.filter\(x=>x\.date\.startsWith\(month\)\)\.map\(x=>x\.date\)\)\]\.sort\(\)/);
});

test('CALENDAR: selected day meals sorted by canonical order', () => {
  assert.match(appSource, /state\.meals\.filter\(x=>x\.date===selectedDate\)\.sort\(\(a,b\)=> slots\.indexOf\(a\.slot\)/);
});

test('DATE: selectedDate uses local date not UTC', () => {
  assert.match(appSource, /let selectedDate=new Date\(\)\.toLocaleDateString\('en-CA'\)/);
  assert.doesNotMatch(appSource, /let selectedDate=new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
});

test('DATE: shiftDay uses setDate and toLocaleDateString, not setUTCDate', () => {
  assert.match(appSource, /function shiftDay\(delta\)\{const d=new Date\(selectedDate\+'T00:00:00'\);d\.setDate\(d\.getDate\(\)\+delta\);selectedDate=d\.toLocaleDateString\('en-CA'\)/);
  assert.doesNotMatch(appSource, /setUTCDate/);
});

test('DATE: calendar month navigation sets selectedDate to month-01', () => {
  assert.match(appSource, /selectedDate=e\.target\.value\+'-01'/);
});
