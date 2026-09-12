import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { REMOTE_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName, mapIngredientCatalog, mapRecipeIngredients, mapMealAssignments, buildStructuredRecipe, mapDietaryRules, buildAutomaticAssignments, applyDayLevelOverride, revertDayLevelOverride, evaluateMealBalance, getNutritionEducation, getRecipeNutritionConcepts, selectAutomaticAlternate, DEFAULT_DIETARY_RULES, groupMemberAssignments, DEFAULT_FREQUENCY_RULES, countIngredientMonthlyOccurrences, getHouseholdFrequencyStatus, recipeContainsIngredient, CANONICAL_UI_CONTENT, createContentProvider, mapUiContent, mapFrequencyRules, MEAL_CHANGE_REASONS, evaluateRecipeEligibility } from './sync.js';
import { tts } from './tts.js';

const SUPABASE_URL='https://wcwwvyreefkrqchfteqp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_taMU0Pog_yTgPzuJ5v7MRA_ACsZ-w3r';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let remoteHouseholdId=null, remoteReady=false, realtimeChannel=null;
const STORAGE='kutumb-bhojan-state-v1';
const THEME_STORAGE='kutumb-bhojan-theme-v1';
const LANGUAGE_STORAGE='kutumb-bhojan-language-v1';
const slots=['Breakfast','Lunch','Dinner','Snack'];
const slotMr={Breakfast:'नाश्ता',Lunch:'दुपारचे जेवण',Snack:'अल्पोपहार',Dinner:'रात्रीचे जेवण'};
const icon={Breakfast:'🍳',Lunch:'🍛',Snack:'🥜',Dinner:'🍽️'};
const mr={
'Moong vegetable chilla + curd':'मूग भाजी चिल्ला + दही','Moong-paneer chilla':'मूग-पनीर चिल्ला','Lobia curry + roti + bhindi + guava':'चवळीची भाजी + पोळी + भेंडी + पेरू','Roasted chana + guava':'भाजलेला हरभरा + पेरू','Paneer vegetable curry + roti + cucumber':'पनीर भाजी + पोळी + काकडी','Chana usal + jowar bhakri + cabbage-carrot koshimbir':'हरभरा उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर','Tofu bhurji + roti + tomato-cucumber':'टोफू भुर्जी + पोळी + टोमॅटो-काकडी','Vegetable uttapam + sambar':'भाजी उत्तपम + सांबार','Rajma rice + cucumber-onion':'राजमा भात + काकडी-कांदा','Buttermilk + roasted chana':'ताक + भाजलेला हरभरा','Jowar bhakri + matki usal + cauliflower':'ज्वारी भाकरी + मटकी उसळ + फुलकोबी','Egg bhurji + roti':'अंडा भुर्जी + पोळी','Mixed bean curry + roti + dudhi':'मिश्र कडधान्य भाजी + पोळी + दुधी','Paneer chaat + pomegranate':'पनीर चाट + डाळिंब','Vegetable moong khichdi + curd + carrot-cucumber':'भाजी मूग खिचडी + दही + गाजर-काकडी','Besan-paneer chilla':'बेसन-पनीर चिल्ला','Chole + roti + cabbage-peas + apple':'छोले + पोळी + कोबी-वाटाणा + सफरचंद','Milk + banana + peanut powder':'दूध + केळे + शेंगदाणा पूड','Palak paneer + roti + cucumber':'पालक पनीर + पोळी + काकडी','Handvo + curd':'हांडवो + दही','Bharli vangi + jowar bhakri + curd + cucumber':'भरली वांगी + ज्वारी भाकरी + दही + काकडी','Chana chaat + mosambi':'हरभरा चाट + मोसंबी','Soy-paneer keema + roti + cabbage':'सोया-पनीर कीमा + पोळी + कोबी','Methi dashmi + curd + banana':'मेथी दशमी + दही + केळे','Matki misal + pav + cucumber-onion':'मटकी मिसळ + पाव + काकडी-कांदा','Curd + papaya + flax':'दही + पपई + जवस','Paneer vegetable tikka + roti + tomato-cucumber':'पनीर भाजी टिक्का + पोळी + टोमॅटो-काकडी','Peanuts + banana':'शेंगदाणे + केळे','Paneer bhurji + roti + spinach':'पनीर भुर्जी + पोळी + पालक','Ragi dosa + sambar':'नाचणी डोसा + सांबार','Chana usal + roti + cauliflower-carrot':'हरभरा उसळ + पोळी + फुलकोबी-गाजर','Sprouted moong chaat':'मोड आलेल्या मूगाची चाट','Egg bhurji + roti + dudhi':'अंडा भुर्जी + पोळी + दुधी','Vegetable poha + peanuts + curd':'भाजी पोहे + शेंगदाणे + दही','Rajma rice + cucumber + papaya':'राजमा भात + काकडी + पपई','Pesarattu + peanut chutney':'पेसरट्टू + शेंगदाणा चटणी','Mixed bean curry + roti + cabbage-carrot':'मिश्र कडधान्य भाजी + पोळी + कोबी-गाजर','Tofu vegetable curry + roti + cucumber':'टोफू भाजी + पोळी + काकडी','Besan vegetable chilla + curd':'बेसन भाजी चिल्ला + दही','Chole + roti + bhindi + apple':'छोले + पोळी + भेंडी + सफरचंद','Mixed-dal adai + tomato chutney':'मिश्र डाळ अडई + टोमॅटो चटणी','Bharli vangi + jowar bhakri + curd':'भरली वांगी + ज्वारी भाकरी + दही','Protein thalipeeth + curd':'प्रोटीन थालीपीठ + दही','Sprouts poha + curd':'मोड आलेले पोहे + दही','Chana usal + jowar bhakri + dudhi':'हरभरा उसळ + ज्वारी भाकरी + दुधी','Curd + banana + pumpkin seeds':'दही + केळे + भोपळ्याच्या बिया','Tofu bhurji + roti + cucumber-tomato':'टोफू भुर्जी + पोळी + काकडी-टोमॅटो','Rajma rice + cabbage-carrot':'राजमा भात + कोबी-गाजर','Sprouted moong chaat + cucumber':'मोड आलेल्या मूगाची चाट + काकडी','Egg bhurji + roti + bhindi':'अंडा भुर्जी + पोळी + भेंडी','Mixed bean curry + roti + dudhi + apple':'मिश्र कडधान्य भाजी + पोळी + दुधी + सफरचंद','Chole + roti + cauliflower-carrot + papaya':'छोले + पोळी + फुलकोबी-गाजर + पपई','Roasted chana + banana':'भाजलेला हरभरा + केळे','Soy-paneer keema + roti + cabbage salad':'सोया-पनीर कीमा + पोळी + कोबी कोशिंबीर','Matki usal + jowar bhakri + cabbage-carrot koshimbir':'मटकी उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर'};

const starter={
 version:2,
 members:[],
 meals:[],
 recipes:[],
 shopping:[],
 derivedShopping:[],
 prep:[],
 healthTips:[],
 healthTargets:[],
 nutritionEducation:[],
 ingredientCatalog:[],
 recipeIngredients:[],
 mealAssignments:[],
 dietaryRules:DEFAULT_DIETARY_RULES,
 frequencyRules:DEFAULT_FREQUENCY_RULES,
 uiContent:CANONICAL_UI_CONTENT,
 householdSettings:{householdSize:4,oilStockMl:5000,oilMonthlyTargetMl:3000,displayName:'कुटुंब भोजन'},
 updatedAt:new Date().toISOString()
};
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');return x&&(x.version===1||x.version===2)?{...clone(starter),...x,version:2}:clone(starter)}catch{return clone(starter)}}
let state=load();
if(!state.uiContent||(Array.isArray(state.uiContent)&&!state.uiContent.length)||(typeof state.uiContent==='object'&&Object.keys(state.uiContent).length===0)) state.uiContent=CANONICAL_UI_CONTENT;
if(!state.frequencyRules||!state.frequencyRules.length) state.frequencyRules=DEFAULT_FREQUENCY_RULES;
let contentProvider=createContentProvider(state.uiContent);
state.recipes=state.recipes.map(r=>buildStructuredRecipe(r,state.recipeIngredients||[],state.ingredientCatalog||[]));
let page='today';let selectedDate=new Date().toLocaleDateString('en-CA');let selectedRecipe=null;let toastTimer;
let theme='system';
try{ theme=localStorage.getItem(THEME_STORAGE)||'system'; }catch(err){ console.warn('theme storage read failed',err); }
let language='both';
try{ language=localStorage.getItem(LANGUAGE_STORAGE)||'both'; }catch(err){ console.warn('language storage read failed',err); }
let cloudRefreshTimer=null;
let cloudInitializing=false;
let cloudApplyingRemote=false;
let showRecipeModal=false;
let editingRecipe=null;
let reasonChangeModalMeal=null;

