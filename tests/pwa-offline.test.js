import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname ? path.dirname(new URL(import.meta.url).pathname).replace(/^\/[A-Z]:\//,'').replace(/^\//,'') : '.');
// Fallback for Windows
const cwd = process.cwd();

function read(p){ return fs.readFileSync(path.join(cwd, p), 'utf8'); }

// Static PWA tests
test('manifest exists and is valid JSON', ()=>{
  const raw = read('manifest.webmanifest');
  const j = JSON.parse(raw);
  assert.equal(typeof j.name, 'string');
  assert.equal(typeof j.short_name, 'string');
  assert.equal(j.start_url, '/');
  assert.equal(j.display, 'standalone');
  assert.ok(Array.isArray(j.icons) && j.icons.length>0);
  assert.equal(j.icons[0].src, '/icon.svg');
});

test('required icon exists', ()=>{
  assert.ok(fs.existsSync(path.join(cwd, 'icon.svg')));
  assert.ok(fs.existsSync(path.join(cwd, 'manifest.webmanifest')));
});

test('service worker exists and contains required handlers', ()=>{
  const sw = read('service-worker.js');
  assert.match(sw, /CACHE\s*=/);
  assert.match(sw, /self\.addEventListener\('install'/);
  assert.match(sw, /self\.addEventListener\('activate'/);
  assert.match(sw, /self\.addEventListener\('fetch'/);
  assert.match(sw, /supabase\.co/);
  assert.match(sw, /caches\.match/);
});

test('service worker precache list includes shell', ()=>{
  const sw = read('service-worker.js');
  assert.match(sw, /\/index\.html/);
  assert.match(sw, /\/styles\.css/);
  assert.match(sw, /\/app\.js/);
  assert.match(sw, /\/sync\.js/);
});

test('service worker registration path valid in app.js', ()=>{
  const app = read('app.js');
  assert.match(app, /navigator\.serviceWorker\.register\('\/service-worker\.js'\)/);
});

test('localStorage key preserved and load handles corruption', ()=>{
  const app = read('app.js');
  assert.match(app, /kutumb-bhojan-state-v1/);
  assert.match(app, /try\{const x=JSON\.parse\(localStorage\.getItem\(STORAGE\)/);
});

test('save handles localStorage failure gracefully', ()=>{
  const app = read('app.js');
  assert.match(app, /try\{ localStorage\.setItem\(STORAGE/);
  assert.match(app, /local_save_failed/);
});

test('online/offline handlers present', ()=>{
  const app = read('app.js');
  assert.match(app, /window\.addEventListener\('online'/);
  assert.match(app, /window\.addEventListener\('offline'/);
  assert.match(app, /msg\.online_restored|Connection restored/);
});

test('realtime and loadRemote preserved', ()=>{
  const app = read('app.js');
  assert.match(app, /loadRemote\(\)/);
  assert.match(app, /syncLocalChanges/);
  assert.match(app, /realtime/);
});

test('offline privacy: service worker does not cache supabase', ()=>{
  const sw = read('service-worker.js');
  assert.match(sw, /url\.hostname\.includes\('supabase\.co'\)/);
  assert.match(sw, /url\.pathname\.startsWith\('\/rest\/'\)/);
  assert.doesNotMatch(sw, /Authorization/);
});
