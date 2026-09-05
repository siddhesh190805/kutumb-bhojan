const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRemoteRows,mapRemoteState}=require('../sync.js');

test('buildRemoteRows creates all five canonical table payloads',()=>{
  const state={
    members:[{id:'m1',name:'A',mr:'अ',age:40,weight:60,height:160,activity:'Active',note:'n'}],
    meals:[{id:'2026-09-07-Breakfast',date:'2026-09-07',slot:'Breakfast',title:'Poha',marathi:'पोहे',status:'Planned',notes:'x'}],
    recipes:[{id:'r1',name:'Poha',mr:'पोहे',course:'Breakfast',time:'15 min',ingredients:['poha'],method:['cook'],protein:'5 g',fibre:'3 g',cal:'200 kcal',oil:'5 ml',note:'n'}],
    shopping:[{id:'s1',item:'Poha',mr:'पोहे',category:'Staples',quantity:'2 kg',need:true,purchased:false}],
    prep:[{id:'p1',task:'Soak',mr:'भिजवा',date:'2026-09-06',area:'Prep',done:true}]
  };
  const rows=buildRemoteRows(state,'h1');
  assert.deepEqual(Object.keys(rows).sort(),['family_members','meal_entries','prep_tasks','recipes','shopping_items']);
  assert.equal(rows.meal_entries[0].household_id,'h1');
  assert.equal(rows.shopping_items[0].need_to_buy,true);
  assert.equal(rows.prep_tasks[0].done,true);
});

test('mapRemoteState reconstructs local state using stable keys',()=>{
  const data={
    members:[{member_key:'m1',name:'A',marathi_name:'अ',age:40,weight_kg:60,height_cm:160,activity:'Active',note:'n'}],
    meals:[{meal_date:'2026-09-07',slot:'Breakfast',title:'Poha',marathi_title:'पोहे',status:'Planned',notes:'x'}],
    recipes:[{recipe_key:'r1',name:'Poha',marathi_name:'पोहे',course:'Breakfast',time_text:'15 min',ingredients:['poha'],method:['cook'],protein:'5 g',fibre:'3 g',calories:'200 kcal',oil:'5 ml',note:'n'}],
    shopping:[{item_key:'s1',item:'Poha',marathi_item:'पोहे',category:'Staples',quantity:'2 kg',need_to_buy:true,purchased:false}],
    prep:[{task_key:'p1',task:'Soak',marathi_task:'भिजवा',task_date:'2026-09-06',category:'Prep',done:true}]
  };
  const state=mapRemoteState(data);
  assert.equal(state.members[0].id,'m1');
  assert.equal(state.meals[0].id,'2026-09-07-Breakfast');
  assert.equal(state.recipes[0].id,'r1');
  assert.equal(state.shopping[0].need,true);
  assert.equal(state.prep[0].done,true);
});

test('remote table configuration covers each shared household domain exactly once',()=>{
  const {REMOTE_TABLES}=require('../sync.js');
  assert.deepEqual(REMOTE_TABLES,['meal_entries','recipes','family_members','shopping_items','prep_tasks']);
  assert.equal(new Set(REMOTE_TABLES).size,REMOTE_TABLES.length);
});

test('settings copy describes cloud-backed storage',()=>{
  const source=require('fs').readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');
  assert.match(source,/Cloud sync सक्रिय आहे/);
  assert.doesNotMatch(source,/App static आहे, त्यामुळे server database लागत नाही/);
});