async function save(){
 state.updatedAt=new Date().toISOString();
 try{ localStorage.setItem(STORAGE,JSON.stringify(state)); }catch(err){ console.warn('localStorage save failed',err); toast(t('msg.local_save_failed','Local save failed / स्थानिक जतन अयशस्वी')); return; }
 if(remoteReady&&!cloudApplyingRemote){
  try{ await syncLocalChanges(); await syncPhase2(); }catch(err){ console.warn('cloud sync failed after save',err); toast(t('msg.sync_pending','Changes saved locally · बदल स्थानिक जतन झाले, sync प्रलंबित')); return; }
 }
 toast(t('msg.saved','Saved'));
}
async function saveHouseholdSettings(){
 const current=state.householdSettings||starter.householdSettings||{};
 const householdSize=Math.min(20,Math.max(1,Number(current.householdSize)||4));
 const oilStockMl=Math.max(0,Number(current.oilStockMl)||0);
 const oilMonthlyTargetMl=Math.max(100,Number(current.oilMonthlyTargetMl)||3000);
 const displayName=current.displayName||'कुटुंब भोजन';
 state.householdSettings={...current,householdSize,oilStockMl,oilMonthlyTargetMl,displayName};
 try{
  localStorage.setItem(STORAGE,JSON.stringify(state));
 }catch(err){
  console.warn('localStorage save failed',err);
  toast(t('msg.local_save_failed','Local save failed / स्थानिक जतन अयशस्वी'));
  return false;
 }
 if(!remoteReady||!remoteHouseholdId)return true;
 try{
  const payload={household_id:remoteHouseholdId,display_name:displayName,household_size:householdSize,oil_stock_ml:oilStockMl,oil_monthly_target_ml:oilMonthlyTargetMl,updated_at:new Date().toISOString()};
  const {error}=await supabase.from('household_settings').upsert(payload,{onConflict:'household_id'});
  if(error)throw error;
  return true;
  }catch(err){
   console.warn('saveHouseholdSettings failed',err);
   toast(t('msg.cloud_sync_failed','Cloud sync failed / सेटिंग्ज क्लाउडमध्ये जतन होऊ शकली नाही'));
   return false;
  }
}
async function syncLocalChanges(){
 if(!remoteHouseholdId)return;
 const rows=buildRemoteRows(state,remoteHouseholdId);
 const conflicts={'meal_entries':'household_id,meal_date,slot','recipes':'household_id,recipe_key','family_members':'household_id,member_key','shopping_items':'household_id,item_key','prep_tasks':'household_id,task_key'};
 const batches=REMOTE_TABLES.map(table=>[table,rows[table],conflicts[table]]);
  for(const [table,payload,onConflict] of batches){
   const {error}=await supabase.from(table).upsert(payload,{onConflict});
   if(error){console.warn(`sync failed for ${table}`,error);toast(t('msg.cloud_sync_error','Cloud sync error · क्लाउड जतन अयशस्वी'));return false;}
  }
 return true;
}
async function loadDerivedShopping(){
 if(!remoteHouseholdId)return;
 try{
  let headers={};
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.access_token){
   headers['Authorization']=`Bearer ${session.access_token}`;
  }
  const res=await fetch(`/api/shopping/derived?household_id=${remoteHouseholdId}&days=7`,{headers});
  if(res.ok){
   const data=await res.json();
   state.derivedShopping=data.items||[];
   localStorage.setItem(STORAGE,JSON.stringify(state));
  }
 }catch(err){
  console.warn('loadDerivedShopping error',err);
 }
}
let initialPlanPayload=null;
async function loadRemote(isRetry=false){
 const [a,b,c,d,e,f,g,h,i,j,k,rules,l,uiRes,freqRes]=await Promise.all([
  supabase.from('meal_entries').select('*').eq('household_id',remoteHouseholdId).order('meal_date').order('slot'),
  supabase.from('recipes').select('*').eq('household_id',remoteHouseholdId),
  supabase.from('family_members').select('*').eq('household_id',remoteHouseholdId).order('sort_order'),
  supabase.from('shopping_items').select('*').eq('household_id',remoteHouseholdId),
  supabase.from('prep_tasks').select('*').eq('household_id',remoteHouseholdId).order('task_date'),
  supabase.from('health_tips').select('*').eq('active',true).order('sort_order'),
  supabase.from('health_targets').select('*').eq('active',true).order('sort_order'),
  supabase.from('household_settings').select('*').eq('household_id',remoteHouseholdId).maybeSingle(),
  supabase.from('ingredients').select('*').eq('active',true).order('canonical_key'),
  supabase.from('recipe_ingredients').select('*').eq('household_id',remoteHouseholdId).order('sort_order'),
  supabase.from('meal_assignments').select('*').eq('household_id',remoteHouseholdId),
  supabase.from('dietary_rules').select('*').eq('household_id',remoteHouseholdId).eq('active',true),
  supabase.from('nutrition_education').select('*').eq('active',true).order('sort_order'),
  supabase.from('ui_content').select('*').eq('active',true).order('sort_order'),
  supabase.from('household_frequency_rules').select('*').eq('household_id',remoteHouseholdId).eq('active',true)
 ]);
 const err=[a,b,c,d,e,f,g,h,i,j,k,rules,l].find(x=>x.error)?.error;
 if(err)throw err;
 if(!a.data?.length && !isRetry){
  try{
   let authHeaders={'Content-Type':'application/json'};
   const {data:{session}}=await supabase.auth.getSession();
   if(session?.access_token){
    authHeaders['Authorization']=`Bearer ${session.access_token}`;
   }
   const planRes=await fetch('/api/planning/plans',{
    method:'POST',
    headers:authHeaders,
    body:JSON.stringify({
     start_date:'2026-09-07',
     visible_days:7,
     evaluation_days:30,
     household_id:remoteHouseholdId
    })
   });
   if(planRes.ok){
    initialPlanPayload=await planRes.json();
    return loadRemote(true);
   }
  }catch(err){console.warn('Initial FastAPI plan generation error',err);}
 }
 if(!a.data?.length && initialPlanPayload?.plan?.length){
  a.data=initialPlanPayload.plan.map(p=>({
   household_id:remoteHouseholdId,
   meal_date:p.date,
   slot:p.slot,
   title:p.title,
   marathi_title:p.marathi_title||p.title,
   status:p.status||'Planned',
   decision_metadata:p.explanation||{}
  }));
 }
 if(!b.data?.length && initialPlanPayload?.recipes?.length){
  b.data=initialPlanPayload.recipes.map(r=>({
   household_id:remoteHouseholdId,
   recipe_key:r.recipe_key||r.id,
   name:r.name,
   marathi_name:r.marathi_name||r.name,
   course:r.course,
   time_text:r.time_text,
   ingredients:r.ingredients||[],
   method:r.method||[],
   protein:r.protein,
   fibre:r.fibre,
   calories:r.calories,
   oil:r.oil,
   note:r.note,
   description:r.description,
   marathi_description:r.marathi_description,
   meal_category:r.meal_category||r.course,
   meal_role:r.meal_role,
   servings:r.servings||4,
   cooking_method:r.cooking_method,
   dietary_flags:r.dietary_flags||{},
   nutrition_metadata:r.nutrition_metadata||{}
  }));
 }
 if(!c.data?.length && initialPlanPayload?.members?.length){
  c.data=initialPlanPayload.members.map(m=>({
   household_id:remoteHouseholdId,
   member_key:m.member_key||m.id,
   name:m.name,
   marathi_name:m.marathi_name||m.name,
   age:m.age,
   sex:m.sex,
   weight_kg:m.weight_kg,
   height_cm:m.height_cm,
   activity:m.activity,
   note:m.note,
   sort_order:m.sort_order||0
  }));
 }
 cloudApplyingRemote=true;
 try{
  state=mapRemoteState({members:c.data,meals:a.data,recipes:b.data,shopping:d.data,prep:e.data},state);
  state.healthTips=mapHealthTips(f.data); state.healthTargets=mapHealthTargets(g.data); state.householdSettings=mapHouseholdSettings(h.data)||state.householdSettings;
  state.nutritionEducation=mapNutritionEducation(l.data); state.ingredientCatalog=mapIngredientCatalog(i.data); state.recipeIngredients=mapRecipeIngredients(j.data);
  const mealMap=new Map((a.data||[]).map(m=>[m.id,m.meal_date+'-'+m.slot]));
  const memberMap=new Map((c.data||[]).map(m=>[m.id,m.member_key]));
  const recipeMap=new Map((b.data||[]).map(r=>[r.id,r.recipe_key]));
  const remoteAssignments=mapMealAssignments(k.data,{mealMap,memberMap,recipeMap});
  if(remoteAssignments.length){
   state.mealAssignments=remoteAssignments;
  }else if(initialPlanPayload?.plan?.length && !state.mealAssignments?.length){
   const extracted=[];
   for(const p of initialPlanPayload.plan){
    const mId=`${p.date}-${p.slot}`;
    for(const asgn of (p.assignments||[])){
     extracted.push({
      mealEntryId:mId,
      memberId:asgn.member_id,
      recipeId:asgn.recipe_id||asgn.automatic_recipe_id||p.recipe_id,
      portionFactor:asgn.portion_factor||1,
      assignmentSource:asgn.assignment_source||'automatic',
      automaticRecipeId:asgn.automatic_recipe_id||p.recipe_id,
      overrideRecipeId:asgn.override_recipe_id||null,
      overrideReason:asgn.override_reason||null
     });
    }
   }
   if(extracted.length)state.mealAssignments=extracted;
  }
  state.dietaryRules=mapDietaryRules(rules.data);
  if(uiRes.data && uiRes.data.length){
   state.uiContent=mapUiContent(uiRes.data);
   contentProvider=createContentProvider(state.uiContent);
  }
  if(freqRes.data && freqRes.data.length){
   state.frequencyRules=mapFrequencyRules(freqRes.data);
  }
  state.recipes=state.recipes.map(r=>buildStructuredRecipe(r,state.recipeIngredients,state.ingredientCatalog));
  ensureAutomaticAssignments();
  localStorage.setItem(STORAGE,JSON.stringify(state));
 }finally{cloudApplyingRemote=false;}
}
function mapNutritionEducation(rows){return rows.map(x=>({id:x.concept_key,title:x.title,marathiTitle:x.marathi_title,what:x.what,marathiWhat:x.marathi_what,bodyUse:x.body_use,marathiBodyUse:x.marathi_body_use,function:x.function,marathiFunction:x.marathi_function,whyItMatters:x.why_it_matters,marathiWhyItMatters:x.marathi_why_it_matters,foodSources:x.food_sources,marathiFoodSources:x.marathi_food_sources,sortOrder:x.sort_order}));}
function ensureAutomaticAssignments(){
 const existing=new Map((state.mealAssignments||[]).map(a=>[`${a.mealEntryId}:${a.memberId}`,a]));
 for(const meal of state.meals){
  const recipe=state.recipes.find(r=>r.name.toLowerCase()===meal.title.toLowerCase());
  const generated=buildAutomaticAssignments({...meal,recipeId:recipe?.id},state.members,state.recipes,state.dietaryRules?.length?state.dietaryRules:DEFAULT_DIETARY_RULES,{assignments:[...existing.values()],meals:state.meals,frequencyRules:state.frequencyRules||DEFAULT_FREQUENCY_RULES});
  for(const a of generated){const key=`${meal.id}:${a.memberId}`;if(!existing.has(key))existing.set(key,a);}
 }
 state.mealAssignments=[...existing.values()];
}
async function syncPhase2(){
 if(!remoteHouseholdId)return true;
 try{
  const {data:recipeRows,error:recipeErr}=await supabase.from('recipes').select('id,recipe_key').eq('household_id',remoteHouseholdId);
  if(recipeErr)throw recipeErr;
  const recipeUuid=new Map((recipeRows||[]).map(x=>[x.recipe_key,x.id]));
  const ingredientUuid=new Map((state.ingredientCatalog||[]).map(x=>[x.canonicalKey,x.id]));
  const rows=[];
  for(const recipe of state.recipes){
   const recipeId=recipeUuid.get(recipe.id); if(!recipeId)continue;
   const mapped=(recipe.ingredients||[]).filter(x=>x.ingredientKey&&ingredientUuid.has(x.ingredientKey));
   mapped.forEach((x,idx)=>rows.push({household_id:remoteHouseholdId,recipe_id:recipeId,ingredient_id:ingredientUuid.get(x.ingredientKey),quantity:Number(x.quantity),unit:x.unit,display_text:x.displayText||null,preparation:x.preparation||null,sort_order:idx}));
  }
  if(rows.length){const {error}=await supabase.from('recipe_ingredients').upsert(rows,{onConflict:'recipe_id,ingredient_id,sort_order'});if(error)throw error;}
  const mealRows=await supabase.from('meal_entries').select('id,meal_date,slot').eq('household_id',remoteHouseholdId); if(mealRows.error)throw mealRows.error;
  const memberRows=await supabase.from('family_members').select('id,member_key').eq('household_id',remoteHouseholdId); if(memberRows.error)throw memberRows.error;
  const mealUuid=new Map((mealRows.data||[]).map(x=>[`${x.meal_date}-${x.slot}`,x.id])); const memberUuid=new Map((memberRows.data||[]).map(x=>[x.member_key,x.id]));
  const assignments=(state.mealAssignments||[]).map(a=>({household_id:remoteHouseholdId,meal_entry_id:mealUuid.get(a.mealEntryId),member_id:memberUuid.get(a.memberId),recipe_id:recipeUuid.get(a.recipeId)||null,portion_factor:a.portionFactor||1,assignment_source:a.assignmentSource||'automatic',automatic_recipe_id:recipeUuid.get(a.automaticRecipeId)||null,override_recipe_id:recipeUuid.get(a.overrideRecipeId)||null,override_reason:a.overrideReason||null})).filter(x=>x.meal_entry_id&&x.member_id);
  if(assignments.length){const {error}=await supabase.from('meal_assignments').upsert(assignments,{onConflict:'meal_entry_id,member_id'});if(error)throw error;}
  return true;
 }catch(err){console.warn('Phase 2 cloud sync failed',err);return false;}
}

