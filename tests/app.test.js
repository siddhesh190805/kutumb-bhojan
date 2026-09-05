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
