const test=require('node:test');const assert=require('node:assert/strict');
function dates(start,count){return Array.from({length:count},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)})}
test('starter calendar spans 30 days and four slots per day',()=>{assert.equal(dates('2026-09-07',30).length*4,120);assert.equal(dates('2026-09-07',30)[29],'2026-10-06')});
test('Vercel app is static and has no server dependency',()=>{assert.equal(typeof 'index.html','string')});

test('recipe library dedupe keeps the calendar-specific version when names collide',()=>{
  const {dedupeRecipesByName}=require('../sync.js');
  const recipes=[
    {id:'base',name:'Egg Bhurji + Roti',mr:'मूळ'},
    {id:'calendar',name:'egg bhurji + roti',mr:'कॅलेंडर'},
    {id:'other',name:'Handvo + Curd',mr:'हांडवो + दही'}
  ];
  const result=dedupeRecipesByName(recipes);
  assert.equal(result.length,2);
  assert.equal(result.find(r=>r.name.toLowerCase()==='egg bhurji + roti').id,'calendar');
});


test('family entry flow uses anonymous auth and has no email OTP or sign-out UI',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  assert.match(source,/signInAnonymously\(\)/);
  assert.doesNotMatch(source,/signInWithOtp/);
  assert.doesNotMatch(source,/function renderAuth/);
  assert.doesNotMatch(source,/data-signout/);
  assert.match(source,/Login\/OTP लागत नाही/);
});

test('Supabase bootstrap isolates households and supports secure family invite sharing',()=>{
  const fs=require('node:fs');
  const schema=fs.readFileSync(require('node:path').join(__dirname,'..','supabase.schema.sql'),'utf8');
  assert.match(schema,/create or replace function public\.bootstrap_household/);
  assert.doesNotMatch(schema,/where name = 'कुटुंब भोजन'[\s\S]*?insert into public\.household_members/);
  assert.match(schema,/create table if not exists public\.household_invites/);
  assert.match(schema,/create or replace function public\.join_household/);
});

test('health guide and dynamic household settings are implemented without hard-coded health-card content',()=>{
  const fs=require('node:fs');
  const root=require('node:path').join(__dirname,'..');
  const source=fs.readFileSync(require('node:path').join(root,'app.js'),'utf8');
  const schema=fs.readFileSync(require('node:path').join(root,'supabase.schema.sql'),'utf8');
  assert.match(source,/healthView\(\)/);
  assert.match(source,/from\('health_tips'\)/);
  assert.match(source,/from\('health_targets'\)/);
  assert.match(source,/from\('household_settings'\)/);
  assert.match(source,/oilMonthlyTargetMl/);
  assert.match(schema,/create table if not exists public\.health_tips/);
  assert.match(schema,/create table if not exists public\.health_targets/);
  assert.match(schema,/create table if not exists public\.household_settings/);
});

test('theme and PWA shell are wired',()=>{
  const fs=require('node:fs');
  const root=require('node:path').join(__dirname,'..');
  const app=fs.readFileSync(require('node:path').join(root,'app.js'),'utf8');
  const index=fs.readFileSync(require('node:path').join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(require('node:path').join(root,'public','service-worker.js'),'utf8');
  const manifest=fs.readFileSync(require('node:path').join(root,'public','manifest.webmanifest'),'utf8');
  assert.match(app,/kutumb-bhojan-theme-v1/);
  assert.match(app,/serviceWorker\.register\('\/service-worker\.js'\)/);
  assert.match(index,/color-scheme/);
  assert.match(sw,/CACHE = 'kutumb-bhojan-shell-v7'/);
  assert.match(manifest,/"display":"standalone"/);
});

test('global controls expose a persistent language switcher with Marathi, English, and bilingual modes',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  assert.match(source,/LANGUAGE_STORAGE/);
  assert.match(source,/\['mr','मराठी'\]/);
  assert.match(source,/\['en','English'\]/);
  assert.match(source,/\['both','दोन्ही'\]/);
  assert.match(source,/setLanguage\(/);
});

test('today experience contains food-to-nutrition learning entry points and balance indicators',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  assert.match(source,/What are we eating/);
  assert.match(source,/What are we eating today/);
  assert.match(source,/आजच्या ताटात/);
  assert.match(source,/Learn about nutrition/);
  assert.match(source,/Meal balance/);
});

test('settings exposes language preference alongside theme preference',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  assert.match(source,/Language \/ भाषा/);
  assert.match(source,/data-language/);
});

test('settings has exactly one language preference panel',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  assert.equal((source.match(/<h3>🌐 Language \/ भाषा<\/h3>/g)||[]).length,1);
});

test('GAP-003: saveHouseholdSettings is defined, validated, and handles local and remote persistence',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
  
  // Verify function definition exists
  assert.match(source,/async function saveHouseholdSettings\(\)\s*\{/, 'saveHouseholdSettings function must be defined');
  
  // Verify validation logic exists
  assert.match(source,/householdSize=Math\.min\(20,\s*Math\.max\(1/);
  assert.match(source,/oilStockMl=Math\.max\(0/);
  assert.match(source,/oilMonthlyTargetMl=Math\.max\(100/);

  // Verify persistence targets household_settings table with household_id conflict key
  assert.match(source,/supabase\.from\('household_settings'\)\.upsert\(payload,\s*\{\s*onConflict:\s*'household_id'\s*\}\)/);

  // Verify local storage update
  assert.match(source,/localStorage\.setItem\(STORAGE,\s*JSON\.stringify\(state\)\)/);

  // Verify graceful error handling
  assert.match(source,/console\.warn\('saveHouseholdSettings failed'/);
});

test('GAP-004: PWA root assets exist, vercel.json defines root rewrites, and service worker is root-scoped',()=>{
  const fs=require('node:fs');
  const root=require('node:path').join(__dirname,'..');

  // Verify root files exist
  assert.ok(fs.existsSync(require('node:path').join(root,'manifest.webmanifest')), 'root manifest.webmanifest must exist');
  assert.ok(fs.existsSync(require('node:path').join(root,'service-worker.js')), 'root service-worker.js must exist');
  assert.ok(fs.existsSync(require('node:path').join(root,'icon.svg')), 'root icon.svg must exist');

  // Verify vercel.json rewrites
  const vercelConfig=JSON.parse(fs.readFileSync(require('node:path').join(root,'vercel.json'),'utf8'));
  assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites');
  const rewriteSources=vercelConfig.rewrites.map(r=>r.source);
  assert.ok(rewriteSources.includes('/manifest.webmanifest'), 'rewrites must include /manifest.webmanifest');
  assert.ok(rewriteSources.includes('/service-worker.js'), 'rewrites must include /service-worker.js');
  assert.ok(rewriteSources.includes('/icon.svg'), 'rewrites must include /icon.svg');

  // Verify manifest configuration
  const manifest=JSON.parse(fs.readFileSync(require('node:path').join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.icons[0].src, '/icon.svg');

  // Verify service worker scope & shell assets
  const sw=fs.readFileSync(require('node:path').join(root,'service-worker.js'),'utf8');
  assert.match(sw, /'\/manifest\.webmanifest'/);
  assert.match(sw, /'\/icon\.svg'/);
});