function subscribeToHousehold(){
 if(!remoteHouseholdId)return;
 if(realtimeChannel)supabase.removeChannel(realtimeChannel);
 const tables=[...REMOTE_TABLES,'household_settings','recipe_ingredients','meal_assignments','household_frequency_rules'];
 realtimeChannel=supabase.channel(`kutumb-bhojan-${remoteHouseholdId}`);
 for(const table of tables){
  realtimeChannel=realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table,filter:`household_id=eq.${remoteHouseholdId}`},()=>scheduleRemoteRefresh());
 }
 realtimeChannel.subscribe(status=>{if(status==='CHANNEL_ERROR')console.warn('Realtime channel error');});
}
function scheduleRemoteRefresh(){
 clearTimeout(cloudRefreshTimer);
 cloudRefreshTimer=setTimeout(async()=>{
  if(!remoteReady||cloudApplyingRemote)return;
  try{await loadRemote();await loadDerivedShopping();render();}catch(err){console.warn('realtime refresh failed',err);}
 },250);
}
function cleanupCloud(){
 clearTimeout(cloudRefreshTimer);
 if(realtimeChannel){supabase.removeChannel(realtimeChannel);realtimeChannel=null;}
 remoteReady=false;
 remoteHouseholdId=null;
}
async function initCloud(){
 if(cloudInitializing)return;
 cloudInitializing=true;
 try{
  let {data:{session}}=await supabase.auth.getSession();
  if(!session){
   const {data,error}=await supabase.auth.signInAnonymously();
   if(error)throw error;
   session=data.session;
  }
  let urlJoinCode=null;
  try{
   const params=new URLSearchParams(window.location.search);
   urlJoinCode=params.get('join')||params.get('invite');
  }catch(_e){}
  if(urlJoinCode){
   const {data:joinedId,error:joinErr}=await supabase.rpc('join_household',{invite_token:urlJoinCode});
   if(!joinErr&&joinedId){
    remoteHouseholdId=joinedId;
    toast(t('msg.household_joined','Family household joined · कुटुंबात यशस्वीरित्या सामील झाले'));
    try{
     const url=new URL(window.location.href);
     url.searchParams.delete('join');
     url.searchParams.delete('invite');
     window.history.replaceState({},'',url.pathname+(url.search?url.search:''));
    }catch(_e){}
   }else{
    console.warn('join_household from URL failed',joinErr);
    toast(t('msg.invite_invalid','Invalid or expired invite code · अमान्य किंवा कालबाह्य कोड'));
   }
  }
  if(!remoteHouseholdId){
   const {data,error}=await supabase.rpc('bootstrap_household',{household_name:'कुटुंब भोजन'});
   if(error)throw error;
   remoteHouseholdId=data;
  }
  await loadRemote();
  await loadDerivedShopping();
  remoteReady=true;
  await syncPhase2();
  subscribeToHousehold();
  render();
  }catch(err){
   console.error('Cloud initialization failed',err);
   cleanupCloud();
   if(!state.meals?.length){
    try{
     const planRes=await fetch('/api/planning/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start_date:'2026-09-07',visible_days:7,evaluation_days:30})});
     if(planRes.ok){
      const pData=await planRes.json();
      if(pData?.plan?.length){
       state=mapRemoteState({members:pData.members||[],meals:pData.plan.map(p=>({meal_date:p.date,slot:p.slot,title:p.title,marathi_title:p.marathi_title||p.title,status:p.status||'Planned',decision_metadata:p.explanation||{}})),recipes:pData.recipes||[],shopping:[],prep:[]},state);
       localStorage.setItem(STORAGE,JSON.stringify(state));
      }
     }
    }catch(_pErr){console.warn('Fallback planning fetch failed',_pErr);}
   }
   render();
   toast(t('msg.cloud_sync_unavailable','Cloud sync unavailable · क्लाउड sync उपलब्ध नाही. Local data चालू आहे.'));
  }finally{cloudInitializing=false;}
}
supabase.auth.onAuthStateChange((_event,session)=>{
 if(session&&!remoteReady)initCloud();
 if(!session){cleanupCloud();initCloud();}
});
window.addEventListener('online', ()=>{
 toast(t('msg.online_restored','Connection restored · कनेक्शन परत आले'));
 if(!remoteReady) initCloud();
 else scheduleRemoteRefresh();
});
window.addEventListener('offline', ()=>{
 toast(t('msg.offline_mode','Offline mode · ऑफलाइन मोड — बदल स्थानिक जतन होतील'));
});
function toast(msg){clearTimeout(toastTimer);const el=document.getElementById('toast');if(!el)return;el.textContent='✓ '+msg;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),1600)}
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function dateLabel(d){return new Intl.DateTimeFormat(language==='en'?'en-IN':'mr-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T00:00:00'))}
function fmt(d){return new Intl.DateTimeFormat(language==='en'?'en-IN':'mr-IN',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d+'T00:00:00'))}
function findRecipe(title){return state.recipes.find(r=>r.name.toLowerCase()===String(title||'').toLowerCase())||null}
function applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='system'?'light dark':theme}
function setTheme(value){
 theme=value;
 try{ localStorage.setItem(THEME_STORAGE,value); }catch(err){ console.warn('theme localStorage write failed',err); }
 applyTheme();
 render();
}
function applyLanguage(){document.documentElement.dataset.language=language}
function setLanguage(value){
 language=['mr','en','both'].includes(value)?value:'both';
 try{ localStorage.setItem(LANGUAGE_STORAGE,language); }catch(err){ console.warn('language localStorage write failed',err); }
 tts.stop();
 applyLanguage();
 render();
}

function t(keyOrMr, fallbackEn){
  if(contentProvider && contentProvider.has(keyOrMr)){
    return contentProvider.get(keyOrMr, language, fallbackEn);
  }
  const isKeyLike = typeof keyOrMr === 'string' && /^[a-z0-9_.-]+$/i.test(keyOrMr) && keyOrMr.includes('.');
  if(isKeyLike){
    if(fallbackEn) return fallbackEn;
    const parts = keyOrMr.split('.');
    const label = parts[parts.length - 1].replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const mrText = keyOrMr || '';
  const enText = fallbackEn || '';
  if(language === 'mr') return mrText || enText || '';
  if(language === 'en') return enText || mrText || '';
  if(!mrText) return enText || '';
  if(!enText || enText === mrText) return mrText;
  return `${mrText} · ${enText}`;
}
function ui(keyOrMr, fallbackEn){
  return t(keyOrMr, fallbackEn);
}

function getSlotName(slot){
  const key = `slot.${String(slot||'').toLowerCase()}`;
  if(contentProvider && contentProvider.has(key)){
    return t(key);
  }
  return slotMr[slot] || slot;
}

function ttsButtonLabel(isPlaying, lang=language){
  const action = isPlaying ? 'tts.stop' : 'tts.listen';
  const icon = isPlaying ? '⏹ ' : '🔊 ';
  const label = contentProvider ? contentProvider.get(action, lang) : (isPlaying ? 'थांबवा / Stop' : 'ऐका / Listen');
  return `${icon}<span class="tts-label">${esc(label)}</span>`;
}

function ttsButtonHtml(key, mrText, enText, extraClass=''){
 if(!tts.isSupported()) return '';
 const active=tts.isSpeaking() && tts.getCurrentKey()===key;
 const ariaLabel=contentProvider ? contentProvider.get(active ? 'tts.stop' : 'tts.listen', language) : (active ? 'थांबवा / Stop' : 'ऐका / Listen');
 return `<button type="button" class="tts-btn ${active?'active':''} ${extraClass}" data-tts-key="${esc(key)}" data-tts-mr="${esc(mrText)}" data-tts-en="${esc(enText)}" aria-label="${esc(ariaLabel)}" aria-pressed="${active?'true':'false'}">${ttsButtonLabel(active,language)}</button>`;
}

function assignmentsForMeal(meal){return (state.mealAssignments||[]).filter(a=>a.mealEntryId===meal.id);}
function assignmentOptions(meal,member,assignment){
 const current=assignment?.recipeId;
 const rules = state.dietaryRules?.length ? state.dietaryRules : DEFAULT_DIETARY_RULES;
 const candidates=state.recipes.filter(r=>evaluateRecipeEligibility(member,r,rules).eligible);
 return candidates.map(r=>`<option value="${esc(r.id)}" ${r.id===current?'selected':''}>${esc(t(r.mr,r.name))}</option>`).join('');
}

function mealAssignmentsView(meal){
 const assignments=assignmentsForMeal(meal);
 if(!assignments.length)return '';
 const grouped=groupMemberAssignments(assignments, state.members, state.recipes);

 const familySummary = !grouped.hasAlternates
   ? `<div class="family-meal-badge">
        <span>👨‍👩‍👦 ${t('meal_member.family')}</span>
        <small>${state.members.length} ${t('meal_member.shared_meal')}</small>
      </div>`
   : `<div class="member-alternates-box">
        <div class="alternates-title">👨‍👩‍👦 ${t('meal_member.member_changes')}</div>
        ${grouped.groups.map(g=>{
          const memberList = g.members.map(m=>esc(t(m.mr,m.name))).join(', ');
          const isMissing = !g.recipe && !g.recipeId;
          const recName = g.recipe ? esc(t(g.recipe.mr,g.recipe.name)) : (isMissing ? `<span class="alternate-missing-text">${t('meal_member.no_alternate')}</span>` : t('meal_member.alternate'));
          const hasFreqNote = g.members.some(m => {
            const a = assignments.find(x => x.memberId === m.id);
            return a?.frequencyConstraintApplied || (a?.overrideReason && a.overrideReason.includes('frequency'));
          });
          const tag = g.hasOverride
            ? `<span class="override-tag">${t('meal_member.override')}</span>`
            : hasFreqNote
              ? `<span class="frequency-tag" title="${t('meal_member.freq_pref')}">🧀 ${t('meal_member.freq_pref')}</span>`
              : g.hasAutoAlternate
                ? `<span class="alternate-note">${t('meal_member.auto_alt')}</span>`
                : '';
          return `<div class="alternate-row"><b>${memberList}:</b> <span>${recName}</span> ${tag}</div>`;
        }).join('')}
        ${assignments.some(a=>!a.recipeId&&a.overrideReason&&a.overrideReason.includes('frequency'))?`<div class="alternate-warning">⚠️ ${t('meal_member.no_suitable_alt')}</div>`:''}
      </div>`;

  const wasOpen = typeof document !== 'undefined' && document.getElementById(`details-${meal.id}`)?.open;
  return `<div class="meal-assignments">
    ${familySummary}
    <details class="member-editor-details" id="details-${esc(meal.id)}" ${wasOpen ? 'open' : ''}>
      <summary class="member-editor-summary">
       <span>⚙️ ${t('meal_member.change_for_day', 'Change for this day')}</span>
     </summary>
     <div class="member-editor-rows">
       ${state.members.map(member=>{
         const a=assignments.find(x=>x.memberId===member.id);
         const recipe=state.recipes.find(r=>r.id===a?.recipeId);
         const isOverridden = a?.assignmentSource==='manual';
         return `<div class="assignment-row ${isOverridden?'overridden':''}">
           <div class="assignment-member">
             <b>${esc(t(member.mr,member.name))}</b>
             <small>${recipe?esc(t(recipe.mr,recipe.name)):''}</small>
           </div>
           <div class="assignment-controls">
             <label class="assignment-change">
               <span class="sr-only">${t('meal_member.change_label')}</span>
               <select data-change-assignment="${esc(meal.id)}" data-member-id="${esc(member.id)}">
                 ${assignmentOptions(meal,member,a)}
               </select>
             </label>
             ${isOverridden?`<button type="button" class="secondary tiny" data-revert-assignment="${esc(meal.id)}" data-member-id="${esc(member.id)}">${t('meal_member.revert', 'Revert to automatic')}</button>`:''}
           </div>
         </div>`;
       }).join('')}
     </div>
   </details>
 </div>`;
}

function mealCard(m){
 const recipe=findRecipe(m.title);
 const concepts=recipe?getRecipeNutritionConcepts(recipe,state.nutritionEducation):[];
 const slotLabel=getSlotName(m.slot);
 const mealSpeechMr=`${slotLabel}: ${m.marathi||m.title}. ${recipe?.note?`टीप: ${recipe.note}. `:''}${concepts.length?`पोषण: ${concepts.map(c=>c.marathiTitle).join(', ')}.`:''}`;
 const mealSpeechEn=`${slotLabel}: ${m.title}. ${recipe?.note?`Note: ${recipe.note}. `:''}${concepts.length?`Nutrition: ${concepts.map(c=>c.title).join(', ')}.`:''}`;
 return `<article class="meal-card">
  <div class="meal-card-head">
   <div class="meal-slot"><span>${icon[m.slot]||'🍲'}</span><div><b>${slotLabel}</b><small>${m.slot}</small></div></div>
   ${ttsButtonHtml(`meal-${m.id}`,mealSpeechMr,mealSpeechEn,'meal-tts-btn')}
  </div>
  <h3>${esc(m.marathi||m.title)}</h3>
  <p>${esc(m.title)}</p>
  ${m.explanation && m.explanation.reasons && m.explanation.reasons.length ? `
  <div class="meal-explanation" title="Planner Explanation">
    <small>💡 ${esc(m.explanation.reasons.slice(0, 2).join(' · '))}</small>
  </div>` : ''}
  ${concepts.length?`<div class="meal-nutrition-pills">${concepts.slice(0,4).map(e=>`<span>${esc(t(e.marathiTitle,e.title))}</span>`).join('')}</div>`:''}
  <button class="link" data-recipe="${esc(m.title)}">${t('recipe.view_button')}</button>
  <div class="slot-reschedule">
    <span>${t('recipe.change_slot')}</span>
    <select data-reschedule-slot="${esc(m.id)}">${state.recipes.map(r=>`<option value="${esc(r.name)}" ${r.name.toLowerCase()===m.title.toLowerCase()?'selected':''}>${esc(t(r.mr,r.name))}</option>`).join('')}</select>
    <button class="btn-reason-change" data-reason-change="${esc(m.id)}" title="${t('meal.reason_change_title', 'कारण निवडून बदला / Change with reason')}">⚡ ${t('meal.reason_change', 'बदला')}</button>
  </div>
  ${mealAssignmentsView(m)}
  ${mealBalanceMini(m)}
 </article>`;
}

function mealBalanceMini(meal){const result=evaluateMealBalance(assignmentsForMeal(meal),state.recipes);const present=result.indicators.filter(x=>x.status==='present').map(x=>`<span>✓ ${esc(t(x.marathiLabel,x.label))}</span>`).join('');return present?`<div class="balance-mini"><b>${t('balance.title')}</b>${present}</div>`:'';}
function head(k,tVal,s,action=''){return `<div class="section-head"><div><div class="kicker">${k}</div><h2>${tVal}</h2><p>${s}</p></div>${action}</div>`;}

function healthTipCard(tVal,compact=false){
 const mrSpeech=`${tVal.mrTitle}. ${tVal.mrSummary}. आजचा छोटा बदल: ${tVal.mrAction}.`;
 const enSpeech=`${tVal.title}. ${tVal.detail}. Small action: ${tVal.mrAction}.`;
 return `<article class="health-card ${compact?'compact':''}">
  <div class="health-card-top">
   <span class="health-category">${esc(tVal.category)}</span>
   ${compact?'':ttsButtonHtml(`health-${tVal.id}`,mrSpeech,enSpeech,'health-tts-btn')}
  </div>
  <h3>${esc(tVal.mrTitle)}</h3>
  <p class="health-en">${esc(tVal.title)}</p>
  <p>${esc(tVal.mrSummary)}</p>
  <div class="health-action"><b>${t('health.action_title')}</b><p>${esc(tVal.mrAction)}</p></div>
  ${compact?'':`<details><summary>${t('health.more_details')}</summary><p>${esc(tVal.mrDetail)}</p><p class="muted">${esc(tVal.detail)}</p>${tVal.sourceUrl?`<a href="${esc(tVal.sourceUrl)}" target="_blank" rel="noreferrer">${esc(tVal.sourceLabel||'Source')}</a>`:''}</details>`}
 </article>`;
}

function oilSnapshot(){
 const s=state.householdSettings||starter.householdSettings;
 const size=Math.max(1,Number(s.householdSize)||4);
 const target=Math.max(1,Number(s.oilMonthlyTargetMl)||3000);
 const stock=Math.max(0,Number(s.oilStockMl)||0);
 const daily=(target/30).toFixed(0);
 const perPerson=(target/30/size).toFixed(0);
 const status=stock<=target?t('oil.within_target'):t('oil.stock_above');
 return `<div class="target-card oil-target">
  <div class="target-icon">🫗</div>
  <div>
   <div class="kicker">${t('oil.household_target')}</div>
   <h3>${t('oil.title')}</h3>
   <p>${stock.toLocaleString('en-IN')} ml ${t('oil.stock')} · ${status}</p>
  </div>
  <div class="target-values">
   <strong>${target.toLocaleString('en-IN')} ml</strong>
   <span>${t('oil.monthly_target')}</span>
  </div>
  <div class="target-meta">
   <span>≈ ${daily} ml/day ${t('oil.household')}</span>
   <span>≈ ${perPerson} ml/person/day</span>
  </div>
  <button class="secondary" data-page="settings">${t('oil.change_target')}</button>
 </div>`;
}

function targetCards(){return (state.healthTargets||[]).filter(x=>x.id!=='household_oil_planning').slice(0,4).map(tVal=>`<article class="target-mini"><span>${esc(tVal.category)}</span><strong>${esc(tVal.valueText||tVal.value)} ${esc(tVal.unit||'')}</strong><b>${esc(t(tVal.mrLabel,tVal.label))}</b><small>${esc(t(tVal.mrContext,tVal.context))}</small></article>`).join('')}

function today(){
 const meals=state.meals.filter(x=>x.date===selectedDate).sort((a,b)=> slots.indexOf(a.slot) - slots.indexOf(b.slot));
 const tasks=state.prep.filter(x=>x.date===selectedDate);
 const buy=state.shopping.filter(x=>x.need&&!x.purchased).length;
 const tip=state.healthTips?.[0];
 const todayMrSpeech=`आजच्या ताटात: ${meals.map(m=>`${getSlotName(m.slot)}: ${m.marathi||m.title}`).join(', ')}. अन्न → पोषण → शरीर. प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.`;
 const todayEnSpeech=`What are we eating today: ${meals.map(m=>`${m.slot}: ${m.title}`).join(', ')}. Food to nutrition to body. Understand what each food contributes to the body.`;
 return `${head(t('today.kicker'),t('today.title','What are we eating today?'),t('today.subtitle'))}
 <div class="today-learning-strip">
  <div>
   <span class="learning-kicker">🍽️ ${t('today.learning_kicker','आजच्या ताटात')}</span>
   <strong>${t('today.learning_title')}</strong>
   <small>${t('today.learning_sub')}</small>
  </div>
  <div class="today-learning-actions">
   ${ttsButtonHtml('today-learning',todayMrSpeech,todayEnSpeech,'today-tts-btn')}
   <button class="secondary" data-page="health">${t('today.learning_cta','Learn about nutrition')} →</button>
  </div>
 </div>
 <div class="today-balance-banner">
  <div>
   <b>⚖️ ${t('today.balance_title','Meal balance')}</b>
   <span>${t('today.balance_sub')}</span>
  </div>
 </div>
 <div class="day-picker">
  <button data-day="prev" aria-label="${t('today.prev_day')}">←</button>
  <input id="date" type="date" value="${selectedDate}">
  <button data-day="next" aria-label="${t('today.next_day')}">→</button>
 </div>
 <div class="meal-grid">${meals.map(mealCard).join('')}</div>
 ${todayFoodLearning(meals)}
 <div class="dashboard-health">${tip?healthTipCard(tip,true):''}${oilSnapshot()}</div>
 <div class="target-grid">${targetCards()}</div>
 <div class="three-col">
  <div class="panel">
   <div class="panel-title">🔪 ${t('today.prep_title')}</div>
   ${tasks.length?tasks.map(tVal=>`<label class="check-row"><input type="checkbox" data-prep="${tVal.id}" ${tVal.done?'checked':''}><span><b>${esc(t(tVal.mr,tVal.task))}</b><small>${esc(tVal.task)}</small></span></label>`).join(''):`<p class="muted">${t('today.no_prep')}</p>`}
  </div>
  <div class="panel">
   <div class="panel-title">🛒 ${t('today.shopping_title')}</div>
   <div class="big-number">${buy}</div>
   <p>${t('today.shopping_remaining')}</p>
   <button class="primary" data-page="shopping">${t('today.open_shopping')}</button>
  </div>
  <div class="panel">
   <div class="panel-title">🌿 ${t('today.health_title')}</div>
   <p>${t('today.health_desc')}</p>
   <button class="primary" data-page="health">${t('today.view_health')}</button>
  </div>
 </div>`;
}

function calendar(){
 const month=selectedDate.slice(0,7);
 const dates=[...new Set(state.meals.filter(x=>x.date.startsWith(month)).map(x=>x.date))].sort();
 return `${head(t('calendar.kicker'),t('calendar.title'),t('calendar.subtitle'))}
 <div class="toolbar">
  <input id="month" type="month" value="${month}">
  <span>${dates.length} ${t('calendar.days')} · ${dates.length*4} ${t('calendar.meal_entries')}</span>
 </div>
 <div class="calendar-grid">${dates.map(d=>`<button class="calendar-day ${d===selectedDate?'selected':''}" data-select-date="${d}"><strong>${new Date(d+'T00:00:00').getDate()}</strong><span>${fmt(d)}</span><em>4 ${t('calendar.meals')}</em></button>`).join('')}</div>
 <div class="selected-day"><h3>${dateLabel(selectedDate)}</h3>${state.meals.filter(x=>x.date===selectedDate).sort((a,b)=> slots.indexOf(a.slot) - slots.indexOf(b.slot)).map(mealCard).join('')}</div>`;
}

function recipesView(){
 return `${head(t('recipes.kicker'),t('recipes.title'),t('recipes.subtitle'))}
 <div class="search">
  <input id="recipeSearch" placeholder="${t('recipes.search_placeholder')}">
  <button class="primary" data-add-recipe>+ ${t('recipes.add_button')}</button>
  <span id="recipeCount">${state.recipes.length} ${t('recipes.count')}</span>
 </div>
 <div id="recipeGrid" class="recipe-grid">${state.recipes.map(r=>recipeCard(r)).join('')}</div>`;
}

function recipeCard(r){
 const concepts=getRecipeNutritionConcepts(r,state.nutritionEducation);
 return `<button class="recipe-card" data-recipe-id="${r.id}">
  <div class="recipe-top"><span>🍲</span><small>${esc(r.time)}</small></div>
  <h3>${esc(r.mr)}</h3>
  <p>${esc(r.name)}</p>
  <div class="metrics">
   <span>💪 ${t('nutrition.protein')} ${esc(r.protein||'—')}</span>
   <span>🌾 ${t('nutrition.fibre')} ${esc(r.fibre||'—')}</span>
   <span>🫗 ${t('nutrition.oil')} ${esc(r.oil||'—')}</span>
  </div>
  ${concepts.length?`<div class="recipe-learning">${concepts.slice(0,3).map(e=>`<span>↗ ${esc(t(e.marathiTitle,e.title))}</span>`).join('')}</div>`:''}
 </button>`;
}

function detail(r){
 const education=getRecipeNutritionConcepts(r,state.nutritionEducation);
 const ingredients=r.ingredients||[];
 const legacy=r.legacyUnmapped||[];
 const conceptMr=education.map(e=>`${e.marathiTitle}: ${e.marathiFunction}`).join('. ');
 const conceptEn=education.map(e=>`${e.title}: ${e.function}`).join('. ');
 const ingSpeechMr=ingredients.map(x=>typeof x==='string'?x:`${x.quantity} ${x.unit} ${x.displayText||x.ingredientKey}`).join(', ');
 const ingSpeechEn=ingredients.map(x=>typeof x==='string'?x:`${x.quantity} ${x.unit} ${x.ingredientKey}`).join(', ');
 const mrSpeech=[r.mr,`तयारीची वेळ: ${r.time}, ${r.servings||4} व्यक्तींसाठी.`,`साहित्य: ${ingSpeechMr}.`,`पोषण: प्रोटीन ${r.protein||'—'}, फायबर ${r.fibre||'—'}, तेल ${r.oil||'—'}.`,r.note?`नोंद: ${r.note}.`:'',conceptMr?`पोषण माहिती: ${conceptMr}.`:''].filter(Boolean).join(' ');
 const enSpeech=[r.name,`Cooking time: ${r.time}, for ${r.servings||4} servings.`,`Ingredients: ${ingSpeechEn}.`,`Nutrition: Protein ${r.protein||'—'}, Fibre ${r.fibre||'—'}, Oil ${r.oil||'—'}.`,r.note?`Note: ${r.note}.`:'',conceptEn?`Nutrition details: ${conceptEn}.`:''].filter(Boolean).join(' ');
 return `<div>
  <button class="back" data-back>← ${t('recipe.back')}</button>
  <div class="detail">
   <div class="detail-head">
    <div>
     <div class="kicker">${t('recipe.kicker')}</div>
     <h2>${esc(r.mr)}</h2>
     <p>${esc(r.name)}</p>
     <div class="recipe-tags">
      <span>${esc(r.mealCategory||r.course||'Meal')}</span>
      <span>${esc(r.mealRole||'main')}</span>
      <span>${r.dietaryFlags?.containsEgg?'🥚 '+t('nutrition.egg'):'🌿 '+t('nutrition.vegetarian')}</span>
     </div>
     <div class="detail-actions">
      <button class="secondary" data-edit-recipe="${esc(r.id)}">✏️ ${t('recipe.edit_button')}</button>
      <div class="recipe-tts-wrap">${ttsButtonHtml(`recipe-${r.id}`,mrSpeech,enSpeech,'recipe-tts-btn')}</div>
     </div>
    </div>
    <div class="hero-metrics">
     <b>${esc(r.time)}</b>
     <span>${esc(r.servings||4)} ${t('recipe.servings')}</span>
    </div>
   </div>
   <div class="detail-grid">
    <div>
     <h3>${t('recipe.ingredients')}</h3>
     <ul>
      ${ingredients.map(x=>`<li>${typeof x==='string'?esc(x):`${esc(x.quantity)} ${esc(x.unit)} · ${esc(x.displayText||x.ingredientKey)}`}</li>`).join('')}
      ${legacy.map(x=>`<li class="legacy-ingredient">${esc(x)} <small>${t('recipe.legacy_unmapped')}</small></li>`).join('')}
     </ul>
    </div>
    <div>
     <h3>${t('recipe.method_steps')}</h3>
     <ol>${(r.method||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
    </div>
   </div>
   <div class="metrics big">
    <span>💪 ${t('nutrition.protein')} ${esc(r.protein||'—')}</span>
    <span>🌾 ${t('nutrition.fibre')} ${esc(r.fibre||'—')}</span>
    <span>🫗 ${t('nutrition.oil')} ${esc(r.oil||'—')}</span>
   </div>
   ${education.length?`<div class="nutrition-education">
    <h3>${t('recipe.nutrition_explained', 'Nutrition explained')}</h3>
    ${education.map(e=>`<details><summary>${esc(t(e.marathiTitle,e.title))}</summary><p><b>${t('nutrition.what')}</b> ${esc(t(e.marathiWhat,e.what))}</p><p><b>${t('nutrition.where')}</b> ${esc(t(e.marathiBodyUse,e.bodyUse))}</p><p><b>${t('nutrition.function')}</b> ${esc(t(e.marathiFunction,e.function))}</p><p><b>${t('nutrition.why')}</b> ${esc(t(e.marathiWhyItMatters,e.whyItMatters))}</p><p><b>${t('nutrition.sources', 'Food sources')}</b> ${esc(t(e.marathiFoodSources,e.foodSources))}</p></details>`).join('')}
   </div>`:''}
   ${r.note?`<div class="note"><b>${t('recipe.notes')}</b><p>${esc(r.note)}</p></div>`:''}
  </div>
 </div>`;
}

function shopping(){
 const generated=(state.derivedShopping||[]).map((x,i)=>({
  id:`derived-${x.ingredient_key||x.canonicalKey||i}-${x.unit}-${i}`,
  item:x.name||x.ingredient_key,
  mr:x.marathi_name||x.marathiName||x.name||x.ingredient_key,
  category:x.category||'Meal-derived',
  quantity:`${x.quantity} ${x.unit}`,
  need:false,
  purchased:false,
  derived:true
 }));
 const manual=state.shopping||[];
 const rows=[...generated,...manual].map(x=>`<div class="shop-row ${x.purchased?'done':''} ${x.derived?'derived':''}"><input type="checkbox" data-purchased="${esc(x.id)}" ${x.purchased?'checked':''} ${x.derived?'disabled':''}><div><b>${esc(t(x.mr,x.item))}</b><small>${esc(x.item)} · ${esc(x.category)}${x.derived?' · '+t('today.shopping_title'):''}</small></div><strong>${esc(x.quantity)}</strong>${x.derived?`<span class="derived-pill">${t('shopping.derived_pill')}</span>`:`<label class="buy-pill"><input type="checkbox" data-need="${x.id}" ${x.need?'checked':''}><span>${t('shopping.need_to_buy')}</span></label><button class="btn-delete" data-delete-shopping="${esc(x.id)}" title="${t('common.delete')}">🗑️</button>`}</div>`).join('');
 return `${head(t('shopping.kicker'),t('shopping.title'),t('shopping.subtitle'))}
 <div class="add-bar">
  <input id="newShopMr" placeholder="${t('shopping.placeholder_mr')}">
  <input id="newShopEn" placeholder="${t('shopping.placeholder_en')}">
  <input id="newShopQty" placeholder="${t('shopping.placeholder_qty')}">
  <select id="newShopCat">
   <option value="Staples">${t('category.staples')}</option>
   <option value="Pulses & Legumes">${t('category.pulses')}</option>
   <option value="Dairy">${t('category.dairy')}</option>
   <option value="Vegetables">${t('category.vegetables')}</option>
   <option value="Fruits">${t('category.fruits')}</option>
   <option value="Nuts & Seeds">${t('category.nuts')}</option>
   <option value="Spices">${t('category.spices')}</option>
   <option value="Other">${t('category.other')}</option>
  </select>
  <button class="primary" data-add-shopping>+ ${t('shopping.add_btn')}</button>
 </div>
 <div class="toolbar"><span>${manual.filter(x=>x.need&&!x.purchased).length} ${t('shopping.items_remaining')}</span></div>
 <div class="shopping-list">${rows||`<p class="muted">${t('shopping.empty')}</p>`}</div>`;
}

function prepView(){
 return `${head(t('prep.kicker'),t('prep.title'),t('prep.subtitle'))}
 <div class="add-bar">
  <input id="newPrepMr" placeholder="${t('prep.placeholder_mr')}">
  <input id="newPrepEn" placeholder="${t('prep.placeholder_en')}">
  <input id="newPrepDate" type="date" value="${selectedDate}">
  <select id="newPrepArea">
   <option value="Meal Prep">${t('prep.area_meal_prep')}</option>
   <option value="Batter / Sprouting">${t('prep.area_batter_sprouting')}</option>
   <option value="Storage">${t('prep.area_storage')}</option>
   <option value="Shopping">${t('prep.area_shopping')}</option>
   <option value="Review">${t('prep.area_review')}</option>
  </select>
  <button class="primary" data-add-prep>+ ${t('prep.add_btn')}</button>
 </div>
 <div class="prep-list">${state.prep.map(tVal=>`<div class="prep-row ${tVal.done?'done':''}"><input type="checkbox" data-prep="${tVal.id}" ${tVal.done?'checked':''}><div><b>${esc(t(tVal.mr,tVal.task))}</b><small>${esc(tVal.task)}</small></div><span>${fmt(tVal.date)}</span><em>${esc(tVal.area)}</em><button class="btn-delete" data-delete-prep="${esc(tVal.id)}" title="${t('common.delete')}">🗑️</button></div>`).join('')}</div>`;
}

function familyView(){
 const dietaryRules = state.dietaryRules?.length ? state.dietaryRules : DEFAULT_DIETARY_RULES;
 const ingredientLabel = (key)=>{
   if(key==='egg') return t('dietary.egg_label','अंडी / Egg');
   if(key==='paneer') return t('dietary.paneer_label','पनीर / Paneer');
   const cat = (state.ingredientCatalog||[]).find(x=>x.canonicalKey===key);
   if(cat) return t(cat.marathiName, cat.name);
   return key;
 };
 const dietaryPanel = `<div class="panel dietary-panel">
  <h3>🥗 ${t('dietary.panel_title','आहाराच्या पसंती / Dietary preferences')}</h3>
  <p class="muted">${t('dietary.panel_desc','प्रत्येक सदस्यासाठी कोणते पदार्थ योग्य आहेत ते निवडा. हा घरगुती पसंती आहे, वैद्यकीय सल्ला नाही. / Choose which foods are suitable per member. Household preference, not medical advice.')}</p>
  ${(dietaryRules||[]).map(rule=>{
    const ingLabel = ingredientLabel(rule.ingredientKey);
    const isEgg = rule.ingredientKey==='egg';
    const note = isEgg ? t('dietary.egg_note','अंडी असलेले पदार्थ निवडलेल्या सदस्यांसाठीच नियोजनात दिसतील. / Egg-containing meals will be planned only for selected members.') : t('dietary.generic_note','या घटक असलेले पदार्थ निवडलेल्या सदस्यांसाठी वगळले जातील किंवा पर्याय दिला जाईल. / Meals with this ingredient will be excluded or alternated for selected members.');
    return `<div class="dietary-rule">
      <div class="dietary-rule-head"><b>${esc(rule.ruleKey||rule.ingredientKey)}</b> <span>— ${esc(ingLabel)}</span> <small>${rule.active===false? t('common.disabled','Disabled'):''}</small></div>
      <p class="muted"><small>${esc(note)}</small></p>
      <div class="dietary-members">
        ${state.members.map(m=>{
          const mid=m.memberKey||m.id;
          const isAllowed = (rule.allowedMemberIds||[]).map(x=>x.toLowerCase()).includes(mid.toLowerCase());
          const isDisallowed = (rule.disallowedMemberIds||[]).map(x=>x.toLowerCase()).includes(mid.toLowerCase());
          const checked = isAllowed && !isDisallowed;
          return `<label class="dietary-member-toggle"><input type="checkbox" data-dietary-toggle="${esc(rule.ruleKey||rule.ingredientKey)}" data-member-key="${esc(mid)}" ${checked?'checked':''}><span>${esc(t(m.mr,m.name))}</span><small>${checked? t('dietary.allowed','✓ योग्य / Allowed'): t('dietary.not_allowed','✗ वगळले / Excluded')}</small></label>`;
        }).join('')}
      </div>
      <small class="muted">${t('dietary.effect_note','याचा परिणाम जेवणाच्या नियोजनावर व पर्याय निवडीवर होईल. / This affects meal planning and alternate selection.')} ${!state.recipes.some(r=>r.dietaryFlags?.containsEgg) && isEgg ? `<em>${t('dietary.no_alt_warning','पर्यायी पाककृती उपलब्ध नसल्यास सूचना दर्शवली जाईल, नवीन पाककृती तयार केली जाणार नाही. / If no suitable alternate exists, a notice will be shown — no recipe will be invented.')}</em>`:''}</small>
    </div>`;
  }).join('')}
  <p class="muted"><small>${t('dietary.safety_note','कोणतीही वैद्यकीय निदान/उपचार भाषा नाही. हा घरगुती आहार-पसंती नियम आहे. / No medical diagnosis. Household dietary preference rule only.')}</small></p>
 </div>`;
 return `${head(t('family.kicker'),t('family.title'),t('family.subtitle'))}
 <div class="family-grid">${state.members.map(m=>`<article class="person-card">
  <div class="avatar">${esc(m.name[0])}</div>
  <h3>${esc(t(m.mr,m.name))}</h3>
  <p>${esc(m.name)} · ${esc(m.age)} ${t('family.years')}</p>
  <div class="person-stats"><span>${esc(m.weight)} kg</span><span>${esc(m.height)} cm</span></div>
  <b>${esc(m.activity)}</b>
  <p class="muted">${esc(m.note)}</p>
 </article>`).join('')}</div>${dietaryPanel}`;
}

function nutritionEducationCard(e){
 const mrSpeech=`${e.marathiTitle}. काय आहे: ${e.marathiWhat}. शरीरात कुठे: ${e.marathiBodyUse}. काय करते: ${e.marathiFunction}. का आवश्यक: ${e.marathiWhyItMatters}. प्रमुख अन्न स्रोत: ${e.marathiFoodSources}.`;
 const enSpeech=`${e.title}. What is it: ${e.what}. Where in the body: ${e.bodyUse}. What does it do: ${e.function}. Why does it matter: ${e.whyItMatters}. Food sources: ${e.foodSources}.`;
 return `<article class="nutrition-class-card" data-nutrition-concept="${esc(e.id)}">
  <div class="nutrition-class-icon">🧠</div>
  <div class="nutrition-class-head">
   <div>
    <span class="health-category">${t('nav.health')}</span>
    <h3>${esc(e.marathiTitle)}</h3>
    <p>${esc(e.title)}</p>
   </div>
   ${ttsButtonHtml(`nutrition-${e.id}`,mrSpeech,enSpeech,'nutrition-tts-btn')}
  </div>
  <div class="nutrition-facts">
   <section><b>${t('nutrition.what')}</b><p>${esc(t(e.marathiWhat,e.what))}</p><small>${esc(e.what)}</small></section>
   <section><b>${t('nutrition.where')}</b><p>${esc(t(e.marathiBodyUse,e.bodyUse))}</p><small>${esc(e.bodyUse)}</small></section>
   <section><b>${t('nutrition.function')}</b><p>${esc(t(e.marathiFunction,e.function))}</p><small>${esc(e.function)}</small></section>
   <section><b>${t('nutrition.why')}</b><p>${esc(t(e.marathiWhyItMatters,e.whyItMatters))}</p><small>${esc(e.whyItMatters)}</small></section>
   <section class="food-sources"><b>${t('nutrition.sources', 'Food sources')}</b><p>${esc(t(e.marathiFoodSources,e.foodSources))}</p><small>${esc(e.foodSources)}</small></section>
  </div>
 </article>`;
}

function todayFoodLearning(meals){
 const seen=new Set();
 const foods=[];
 for(const meal of meals){
  const recipe=findRecipe(meal.title);
  for(const line of recipe?.ingredients||[]){
   const key=line.ingredientKey||line.displayText;
   if(!key||seen.has(key))continue;
   seen.add(key);
   const catalog=(state.ingredientCatalog||[]).find(x=>x.canonicalKey===key);
   foods.push({key,mr:catalog?.marathiName||key,name:catalog?.name||key,category:catalog?.category||'Food'});
   if(foods.length>=12)break;
  }
  if(foods.length>=12)break;
 }
 return `<section class="food-learning">
  <div class="food-learning-head">
   <div>
    <span class="learning-kicker">🥗 ${t('today.foods_kicker')}</span>
    <h3>${t('today.foods_title')}</h3>
    <p>${t('today.foods_sub')}</p>
   </div>
  </div>
  <div class="food-chip-grid">${foods.map(f=>`<span class="food-chip"><b>${esc(t(f.mr,f.name))}</b><small>${esc(f.name)} · ${esc(f.category)}</small></span>`).join('')||`<p class="muted">${t('today.food_details_unavailable')}</p>`}</div>
 </section>`;
}

function healthView(){
 const cats=[...new Set((state.healthTips||[]).map(x=>x.category))];
 const education=(state.nutritionEducation||[]).slice().sort((a,b)=>Number(a.sortOrder??999)-Number(b.sortOrder??999));
 return `${head(t('health.kicker'),t('health.title'),t('health.subtitle'))}
 <div class="health-notice">🌿 <b>${t('health.rule_title')}</b> ${t('health.rule_desc')}</div>
 <div class="health-filter">
  <button class="secondary health-filter-btn active" data-health-category="all">${t('health.filter_all')}</button>
  ${cats.map(c=>`<button class="secondary health-filter-btn" data-health-category="${esc(c)}">${esc(c)}</button>`).join('')}
 </div>
 <div id="healthGrid" class="health-grid">${(state.healthTips||[]).map(tVal=>healthTipCard(tVal)).join('')}</div>
 ${education.length?`<section class="nutrition-learning">
  <div class="section-head nutrition-section-head">
   <div>
    <div class="kicker">${t('health.nutrition_classroom')}</div>
    <h2>${t('health.understand_nutrition')}</h2>
    <p>${t('health.classroom_desc')}</p>
   </div>
  </div>
  <div class="nutrition-class-grid">${education.map(e=>nutritionEducationCard(e)).join('')}</div>
 </section>`:''}
 <div class="target-grid health-targets">${targetCards()}</div>
 <div class="source-note">${t('health.source_note')}</div>`;
}

function reasonModalHtml() {
  if (!reasonChangeModalMeal) return '';
  const m = reasonChangeModalMeal;
  return `<div class="modal-backdrop" data-close-reason-modal>
   <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
     <div>
      <div class="eyebrow">${t('meal.change_modal_eyebrow', 'नियोजन बदल · Meal Change')}</div>
      <h2>${t('meal.change_modal_title', 'हे जेवण का बदलायचे आहे?')}</h2>
      <p><b>${esc(m.slot)}</b> · ${esc(t(m.marathi, m.title))}</p>
     </div>
     <button class="btn-delete" data-close-reason-modal>✕</button>
    </div>
    <div class="reason-options">
     <button class="reason-btn" data-apply-reason="want_lighter">
      <strong>🍃 ${t('reason.want_lighter', 'हलके जेवण हवे / Want lighter')}</strong>
      <small>${t('reason.want_lighter_desc', 'पचनास सोपे आणि हलके अन्न पर्याय')}</small>
     </button>
     <button class="reason-btn" data-apply-reason="want_different_protein">
      <strong>💪 ${t('reason.diff_protein', 'वेगळे प्रोटीन हवे / Different protein')}</strong>
      <small>${t('reason.diff_protein_desc', 'डाळ, कडधान्य किंवा इतर प्रोटीन स्त्रोत')}</small>
     </button>
     <button class="reason-btn" data-apply-reason="want_different_grain">
      <strong>🌾 ${t('reason.diff_grain', 'वेगळे धान्य हवे / Different grain')}</strong>
      <small>${t('reason.diff_grain_desc', 'गहू सोडून ज्वारी/तांदूळ/नाचणी पर्याय')}</small>
     </button>
     <button class="reason-btn" data-apply-reason="want_quick">
      <strong>⚡ ${t('reason.want_quick', 'कमी वेळात होणारे हवे / Quick prep')}</strong>
      <small>${t('reason.want_quick_desc', 'भिजवण्याची गरज नसलेले झटपट पर्याय')}</small>
     </button>
     <button class="reason-btn" data-apply-reason="want_different_meal_form">
      <strong>🥘 ${t('reason.diff_form', 'वेगळा प्रकार हवे / Different meal form')}</strong>
      <small>${t('reason.diff_form_desc', 'भाजी-पोळी, उसळ, खिचडी इत्यादी प्रकार बदला')}</small>
     </button>
     <button class="reason-btn" data-apply-reason="not_in_mood">
      <strong>🍽️ ${t('reason.not_in_mood', 'काहीतरी वेगळे हवे / Not in the mood')}</strong>
      <small>${t('reason.not_in_mood_desc', 'पोषण सांभाळून वेगळा पाककृती पर्याय')}</small>
     </button>
    </div>
   </div>
  </div>`;
}

function buildBackupPayload(sourceState=state){
 return {
  version: 2,
  exportedAt: new Date().toISOString(),
  members: sourceState.members,
  meals: sourceState.meals,
  recipes: sourceState.recipes,
  shopping: sourceState.shopping,
  prep: sourceState.prep,
  mealAssignments:sourceState.mealAssignments||[],
  householdSettings: sourceState.householdSettings||starter.householdSettings,
  ingredientCatalog: sourceState.ingredientCatalog||[],
  recipeIngredients: sourceState.recipeIngredients||[],
  dietaryRules: sourceState.dietaryRules||[],
  nutritionEducation: sourceState.nutritionEducation||[],
  uiContent: sourceState.uiContent || CANONICAL_UI_CONTENT,
  frequencyRules: sourceState.frequencyRules || DEFAULT_FREQUENCY_RULES
 };
}

function settings(){
 const s=state.householdSettings||starter.householdSettings;
 const maxPaneer=(state.frequencyRules||DEFAULT_FREQUENCY_RULES).find(r=>r.ingredientKey==='paneer')?.maxPerCalendarMonth||5;
 return `${head(t('settings.kicker'),t('settings.title'),t('settings.subtitle'))}
 <div class="settings-grid">
  <div class="panel">
   <h3>🌗 ${t('settings.theme_title')}</h3>
   <p>${t('settings.theme_desc')}</p>
   <div class="theme-switcher">${['light','dark','system'].map(x=>`<button class="${theme===x?'active':''}" data-theme="${x}">${x==='light'?'☀️ Light':x==='dark'?'🌙 Dark':'🖥️ System'}</button>`).join('')}</div>
  </div>
  <div class="panel preference-panel">
   <div class="preference-heading">
    <div>
     <h3>🌐 Language / भाषा</h3>
     <p>${t('settings.lang_desc')}</p>
    </div>
    <span class="preference-icon">अA</span>
   </div>
   <div class="language-switcher">${[['mr','मराठी'],['en','English'],['both','मराठी + English']].map(([x,label])=>`<button class="${language===x?'active':''}" data-language="${x}">${label}</button>`).join('')}</div>
  </div>
  <div class="panel">
   <h3>🫗 ${t('settings.oil_title')}</h3>
   <p>${t('settings.oil_desc')}</p>
   <label class="field"><span>${t('settings.oil_stock_label')}</span><input id="oilStock" type="number" min="0" step="100" value="${esc(s.oilStockMl)}"></label>
   <label class="field"><span>${t('settings.oil_target_label')}</span><input id="oilTarget" type="number" min="100" step="100" value="${esc(s.oilMonthlyTargetMl)}"></label>
   <label class="field"><span>${t('settings.household_size_label')}</span><input id="householdSize" type="number" min="1" max="20" step="1" value="${esc(s.householdSize)}"></label>
   <div class="oil-advice"><b>${t('settings.oil_where_reduce')}</b><p>${t('settings.oil_reduce_advice')}</p></div>
   <button class="primary" data-save-settings>${t('settings.save_btn')}</button>
  </div>
  <div class="panel">
   <h3>🧀 ${t('settings.pref_title', 'घरगुती नियोजन प्राधान्ये / Household Planning Preferences')}</h3>
   <p>${t('settings.pref_desc', 'पनीर मासिक वारंवारता मर्यादा (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही). / Paneer monthly frequency limit (household planning preference, not medical advice).')}</p>
   <div class="frequency-status-box">
    <div class="frequency-status-row">
     <span><b>${t('settings.paneer_usage_label')}</b></span>
     <strong>${countIngredientMonthlyOccurrences({assignments:state.mealAssignments,recipes:state.recipes,meals:state.meals,ingredientKey:'paneer',month:selectedDate.slice(0,7)})} / ${maxPaneer} ${t('calendar.meals')}</strong>
    </div>
    <small class="muted">${t('settings.paneer_limit_note')}</small>
   </div>
  </div>
  <div class="panel">
   <h3>💾 ${t('settings.backup_title')}</h3>
   <p>${t('settings.backup_desc')}</p>
   <button class="primary" data-export>⬇ ${t('settings.export_btn')}</button>
   <label class="secondary upload">⬆ ${t('settings.import_btn')}<input id="importFile" type="file" accept="application/json"></label>
  </div>
  <div class="panel">
   <h3>☁️ ${t('settings.cloud_title')}</h3>
   <p>${t('settings.cloud_desc', 'Login/OTP लागत नाही. प्रत्येक device ला anonymous session मिळतो आणि shared household data Supabase मध्ये sync होतो.')}</p>
   <p class="muted">${t('settings.cloud_note')}</p>
  </div>
  <div class="panel">
   <h3>🔗 ${t('settings.family_sharing_title', 'Family Sharing / कुटुंब जोडणी')}</h3>
   <p>${t('settings.family_sharing_desc', 'नवीन फोन किंवा family member ला जोडण्यासाठी Invite Code वापरा. / Use an invite code to securely connect another family device.')}</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
    <button class="primary" data-generate-invite>${t('settings.generate_invite_btn', 'Generate Invite Code / जोडणी कोड तयार करा')}</button>
    <span id="activeInviteDisplay" style="font-weight:bold;letter-spacing:1px"></span>
   </div>
   <div style="display:flex;gap:8px;align-items:center">
    <input id="joinInviteInput" placeholder="${esc(t('settings.enter_invite_ph', 'Enter invite code (e.g. KB-XXXX-XXXX) / कोड प्रविष्ट करा'))}" style="max-width:260px">
    <button class="secondary" data-join-invite>${t('settings.join_btn', 'Join / सामील व्हा')}</button>
   </div>
  </div>
  <div class="panel">
   <h3>↺ ${t('settings.starter_title')}</h3>
   <p>${t('settings.starter_desc')}</p>
   <button class="danger" data-reset>${t('settings.reset_btn')}</button>
  </div>
 </div>`;
}

function recipeModalHtml(){
 const r = editingRecipe;
 const ingLines = r ? (r.legacyIngredients || r.ingredients || []).map(x => typeof x === 'string' ? x : `${x.quantity} ${x.unit} ${x.ingredientKey}`).join('\n') : '';
 const methodLines = r ? (r.method || []).join('\n') : '';
 return `<div class="modal-overlay" id="recipeModal">
  <div class="modal-card">
   <div class="modal-head">
    <h3>${r ? t('recipe_form.edit_title') : t('recipe_form.add_title')}</h3>
    <button class="btn-delete" data-close-recipe-modal title="${t('recipe_form.close')}">✕</button>
   </div>
   <div class="form-grid">
    <div>
     <label>${t('recipe_form.mr_name_label')}</label>
     <input id="recipeFormMr" placeholder="${t('recipe_form.mr_name_ph')}" value="${esc(r?.mr || '')}">
    </div>
    <div>
     <label>${t('recipe_form.en_name_label')}</label>
     <input id="recipeFormName" placeholder="e.g. Moong Vegetable Chilla" value="${esc(r?.name || '')}">
    </div>
    <div>
     <label>${t('recipe_form.category_label')}</label>
     <select id="recipeFormCourse">
      ${['Breakfast','Lunch','Snack','Dinner','Lunch/Dinner'].map(c => `<option value="${c}" ${(r?.course === c || r?.mealCategory === c) ? 'selected' : ''}>${c}</option>`).join('')}
     </select>
    </div>
    <div>
     <label>${t('recipe_form.role_label')}</label>
     <select id="recipeFormRole">
      <option value="main" ${r?.mealRole === 'main' ? 'selected' : ''}>${t('recipe_form.role_main')}</option>
      <option value="snack" ${r?.mealRole === 'snack' ? 'selected' : ''}>${t('recipe_form.role_snack')}</option>
      <option value="side" ${r?.mealRole === 'side' ? 'selected' : ''}>${t('recipe_form.role_side')}</option>
     </select>
    </div>
    <div>
     <label>${t('recipe_form.time_label')}</label>
     <input id="recipeFormTime" placeholder="20 min" value="${esc(r?.time || '20 min')}">
    </div>
    <div>
     <label>${t('recipe_form.servings_label')}</label>
     <input id="recipeFormServings" type="number" min="1" max="20" value="${esc(r?.servings || 4)}">
    </div>
    <div class="full-width">
     <label>${t('recipe_form.method_label')}</label>
     <input id="recipeFormCookingMethod" placeholder="Stovetop / Pan / Pressure cook" value="${esc(r?.cookingMethod || 'Stovetop')}">
    </div>
    <div class="full-width">
     <label>${t('recipe_form.ingredients_label')}</label>
     <textarea id="recipeFormIngredients" rows="5" placeholder="200 g moong dal&#10;100 g vegetables&#10;10 ml oil">${esc(ingLines)}</textarea>
    </div>
    <div class="full-width">
     <label>${t('recipe_form.steps_label')}</label>
     <textarea id="recipeFormMethod" rows="4" placeholder="Blend soaked moong.&#10;Cook on tawa with measured oil.">${esc(methodLines)}</textarea>
    </div>
    <div class="full-width">
     <label>${t('recipe_form.notes_label')}</label>
     <input id="recipeFormNote" placeholder="${t('recipe_form.notes_ph')}" value="${esc(r?.note || '')}">
    </div>
   </div>
   <div class="modal-actions">
    <button class="secondary" data-close-recipe-modal>${t('recipe_form.cancel_btn')}</button>
    <button class="primary" data-save-recipe>${t('recipe_form.save_btn')}</button>
   </div>
  </div>
 </div>`;
}

function render(){
 const nav=[
  ['today','🏠',t('nav.today')],
  ['calendar','📅',t('nav.calendar')],
  ['recipes','🍳',t('nav.recipes')],
  ['health','🌿',t('nav.health')],
  ['shopping','🛒',t('nav.shopping')],
  ['prep','🔪',t('nav.prep')],
  ['family','👨‍👩‍👦',t('nav.family')],
  ['settings','⚙️',t('nav.settings')]
 ];
 let body=selectedRecipe?detail(selectedRecipe):page==='today'?today():page==='calendar'?calendar():page==='recipes'?recipesView():page==='health'?healthView():page==='shopping'?shopping():page==='prep'?prepView():page==='family'?familyView():settings();
 const modal=(showRecipeModal?recipeModalHtml():'')+(reasonChangeModalMeal?reasonModalHtml():'');
 document.getElementById('app').innerHTML=`<header class="topbar">
  <div>
   <div class="eyebrow">${t('identity.eyebrow')}</div>
   <h1>🍛 ${t('identity.title')} <span>${language==='both'?'Kutumb Bhojan':''}</span></h1>
  </div>
  <div class="topbar-actions">
   <div class="global-language" aria-label="Language / भाषा">
    ${[['mr','मराठी'],['en','English'],['both','दोन्ही']].map(([x,label])=>`<button class="${language===x?'active':''}" data-language="${x}">${label}</button>`).join('')}
   </div>
   <div class="global-theme" aria-label="Theme / थीम">
    ${[['light','☀️'],['dark','🌙'],['system','◐']].map(([x,label])=>`<button class="${theme===x?'active':''}" data-theme="${x}" title="${x}">${label}</button>`).join('')}
   </div>
   <button class="date-chip" data-page="today">${dateLabel(selectedDate)}</button>
  </div>
 </header>
 <main class="layout">
  <aside class="sidebar">
   <div class="brand-card">
    <div class="brand-icon">🍲</div>
    <strong>${t('identity.brand_tagline')}</strong>
    <small>${t('identity.brand_sub')}</small>
   </div>
   ${nav.map(n=>`<button class="nav ${page===n[0]?'active':''}" data-page="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join('')}
   <div class="sidebar-note">
    <b>${t('sidebar.questions_title')}</b><br>
    ${t('sidebar.q_what')} → ${t('nav.calendar')}<br>
    ${t('sidebar.q_how')} → ${t('nav.recipes')}<br>
    ${t('sidebar.q_buy')} → ${t('nav.shopping')}<br>
    ${t('sidebar.q_prep')} → ${t('nav.prep')}<br>
    ${t('sidebar.q_health')} → ${t('nav.health')}
   </div>
  </aside>
  <section class="content">${body}</section>
 </main>
 <nav class="mobile-nav">
  ${nav.slice(0,6).map(n=>`<button class="${page===n[0]?'active':''}" data-page="${n[0]}"><span>${n[1]}</span><small>${n[2]}</small></button>`).join('')}
 </nav>
 ${modal}
 <div id="toast"></div>`;
 bind();
}

function bind(){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{tts.stop();page=b.dataset.page;selectedRecipe=null;if(page==='shopping'){loadDerivedShopping().then(()=>render());}render()});
 const date=document.getElementById('date');if(date)date.onchange=()=>{selectedDate=date.value;render()};
 document.querySelector('[data-day="prev"]')?.addEventListener('click',()=>shiftDay(-1));
 document.querySelector('[data-day="next"]')?.addEventListener('click',()=>shiftDay(1));
 document.getElementById('month')?.addEventListener('change',e=>{selectedDate=e.target.value+'-01';render()});
 document.querySelectorAll('[data-select-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.selectDate;render()});
 document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{const r=findRecipe(b.dataset.recipe);if(r){tts.stop();selectedRecipe=r;render()}else toast(t('msg.recipe_detail_coming_soon'))});
 document.querySelectorAll('[data-recipe-id]').forEach(b=>b.onclick=()=>{tts.stop();selectedRecipe=state.recipes.find(r=>r.id===b.dataset.recipeId);render()});
 document.querySelector('[data-back]')?.addEventListener('click',()=>{tts.stop();selectedRecipe=null;render()});

 // Recipe Add / Edit
 document.querySelector('[data-add-recipe]')?.addEventListener('click',()=>{editingRecipe=null;showRecipeModal=true;render()});
 document.querySelectorAll('[data-edit-recipe]').forEach(b=>b.onclick=()=>{const r=state.recipes.find(x=>x.id===b.dataset.editRecipe);if(r){editingRecipe=r;showRecipeModal=true;render()}});
 document.querySelectorAll('[data-close-recipe-modal]').forEach(b=>b.onclick=()=>{showRecipeModal=false;editingRecipe=null;render()});
 document.querySelector('[data-save-recipe]')?.addEventListener('click',async()=>{
  const name=(document.getElementById('recipeFormName')?.value||'').trim();
  const mrName=(document.getElementById('recipeFormMr')?.value||'').trim();
  if(!name||!mrName){toast(t('msg.name_required'));return;}
  const course=document.getElementById('recipeFormCourse')?.value||'Lunch/Dinner';
  const mealRole=document.getElementById('recipeFormRole')?.value||'main';
  const time=document.getElementById('recipeFormTime')?.value||'20 min';
  const servings=Number(document.getElementById('recipeFormServings')?.value)||4;
  const cookingMethod=document.getElementById('recipeFormCookingMethod')?.value||'Stovetop';
  const ingredientsRaw=(document.getElementById('recipeFormIngredients')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const methodRaw=(document.getElementById('recipeFormMethod')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const note=(document.getElementById('recipeFormNote')?.value||'').trim();

  const id=editingRecipe?editingRecipe.id:('r_'+Date.now());
  const existingIdx=state.recipes.findIndex(r=>r.id===id);
  const baseRecipe={
   id,
   name,
   mr:mrName,
   course,
   mealCategory:course,
   mealRole,
   time,
   servings,
   cookingMethod,
   ingredients:ingredientsRaw,
   legacyIngredients:ingredientsRaw,
   method:methodRaw,
   note,
   protein:editingRecipe?.protein||'~15 g',
   fibre:editingRecipe?.fibre||'~6 g',
   oil:editingRecipe?.oil||'10 ml'
  };
  const structured=buildStructuredRecipe(baseRecipe,state.recipeIngredients||[],state.ingredientCatalog||[]);
  if(existingIdx>=0) state.recipes[existingIdx]=structured;
  else state.recipes.unshift(structured);

  showRecipeModal=false;
  editingRecipe=null;
  selectedRecipe=structured;
  ensureAutomaticAssignments();
  await save();
  render();
  toast(t('msg.recipe_saved'));
 });

 // Slot rescheduling
 document.querySelectorAll('[data-reschedule-slot]').forEach(sel=>sel.onchange=async e=>{
  const mealId=e.target.dataset.rescheduleSlot;
  const meal=state.meals.find(m=>m.id===mealId);
  const r=findRecipe(e.target.value);
  if(!meal||!r)return;
  meal.title=r.name;
  meal.marathi=r.mr;
  ensureAutomaticAssignments();
  if(remoteReady&&remoteHouseholdId){
   try{
    await supabase.from('meal_entries').upsert({household_id:remoteHouseholdId,meal_date:meal.date,slot:meal.slot,title:meal.title,marathi_title:meal.marathi,status:meal.status},{onConflict:'household_id,meal_date,slot'});
   }catch(err){console.warn('Reschedule sync failed',err);}
  }
   await save();
   render();
   toast(t('msg.meal_updated'));
  });

  // Reason-aware meal change
  document.querySelectorAll('[data-reason-change]').forEach(b=>{
   b.onclick=()=>{
    const mealId=b.dataset.reasonChange;
    const meal=state.meals.find(m=>m.id===mealId);
    if(meal){
     reasonChangeModalMeal=meal;
     render();
    }
   };
  });

  document.querySelectorAll('[data-close-reason-modal]').forEach(b=>{
   b.onclick=()=>{
    reasonChangeModalMeal=null;
    render();
   };
  });

  document.querySelectorAll('[data-apply-reason]').forEach(b=>{
   b.onclick=async()=>{
    const reason=b.dataset.applyReason;
    const meal=reasonChangeModalMeal;
    if(!meal)return;
    let changeRes=null;
    try{
     let headers={'Content-Type':'application/json'};
     const {data:{session}}=await supabase.auth.getSession();
     if(session?.access_token){
      headers['Authorization']=`Bearer ${session.access_token}`;
     }
     const resp=await fetch('/api/planning/meal-change',{
      method:'POST',
      headers:headers,
      body:JSON.stringify({
       current_meal:{
        date:meal.date,
        slot:meal.slot,
        recipe_id:meal.recipeId,
        title:meal.title
       },
       reason:reason,
       household_id:remoteHouseholdId
      })
     });
     if(resp.ok){
      changeRes=await resp.json();
     }else{
      const errBody=await resp.json().catch(()=>({}));
      console.warn('FastAPI meal-change error',resp.status,errBody);
     }
    }catch(err){
     console.warn('FastAPI meal-change request failed',err);
    }
    if(changeRes&&changeRes.recommendation){
     const rec=changeRes.recommendation.recipe;
     meal.title=rec.name;
     meal.marathi=rec.mr||rec.marathi_name||rec.name;
     meal.recipeId=rec.id;
     meal.explanation=changeRes.recommendation.explanation||changeRes.recommendation.decision_metadata;
     ensureAutomaticAssignments();
     if(remoteReady&&remoteHouseholdId){
      try{
       await supabase.from('meal_entries').upsert({
        household_id:remoteHouseholdId,
        meal_date:meal.date,
        slot:meal.slot,
        title:meal.title,
        marathi_title:meal.marathi,
        status:meal.status,
        recipe_id:meal.recipeId,
        decision_metadata:meal.explanation
       },{onConflict:'household_id,meal_date,slot'});
      }catch(err){console.warn('Reschedule sync failed',err);}
     }
     await save();
     await loadDerivedShopping();
     reasonChangeModalMeal=null;
     render();
     toast(t('msg.meal_updated')+': '+(rec.mr||rec.name));
    }else{
     const warn=(changeRes?.warning||changeRes?.detail||t('meal.no_alternative_found','कोणताही पर्यायी पदार्थ सापडला नाही / No valid alternative found'));
     toast(warn);
    }
   };
  });

 // Shopping manual add & delete
 document.querySelector('[data-add-shopping]')?.addEventListener('click',async()=>{
  const mrInput=document.getElementById('newShopMr');
  const enInput=document.getElementById('newShopEn');
  const qtyInput=document.getElementById('newShopQty');
  const catInput=document.getElementById('newShopCat');
  const mrName=(mrInput?.value||'').trim();
  const enName=(enInput?.value||'').trim();
  const qty=(qtyInput?.value||'').trim()||'1 kg';
  const cat=catInput?.value||'Staples';
  if(!mrName&&!enName){toast(t('msg.name_required'));return;}
  const id='manual_'+Date.now();
  state.shopping.unshift({id,item:enName||mrName,mr:mrName||enName,category:cat,quantity:qty,need:true,purchased:false});
  await save();
  render();
  toast(t('msg.added_to_shopping'));
 });
 document.querySelectorAll('[data-delete-shopping]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.deleteShopping;
  state.shopping=(state.shopping||[]).filter(x=>x.id!==id);
  if(remoteReady&&remoteHouseholdId){
   try{await supabase.from('shopping_items').delete().eq('household_id',remoteHouseholdId).eq('item_key',id);}catch(e){console.warn(e);}
  }
  await save();
  render();
  toast(t('msg.item_removed'));
 });

 // Prep manual add & delete
 document.querySelector('[data-add-prep]')?.addEventListener('click',async()=>{
  const mrInput=document.getElementById('newPrepMr');
  const enInput=document.getElementById('newPrepEn');
  const dateInput=document.getElementById('newPrepDate');
  const areaInput=document.getElementById('newPrepArea');
  const mrName=(mrInput?.value||'').trim();
  const enName=(enInput?.value||'').trim();
  const dateVal=dateInput?.value||selectedDate;
  const areaVal=areaInput?.value||'Meal Prep';
  if(!mrName&&!enName){toast(t('msg.prep_required'));return;}
  const id='prep_'+Date.now();
  state.prep.unshift({id,task:enName||mrName,mr:mrName||enName,date:dateVal,area:areaVal,done:false});
  await save();
  render();
  toast(t('msg.prep_added'));
 });
 document.querySelectorAll('[data-delete-prep]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.deletePrep;
  state.prep=(state.prep||[]).filter(x=>x.id!==id);
  if(remoteReady&&remoteHouseholdId){
   try{await supabase.from('prep_tasks').delete().eq('household_id',remoteHouseholdId).eq('task_key',id);}catch(e){console.warn(e);}
  }
  await save();
  render();
  toast(t('msg.prep_removed'));
 });

 document.querySelectorAll('[data-prep]').forEach(i=>i.onchange=()=>{const x=state.prep.find(tVal=>tVal.id===i.dataset.prep);if(x){x.done=i.checked;save();render()}});
 document.querySelectorAll('[data-purchased]').forEach(i=>i.onchange=()=>{const x=state.shopping.find(tVal=>tVal.id===i.dataset.purchased);if(x){x.purchased=i.checked;save();render()}});
 document.querySelectorAll('[data-need]').forEach(i=>i.onchange=()=>{const x=state.shopping.find(tVal=>tVal.id===i.dataset.need);if(x){x.need=i.checked;save();render()}});
 document.getElementById('recipeSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();const list=state.recipes.filter(r=>`${r.name} ${r.mr} ${r.course}`.toLowerCase().includes(q));document.getElementById('recipeGrid').innerHTML=list.map(recipeCard).join('');document.getElementById('recipeCount').textContent=`${list.length} ${t('recipes.count')}`;bind()});
 document.querySelectorAll('[data-health-category]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-health-category]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const q=b.dataset.healthCategory;document.getElementById('healthGrid').innerHTML=(state.healthTips||[]).filter(tVal=>q==='all'||tVal.category===q).map(healthTipCard).join('')});
 document.querySelectorAll('[data-change-assignment]').forEach(sel=>sel.onchange=async e=>{const mealId=e.target.dataset.changeAssignment,memberId=e.target.dataset.memberId;const selEl=e.target;const chosen=selEl.value;const member=state.members.find(m=>(m.memberKey||m.id)===memberId);const chosenRecipe=state.recipes.find(r=>r.id===chosen);const rules=state.dietaryRules?.length?state.dietaryRules:DEFAULT_DIETARY_RULES;if(member&&chosenRecipe&&!evaluateRecipeEligibility(member,chosenRecipe,rules).eligible){toast(t('dietary.ineligible_selection','हा पदार्थ या सदस्यासाठी योग्य नाही — दुसरा पर्याय निवडा / Not suitable for this member'));selEl.value=state.mealAssignments.find(a=>a.mealEntryId===mealId&& (a.memberId===memberId||a.memberId===member.id))?.recipeId||'';return;}state.mealAssignments=applyDayLevelOverride(state.mealAssignments,memberId,e.target.value,mealId);await save();render()});
 document.querySelectorAll('[data-revert-assignment]').forEach(b=>b.onclick=async()=>{state.mealAssignments=revertDayLevelOverride(state.mealAssignments,b.dataset.memberId,b.dataset.revertAssignment);await save();render()});
 document.querySelectorAll('[data-dietary-toggle]').forEach(cb=>cb.onchange=async e=>{
  const ruleKey=e.target.dataset.dietaryToggle;
  const memberKey=e.target.dataset.memberKey;
  const checked=e.target.checked;
  let rules=state.dietaryRules?.length? state.dietaryRules.map(r=>({...r})) : DEFAULT_DIETARY_RULES.map(r=>({...r, allowedMemberIds:[...r.allowedMemberIds], disallowedMemberIds:[...r.disallowedMemberIds]}));
  let rule=rules.find(r=>(r.ruleKey||r.ingredientKey)===ruleKey);
  if(!rule){ // create generic rule for unknown ingredientKey
    rule={ruleKey:ruleKey, ingredientKey:ruleKey, allowedMemberIds:[], disallowedMemberIds:[], alternatePolicy:'vegetarian-existing', active:true};
    rules.push(rule);
  }
  const lower=memberKey.toLowerCase();
  rule.allowedMemberIds = (rule.allowedMemberIds||[]).filter(x=>x.toLowerCase()!==lower);
  rule.disallowedMemberIds = (rule.disallowedMemberIds||[]).filter(x=>x.toLowerCase()!==lower);
  if(checked){ rule.allowedMemberIds.push(memberKey); } else { rule.disallowedMemberIds.push(memberKey); }
  // normalize: ensure no duplicate, keep at least one list consistent
  rule.allowedMemberIds=[...new Set(rule.allowedMemberIds)];
  rule.disallowedMemberIds=[...new Set(rule.disallowedMemberIds)];
  state.dietaryRules=rules;
  ensureAutomaticAssignments();
  await save();
  if(remoteReady&&remoteHouseholdId){
    try{
      const payload={household_id:remoteHouseholdId, rule_key:rule.ruleKey||rule.ingredientKey, ingredient_key:rule.ingredientKey, allowed_member_ids:rule.allowedMemberIds, disallowed_member_ids:rule.disallowedMemberIds, alternate_policy:rule.alternatePolicy||'vegetarian-existing', active:true};
      const {error}=await supabase.from('dietary_rules').upsert(payload,{onConflict:'household_id,rule_key'});
      if(error) throw error;
    }catch(err){ console.warn('dietary_rules upsert failed',err); toast(t('msg.dietary_sync_failed','Dietary preference sync failed / आहार पसंती sync अयशस्वी'));}
  }
  render();
  toast(t('dietary.saved','आहार पसंती जतन झाली / Dietary preference saved'));
 });
 document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
 document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>setLanguage(b.dataset.language));
 document.querySelectorAll('[data-tts-key]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();const key=b.dataset.ttsKey;if(tts.getCurrentKey()===key&&tts.isSpeaking()){tts.stop();}else{tts.speak({key,mrText:b.dataset.ttsMr,enText:b.dataset.ttsEn,language});}});
 document.querySelector('[data-save-settings]')?.addEventListener('click',async()=>{const s=state.householdSettings||clone(starter.householdSettings);s.oilStockMl=Math.max(0,Number(document.getElementById('oilStock').value)||0);s.oilMonthlyTargetMl=Math.max(100,Number(document.getElementById('oilTarget').value)||3000);s.householdSize=Math.min(20,Math.max(1,Number(document.getElementById('householdSize').value)||4));state.householdSettings=s;localStorage.setItem(STORAGE,JSON.stringify(state));const ok=await saveHouseholdSettings();if(ok)toast(t('msg.household_saved'));render()});
 document.querySelector('[data-export]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(buildBackupPayload(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kutumb-bhojan-backup-${new Date().toISOString().slice(0,10)}.json`;a.click()});
 document.getElementById('importFile')?.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{const x=JSON.parse(r.result);if(x.version!==1&&x.version!==2)throw new Error('Invalid version');state={...clone(starter),...x,version:2};if(!state.uiContent||(Array.isArray(state.uiContent)&&!state.uiContent.length)||(typeof state.uiContent==='object'&&Object.keys(state.uiContent).length===0)) state.uiContent=CANONICAL_UI_CONTENT;if(!state.frequencyRules||!state.frequencyRules.length) state.frequencyRules=DEFAULT_FREQUENCY_RULES;contentProvider=createContentProvider(state.uiContent);state.recipes=(state.recipes||[]).map(rec=>buildStructuredRecipe(rec,state.recipeIngredients||[],state.ingredientCatalog||[]));ensureAutomaticAssignments();localStorage.setItem(STORAGE,JSON.stringify(state));if(remoteReady){await saveHouseholdSettings();await syncLocalChanges();await syncPhase2();}render();toast(t('msg.backup_restored'))}catch(err){console.warn('Import error',err);toast(t('msg.invalid_backup'))}};r.readAsText(file)});
 document.querySelector('[data-reset]')?.addEventListener('click',()=>{if(confirm(t('msg.confirm_reset'))){state=clone(starter);state.recipes=state.recipes.map(r=>buildStructuredRecipe(r,[],[]));ensureAutomaticAssignments();save();if(remoteReady)saveHouseholdSettings();render()}});
 document.querySelector('[data-generate-invite]')?.addEventListener('click',async()=>{
  if(!remoteReady||!remoteHouseholdId){
   toast(t('msg.cloud_not_ready','Cloud sync not connected / क्लाउड sync उपलब्ध नाही'));
   return;
  }
  try{
   const {data,error}=await supabase.rpc('create_household_invite',{target_household:remoteHouseholdId,expires_in_hours:48,max_uses:5});
   if(error||!data?.token)throw (error||new Error('invite generation failed'));
   const el=document.getElementById('activeInviteDisplay');
   if(el){
    el.innerHTML=`<code>${esc(data.token)}</code> <button type="button" class="secondary" id="copyInviteBtn" style="padding:2px 8px;font-size:0.85rem">📋 ${t('common.copy','Copy')}</button>`;
    document.getElementById('copyInviteBtn')?.addEventListener('click',()=>{
     const shareUrl=window.location.origin+window.location.pathname+'?join='+encodeURIComponent(data.token);
     if(navigator.clipboard?.writeText){navigator.clipboard.writeText(shareUrl).catch(()=>navigator.clipboard.writeText(data.token));}
     toast(t('msg.code_copied','Invite code copied / जोडणी कोड कॉपी केला'));
    });
   }
   toast(t('msg.invite_created','Invite code generated / जोडणी कोड तयार झाला'));
  }catch(err){
   console.warn('create_household_invite failed',err);
   toast(t('msg.invite_failed','Could not create invite code / जोडणी कोड तयार करता आला नाही'));
  }
 });
 document.querySelector('[data-join-invite]')?.addEventListener('click',async()=>{
  const input=document.getElementById('joinInviteInput');
  const code=input?.value?.trim();
  if(!code){
   toast(t('msg.enter_valid_code','Please enter an invite code / कृपया कोड प्रविष्ट करा'));
   return;
  }
  try{
   const {data:joinedId,error}=await supabase.rpc('join_household',{invite_token:code});
   if(error||!joinedId)throw (error||new Error('join failed'));
   remoteHouseholdId=joinedId;
   cleanupCloud();
   await initCloud();
   toast(t('msg.household_joined','Family household joined · कुटुंबात यशस्वीरित्या सामील झाले'));
   render();
  }catch(err){
   console.warn('join_household failed',err);
   toast(t('msg.invite_invalid','Invalid or expired invite code · अमान्य किंवा कालबाह्य कोड'));
  }
 });
}

tts.onStateChange(({ key, isSpeaking })=>{
 document.querySelectorAll('[data-tts-key]').forEach(btn=>{
  const active=isSpeaking && btn.dataset.ttsKey===key;
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active?'true':'false');
  const ariaLabel=contentProvider ? contentProvider.get(active ? 'tts.stop' : 'tts.listen', language) : (active ? 'Stop' : 'Listen');
  btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML=ttsButtonLabel(active, language);
 });
});

function shiftDay(delta){const d=new Date(selectedDate+'T00:00:00');d.setDate(d.getDate()+delta);selectedDate=d.toLocaleDateString('en-CA');render()}
applyTheme();
applyLanguage();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(err=>console.warn('service worker unavailable',err)));}
ensureAutomaticAssignments();
render();
initCloud();
