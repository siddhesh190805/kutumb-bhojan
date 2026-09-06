import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { REMOTE_TABLES, buildRemoteRows, mapRemoteState, mapHealthTips, mapHealthTargets, mapHouseholdSettings, dedupeRecipesByName, mapIngredientCatalog, mapRecipeIngredients, mapMealAssignments, buildStructuredRecipe, mapDietaryRules, buildAutomaticAssignments, applyDayLevelOverride, revertDayLevelOverride, evaluateMealBalance, buildShoppingFromAssignments, getNutritionEducation, getRecipeNutritionConcepts, selectAutomaticAlternate, DEFAULT_DIETARY_RULES, groupMemberAssignments, DEFAULT_FREQUENCY_RULES, countIngredientMonthlyOccurrences, getHouseholdFrequencyStatus, recipeContainsIngredient } from './sync.js';
import { tts } from './tts.js';

const SUPABASE_URL='https://wcwwvyreefkrqchfteqp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_taMU0Pog_yTgPzuJ5v7MRA_ACsZ-w3r';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let remoteHouseholdId=null, remoteReady=false, realtimeChannel=null;
const STORAGE='kutumb-bhojan-state-v1';
const THEME_STORAGE='kutumb-bhojan-theme-v1';
const LANGUAGE_STORAGE='kutumb-bhojan-language-v1';
const slots=['Breakfast','Lunch','Snack','Dinner'];
const slotMr={Breakfast:'नाश्ता',Lunch:'दुपारचे जेवण',Snack:'अल्पोपहार',Dinner:'रात्रीचे जेवण'};
const icon={Breakfast:'🍳',Lunch:'🍛',Snack:'🥜',Dinner:'🍽️'};
const family=[
{id:'vikas',name:'Vikas',mr:'विकास',age:50,weight:70,height:171,activity:'Highly active / खूप सक्रिय',note:'काही डाळ खाल्ल्यानंतर लाल चट्टे येत असल्याची नोंद. ट्रिगर निश्चित होईपर्यंत संशयित डाळ मुद्दाम वाढवू नका.'},
{id:'namrata',name:'Namrata',mr:'नम्रता',age:40,weight:65,height:155,activity:'Active household work / घरकामात सक्रिय',note:'दूध, दही, अंडी, पनीर आणि कडधान्यांची विविधता ठेवा.'},
{id:'tejas',name:'Tejas',mr:'तेजस',age:14,weight:50,height:171,activity:'Highly active / खूप सक्रिय',note:'वाढीचे वय. प्रौढ weight-loss targets वापरू नका. सतत थकवा/वारंवार आजार असल्यास pediatrician.'},
{id:'siddhesh',name:'Siddhesh',mr:'सिद्धेश',age:21,weight:64,height:182,activity:'Sedentary + calisthenics / बसून काम + व्यायाम',note:'व्यायामाच्या दिवशी पुरेसे जेवण आणि recovery. Protein powder optional आहे.'}
];
const plans=[
['Moong vegetable chilla + curd','Lobia curry + roti + bhindi + guava','Roasted chana + guava','Paneer vegetable curry + roti + cucumber'],
['Moong-paneer chilla','Chana usal + jowar bhakri + cabbage-carrot koshimbir','Roasted chana + guava','Tofu bhurji + roti + tomato-cucumber'],
['Vegetable uttapam + sambar','Rajma rice + cucumber-onion','Buttermilk + roasted chana','Jowar bhakri + matki usal + cauliflower'],
['Egg bhurji + roti','Mixed bean curry + roti + dudhi','Paneer chaat + pomegranate','Vegetable moong khichdi + curd + carrot-cucumber'],
['Besan-paneer chilla','Chole + roti + cabbage-peas + apple','Milk + banana + peanut powder','Palak paneer + roti + cucumber'],
['Handvo + curd','Bharli vangi + jowar bhakri + curd + cucumber','Chana chaat + mosambi','Soy-paneer keema + roti + cabbage'],
['Methi dashmi + curd + banana','Matki misal + pav + cucumber-onion','Curd + papaya + flax','Paneer vegetable tikka + roti + tomato-cucumber'],
['Moong vegetable chilla + curd','Lobia curry + roti + bhindi + guava','Peanuts + banana','Paneer bhurji + roti + spinach'],
['Ragi dosa + sambar','Chana usal + roti + cauliflower-carrot','Sprouted moong chaat','Egg bhurji + roti + dudhi'],
['Vegetable poha + peanuts + curd','Rajma rice + cucumber + papaya','Buttermilk + roasted chana','Jowar bhakri + matki usal + dudhi'],
['Pesarattu + peanut chutney','Mixed bean curry + roti + cabbage-carrot','Curd + papaya + flax','Tofu vegetable curry + roti + cucumber'],
['Besan vegetable chilla + curd','Chole + roti + bhindi + apple','Paneer chaat + pomegranate','Palak paneer + roti + cucumber'],
['Mixed-dal adai + tomato chutney','Bharli vangi + jowar bhakri + curd','Chana chaat + mosambi','Soy-paneer keema + roti + cabbage'],
['Protein thalipeeth + curd','Matki misal + pav + cucumber-onion','Milk + banana + peanut powder','Paneer vegetable tikka + roti + tomato-cucumber'],
['Sprouts poha + curd','Lobia curry + roti + cauliflower','Roasted chana + guava','Paneer bhurji + roti + spinach'],
['Moong-paneer chilla','Chana usal + jowar bhakri + dudhi','Curd + banana + pumpkin seeds','Tofu bhurji + roti + cucumber-tomato'],
['Vegetable uttapam + sambar','Rajma rice + cabbage-carrot','Sprouted moong chaat + cucumber','Egg bhurji + roti + bhindi'],
['Ragi dosa + sambar','Mixed bean curry + roti + dudhi + apple','Buttermilk + roasted chana','Jowar bhakri + matki usal + cabbage'],
['Besan vegetable chilla + curd','Chole + roti + cauliflower-carrot + papaya','Paneer chaat + pomegranate','Palak paneer + roti + cucumber'],
['Handvo + curd','Bharli vangi + jowar bhakri + curd','Chana chaat + mosambi','Soy-paneer keema + roti + cabbage'],
['Methi dashmi + curd + banana','Matki misal + pav + cucumber-onion','Curd + papaya + flax','Paneer vegetable tikka + roti + tomato-cucumber'],
['Moong vegetable chilla + curd','Lobia curry + roti + bhindi + guava','Peanuts + banana','Paneer bhurji + roti + spinach'],
['Ragi dosa + sambar','Chana usal + roti + cauliflower-carrot','Sprouted moong chaat','Egg bhurji + roti + dudhi'],
['Vegetable poha + peanuts + curd','Rajma rice + cucumber + papaya','Buttermilk + roasted chana','Jowar bhakri + matki usal + dudhi'],
['Pesarattu + peanut chutney','Mixed bean curry + roti + cabbage-carrot','Curd + papaya + flax','Tofu vegetable curry + roti + cucumber'],
['Besan vegetable chilla + curd','Chole + roti + bhindi + apple','Paneer chaat + pomegranate','Palak paneer + roti + cucumber'],
['Mixed-dal adai + tomato chutney','Bharli vangi + jowar bhakri + curd','Chana chaat + mosambi','Soy-paneer keema + roti + cabbage'],
['Protein thalipeeth + curd','Matki misal + pav + cucumber-onion','Milk + banana + peanut powder','Paneer vegetable tikka + roti + tomato-cucumber'],
['Sprouts poha + curd','Lobia curry + roti + cauliflower','Roasted chana + guava','Paneer bhurji + roti + spinach'],
['Moong-paneer chilla','Chana usal + jowar bhakri + dudhi','Curd + banana + pumpkin seeds','Tofu bhurji + roti + cucumber-tomato']
];
const mr={
'Moong vegetable chilla + curd':'मूग भाजी चिल्ला + दही','Moong-paneer chilla':'मूग-पनीर चिल्ला','Lobia curry + roti + bhindi + guava':'चवळीची भाजी + पोळी + भेंडी + पेरू','Roasted chana + guava':'भाजलेला हरभरा + पेरू','Paneer vegetable curry + roti + cucumber':'पनीर भाजी + पोळी + काकडी','Chana usal + jowar bhakri + cabbage-carrot koshimbir':'हरभरा उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर','Tofu bhurji + roti + tomato-cucumber':'टोफू भुर्जी + पोळी + टोमॅटो-काकडी','Vegetable uttapam + sambar':'भाजी उत्तपम + सांबार','Rajma rice + cucumber-onion':'राजमा भात + काकडी-कांदा','Buttermilk + roasted chana':'ताक + भाजलेला हरभरा','Jowar bhakri + matki usal + cauliflower':'ज्वारी भाकरी + मटकी उसळ + फुलकोबी','Egg bhurji + roti':'अंडा भुर्जी + पोळी','Mixed bean curry + roti + dudhi':'मिश्र कडधान्य भाजी + पोळी + दुधी','Paneer chaat + pomegranate':'पनीर चाट + डाळिंब','Vegetable moong khichdi + curd + carrot-cucumber':'भाजी मूग खिचडी + दही + गाजर-काकडी','Besan-paneer chilla':'बेसन-पनीर चिल्ला','Chole + roti + cabbage-peas + apple':'छोले + पोळी + कोबी-वाटाणा + सफरचंद','Milk + banana + peanut powder':'दूध + केळे + शेंगदाणा पूड','Palak paneer + roti + cucumber':'पालक पनीर + पोळी + काकडी','Handvo + curd':'हांडवो + दही','Bharli vangi + jowar bhakri + curd + cucumber':'भरली वांगी + ज्वारी भाकरी + दही + काकडी','Chana chaat + mosambi':'हरभरा चाट + मोसंबी','Soy-paneer keema + roti + cabbage':'सोया-पनीर कीमा + पोळी + कोबी','Methi dashmi + curd + banana':'मेथी दशमी + दही + केळे','Matki misal + pav + cucumber-onion':'मटकी मिसळ + पाव + काकडी-कांदा','Curd + papaya + flax':'दही + पपई + जवस','Paneer vegetable tikka + roti + tomato-cucumber':'पनीर भाजी टिक्का + पोळी + टोमॅटो-काकडी','Peanuts + banana':'शेंगदाणे + केळे','Paneer bhurji + roti + spinach':'पनीर भुर्जी + पोळी + पालक','Ragi dosa + sambar':'नाचणी डोसा + सांबार','Chana usal + roti + cauliflower-carrot':'हरभरा उसळ + पोळी + फुलकोबी-गाजर','Sprouted moong chaat':'मोड आलेल्या मूगाची चाट','Egg bhurji + roti + dudhi':'अंडा भुर्जी + पोळी + दुधी','Vegetable poha + peanuts + curd':'भाजी पोहे + शेंगदाणे + दही','Rajma rice + cucumber + papaya':'राजमा भात + काकडी + पपई','Pesarattu + peanut chutney':'पेसरट्टू + शेंगदाणा चटणी','Mixed bean curry + roti + cabbage-carrot':'मिश्र कडधान्य भाजी + पोळी + कोबी-गाजर','Tofu vegetable curry + roti + cucumber':'टोफू भाजी + पोळी + काकडी','Besan vegetable chilla + curd':'बेसन भाजी चिल्ला + दही','Chole + roti + bhindi + apple':'छोले + पोळी + भेंडी + सफरचंद','Mixed-dal adai + tomato chutney':'मिश्र डाळ अडई + टोमॅटो चटणी','Bharli vangi + jowar bhakri + curd':'भरली वांगी + ज्वारी भाकरी + दही','Protein thalipeeth + curd':'प्रोटीन थालीपीठ + दही','Sprouts poha + curd':'मोड आलेले पोहे + दही','Chana usal + jowar bhakri + dudhi':'हरभरा उसळ + ज्वारी भाकरी + दुधी','Curd + banana + pumpkin seeds':'दही + केळे + भोपळ्याच्या बिया','Tofu bhurji + roti + cucumber-tomato':'टोफू भुर्जी + पोळी + काकडी-टोमॅटो','Rajma rice + cabbage-carrot':'राजमा भात + कोबी-गाजर','Sprouted moong chaat + cucumber':'मोड आलेल्या मूगाची चाट + काकडी','Egg bhurji + roti + bhindi':'अंडा भुर्जी + पोळी + भेंडी','Mixed bean curry + roti + dudhi + apple':'मिश्र कडधान्य भाजी + पोळी + दुधी + सफरचंद','Chole + roti + cauliflower-carrot + papaya':'छोले + पोळी + फुलकोबी-गाजर + पपई','Roasted chana + banana':'भाजलेला हरभरा + केळे','Soy-paneer keema + roti + cabbage salad':'सोया-पनीर कीमा + पोळी + कोबी कोशिंबीर','Matki usal + jowar bhakri + cabbage-carrot koshimbir':'मटकी उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर'};
function makeMeals(){const out=[];const start=new Date('2026-09-07T00:00:00');for(let d=0;d<30;d++){const date=new Date(start);date.setUTCDate(start.getUTCDate()+d);const iso=date.toISOString().slice(0,10);plans[d].forEach((title,i)=>out.push({id:`${iso}-${slots[i]}`,date:iso,slot:slots[i],title,marathi:mr[title]||title,status:'Planned'}));}const overrides={
'2026-10-05':['Moong vegetable chilla + curd','Chole + roti + bhindi + guava','Roasted chana + banana','Paneer vegetable curry + roti + cucumber'],
'2026-10-06':['Egg bhurji + roti','Matki usal + jowar bhakri + cabbage-carrot koshimbir','Curd + papaya + flax','Soy-paneer keema + roti + cabbage salad']};
for(const [date,titles] of Object.entries(overrides)){out.filter(x=>x.date===date).forEach((x,i)=>{x.title=titles[i];x.marathi=mr[titles[i]]||titles[i]})}return out}
const recipes=[
['Moong Vegetable Chilla','मूग भाजी चिल्ला','Breakfast','20 min','10 ml','~11 g','~4 g','~220 kcal',['200 g soaked moong dal','100 g vegetables','20 g besan','ginger, cumin, salt','10 ml oil'],['Blend soaked moong with little water.','Mix vegetables, besan and seasoning.','Cook 4 medium chillas with measured oil.'],'Serve with 100–150 g curd per adult portion.'],
['Besan Vegetable Chilla + Curd','बेसन भाजी चिल्ला + दही','Breakfast','15 min','10 ml','~10 g','~4 g','~230 kcal',['160 g besan','150 g vegetables','400 g curd','spices','10 ml oil'],['Whisk besan with water and vegetables.','Cook thin chillas.','Serve with curd.'],'Keep batter medium-thick.'],
['Pesarattu + Peanut Coriander Chutney','पेसरट्टू + शेंगदाणा-कोथिंबीर चटणी','Breakfast','30 min','10 ml','~12 g','~5 g','~270 kcal',['240 g soaked whole green gram','40 g peanuts','coriander','ginger, cumin','10 ml oil'],['Blend soaked moong.','Spread thin and cook.','Blend peanut-coriander chutney.'],'Soak overnight; batch batter.'],
['Ragi Dosa + Sambar','नाचणी डोसा + सांबार','Breakfast','30 min','10 ml','~10 g','~6 g','~300 kcal',['160 g ragi flour','80 g rice flour','600 g vegetable sambar','10 ml oil'],['Mix batter and rest.','Cook dosas.','Serve with vegetable-rich sambar.'],'Fermentation optional.'],
['Vegetable Poha + Peanuts + Curd','भाजी पोहे + शेंगदाणे + दही','Breakfast','15 min','10 ml','~9 g','~4 g','~300 kcal',['240 g poha','50 g peanuts','200 g vegetables','400 g curd'],['Rinse poha.','Cook vegetables and poha.','Finish with peanuts and curd.'],'Measure peanuts.'],
['Paneer Bhurji + Roti','पनीर भुर्जी + पोळी','Breakfast','20 min','10 ml','~20 g','~5 g','~390 kcal',['400 g paneer','200 g tomato-onion','8 rotis','10 ml oil'],['Cook onion-tomato.','Add crumbled paneer.','Serve with rotis.'],'Egg-bhurji alternative.'],
['Mixed-Dal Adai','मिश्र डाळ अडई','Breakfast','30 min','10 ml','~13 g','~6 g','~300 kcal',['250 g mixed dals','ginger, chilli, curry leaves','vegetables','10 ml oil'],['Soak dals.','Blend coarse.','Cook thick pancakes.'],'Use varied dals.'],
['Protein Thalipeeth','प्रोटीन थालीपीठ','Breakfast','30 min','15 ml','~12 g','~6 g','~330 kcal',['120 g jowar flour','80 g besan','40 g ground peanuts','vegetables'],['Mix into dough.','Pat portions.','Cook with measured oil.'],'Serve with curd.'],
['Matki Usal','मटकी उसळ','Lunch/Dinner','30 min','10 ml','~13 g','~7 g','~280 kcal',['250 g dry matki, sprouted','200 g tomato-onion','spices','10 ml oil'],['Pressure-cook sprouts.','Prepare masala.','Combine and simmer.'],'Batch-friendly protein anchor.'],
['Chole + Roti','छोले + पोळी','Lunch/Dinner','35 min','12 ml','~15 g','~8 g','~390 kcal',['280 g dry chickpeas','onion-tomato','8 rotis','12 ml oil'],['Pressure-cook soaked chickpeas.','Cook masala.','Simmer together.'],'Soak and batch-cook.'],
['Rajma Masala + Rice','राजमा मसाला + भात','Lunch/Dinner','40 min','12 ml','~14 g','~8 g','~430 kcal',['280 g dry rajma','250 g cooked rice','onion-tomato','12 ml oil'],['Pressure-cook rajma.','Cook masala.','Simmer and serve.'],'Measure rice portion.'],
['Lobia Curry + Roti','चवळीची भाजी + पोळी','Lunch/Dinner','30 min','10 ml','~14 g','~8 g','~390 kcal',['250 g dry lobia','onion-tomato','8 rotis','10 ml oil'],['Pressure-cook lobia.','Cook masala.','Combine and serve.'],'Rotate with other legumes.'],
['Palak Paneer','पालक पनीर','Lunch/Dinner','30 min','12 ml','~20 g','~5 g','~360 kcal',['400 g paneer','500 g spinach','tomato, ginger','12 ml oil'],['Blanch and blend spinach.','Cook aromatics.','Add paneer and spinach.'],'Pair with roti and cucumber.'],
['Vegetable Moong Khichdi + Curd','भाजी मूग खिचडी + दही','Lunch/Dinner','30 min','10 ml','~12 g','~6 g','~350 kcal',['180 g rice','120 g moong dal','300 g vegetables','400 g curd'],['Rinse rice and dal.','Pressure-cook with vegetables.','Serve with curd.'],'Comfort meal.'],
['Jowar Bhakri + Matki Usal + Dudhi','ज्वारी भाकरी + मटकी उसळ + दुधी','Lunch/Dinner','35 min','10 ml','~15 g','~9 g','~420 kcal',['8 jowar bhakri','700 g matki usal','500 g dudhi'],['Prepare bhakri.','Cook dudhi.','Serve with usal.'],'Weekend/batch prep.'],
['Matki Misal','मटकी मिसळ','Lunch/Dinner','35 min','12 ml','~15 g','~9 g','~430 kcal',['500 g matki usal','200 g measured farsan','4 pav','onion/coriander'],['Prepare usal.','Assemble bowls.','Serve with measured farsan and pav.'],'Keep farsan measured.'],
['Paneer Vegetable Tikka','पनीर भाजी टिक्का','Lunch/Dinner','30 min','10 ml','~20 g','~5 g','~350 kcal',['400 g paneer','300 g capsicum/onion/tomato','curd and spices','10 ml oil'],['Marinate.','Skewer/tray-bake.','Cook until lightly charred.'],'Weekend meal.'],
['Sprouted Moong Chaat','मोड आलेल्या मूगाची चाट','Snack','15 min','5 ml','~9 g','~6 g','~180 kcal',['400 g steamed sprouted moong','100 g tomato-cucumber','lemon','10 g peanuts'],['Steam sprouts.','Mix vegetables, lemon and peanuts.'],'Do not use raw sprouts for vulnerable family members.'],
['Paneer Chaat','पनीर चाट','Snack','10 min','0 ml','~14 g','~2 g','~220 kcal',['300 g paneer','tomato, cucumber, coriander','lemon and spices'],['Cube paneer.','Mix and season.'],'Use fresh safely stored paneer.'],
['Curd Papaya Flax Bowl','दही पपई जवस बाऊल','Snack','5 min','0 ml','~8 g','~4 g','~190 kcal',['600 g plain curd','400 g papaya','20 g ground flaxseed'],['Add papaya to curd.','Top with ground flaxseed.'],'Keep flax ground and refrigerated.'],
['Roasted Chana + Banana','भाजलेला हरभरा + केळे','Snack','2 min','0 ml','~7 g','~5 g','~210 kcal',['120 g roasted chana','4 small bananas'],['Portion roasted chana.','Serve with one banana each.'],'Portable snack.'],
['Buttermilk + Roasted Chana','ताक + भाजलेला हरभरा','Snack','5 min','0 ml','~7 g','~4 g','~150 kcal',['600 ml buttermilk','120 g roasted chana','cumin, coriander'],['Season buttermilk.','Serve with roasted chana.'],'Useful on hot afternoons.'],
['Egg Bhurji + Roti','अंडा भुर्जी + पोळी','Breakfast/Dinner','15 min','8 ml','~18 g','~4 g','~350 kcal',['8 eggs','200 g onion-tomato','8 rotis','8 ml oil'],['Whisk eggs.','Cook masala.','Scramble eggs fully.','Serve with rotis.'],'Egg-free alternative: paneer bhurji.']
];

const calendarRecipeData=[
['Moong vegetable chilla + curd','मूग भाजी चिल्ला + दही','Breakfast','20 min','10 ml','~12 g','~4 g','~280 kcal',['200 g soaked moong dal','100 g grated carrot, spinach and onion','20 g besan','400 g plain curd','cumin, ginger, salt','10 ml oil'],['Blend soaked moong with a little water.','Mix vegetables, besan and seasoning into the batter.','Cook 4 medium chillas with measured oil.','Serve with plain curd.'],'Home-style weekday breakfast; adjust portion for each family member.'],
['Moong-paneer chilla','मूग-पनीर चिल्ला','Breakfast','25 min','10 ml','~15 g','~4 g','~320 kcal',['200 g soaked moong dal','150 g crumbled paneer','100 g grated carrot, onion and coriander','ginger, cumin, salt','10 ml oil'],['Blend soaked moong into a thick batter.','Fold in vegetables and half the paneer.','Cook 4 chillas with measured oil.','Top with remaining paneer.'],'Use fresh paneer; keep batter suitable for a soft home-style chilla.'],
['Lobia curry + roti + bhindi + guava','चवळीची भाजी + पोळी + भेंडी + पेरू','Lunch/Dinner','40 min','12 ml','~17 g','~9 g','~500 kcal',['250 g dry lobia, soaked','8 whole-wheat rotis','400 g bhindi','1 guava','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook soaked lobia until soft.','Cook tomato-onion masala and simmer lobia.','Stir-fry sliced bhindi with measured oil.','Serve with rotis and one guava portion.'],'Batch-cook lobia on the weekend; keep bhindi lightly cooked.'],
['Roasted chana + guava','भाजलेला हरभरा + पेरू','Snack','5 min','0 ml','~8 g','~7 g','~210 kcal',['120 g roasted chana','2 medium guavas'],['Portion roasted chana into 4 servings.','Wash and cut guava.','Serve together.'],'Quick snack; use a smaller or larger portion according to hunger.'],
['Paneer vegetable curry + roti + cucumber','पनीर भाजी + पोळी + काकडी','Lunch/Dinner','30 min','12 ml','~20 g','~6 g','~470 kcal',['400 g paneer','300 g tomato, onion, capsicum and peas','8 whole-wheat rotis','2 cucumbers','12 ml oil','ginger, cumin, turmeric, coriander powder, salt'],['Cook onion, tomato and spices.','Add chopped vegetables and cook until just tender.','Add paneer and simmer briefly.','Serve with rotis and cucumber.'],'Simple home-style curry; avoid overcooking paneer.'],
['Chana usal + jowar bhakri + cabbage-carrot koshimbir','हरभरा उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर','Lunch/Dinner','40 min','12 ml','~18 g','~11 g','~520 kcal',['250 g dry kala chana, soaked','4 jowar bhakri','250 g cabbage','150 g carrot','lemon, coriander','200 g tomato-onion','12 ml oil','cumin, turmeric, goda masala, salt'],['Pressure-cook soaked chana until tender.','Cook tomato-onion masala and simmer chana into usal.','Prepare cabbage-carrot koshimbir with lemon and coriander.','Serve with jowar bhakri.'],'Cook chana thoroughly; keep the koshimbir fresh and lightly seasoned.'],
['Tofu bhurji + roti + tomato-cucumber','टोफू भुर्जी + पोळी + टोमॅटो-काकडी','Lunch/Dinner','25 min','10 ml','~18 g','~5 g','~430 kcal',['350 g firm tofu, crumbled','8 whole-wheat rotis','200 g tomato-onion','2 cucumbers','1 tomato','10 ml oil','turmeric, cumin, coriander, salt'],['Press tofu and crumble it.','Cook onion-tomato masala with spices.','Add tofu and cook until moisture reduces.','Serve with rotis and tomato-cucumber.'],'A soy-based option without soy-chunk texture.'],
['Vegetable uttapam + sambar','भाजी उत्तपम + सांबार','Breakfast','30 min','10 ml','~12 g','~6 g','~330 kcal',['300 g dosa batter','150 g finely chopped onion, tomato and capsicum','500 g vegetable sambar','10 ml oil','coriander, cumin, salt'],['Spread thick uttapam batter on a hot tawa.','Top with vegetables and cook both sides with measured oil.','Serve with hot vegetable-rich sambar.'],'Use fermented dosa batter when available; keep uttapam soft rather than crisp.'],
['Rajma rice + cucumber-onion','राजमा भात + काकडी-कांदा','Lunch/Dinner','45 min','12 ml','~17 g','~9 g','~500 kcal',['280 g dry rajma, soaked','320 g cooked rice','200 g tomato-onion','1 cucumber','1 onion','12 ml oil','ginger, cumin, turmeric, coriander powder, salt'],['Pressure-cook soaked rajma until completely tender.','Prepare tomato-onion masala and simmer rajma.','Serve with measured cooked rice.','Add fresh cucumber-onion on the side.'],'Soak and batch-cook rajma to reduce weekday effort.'],
['Buttermilk + roasted chana','ताक + भाजलेला हरभरा','Snack','5 min','0 ml','~8 g','~5 g','~170 kcal',['600 ml plain buttermilk','120 g roasted chana','cumin, coriander, salt'],['Whisk buttermilk with cumin and coriander.','Portion roasted chana.','Serve chilled or at room temperature.'],'Useful quick afternoon snack, especially in warm weather.'],
['Jowar bhakri + matki usal + cauliflower','ज्वारी भाकरी + मटकी उसळ + फुलकोबी','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~500 kcal',['4 jowar bhakri','250 g dry matki, sprouted','400 g cauliflower','200 g tomato-onion','12 ml oil','cumin, turmeric, goda masala, salt'],['Pressure-cook sprouted matki until tender.','Cook masala and simmer matki into usal.','Steam or lightly stir-fry cauliflower.','Serve with jowar bhakri.'],'Batch-friendly Maharashtrian-style meal.'],
['Egg bhurji + roti','अंडा भुर्जी + पोळी','Breakfast/Dinner','20 min','8 ml','~19 g','~4 g','~390 kcal',['8 eggs','8 whole-wheat rotis','200 g onion-tomato','100 g spinach','8 ml oil','turmeric, cumin, coriander, salt'],['Whisk eggs.','Cook onion-tomato and spinach with spices.','Add eggs and scramble until fully cooked.','Serve with rotis.'],'Cook eggs fully; egg-free option can be paneer bhurji.'],
['Mixed bean curry + roti + dudhi','मिश्र कडधान्य भाजी + पोळी + दुधी','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~500 kcal',['280 g mixed beans, soaked','8 whole-wheat rotis','500 g dudhi','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook soaked mixed beans until tender.','Cook tomato-onion masala and simmer beans.','Cook chopped dudhi until soft.','Serve with rotis.'],'Use a mix such as chana, lobia and whole moong; cook thoroughly.'],
['Paneer chaat + pomegranate','पनीर चाट + डाळिंब','Snack','10 min','0 ml','~15 g','~3 g','~250 kcal',['300 g paneer','1 pomegranate','150 g cucumber and tomato','lemon, coriander','roasted cumin, salt'],['Cube paneer and chop vegetables.','Mix with lemon and spices.','Top with pomegranate arils.'],'Fresh, quick snack with no deep frying.'],
['Vegetable moong khichdi + curd + carrot-cucumber','भाजी मूग खिचडी + दही + गाजर-काकडी','Lunch/Dinner','35 min','10 ml','~14 g','~7 g','~420 kcal',['180 g rice','120 g moong dal','300 g mixed vegetables','400 g plain curd','150 g carrot and cucumber','10 ml oil','turmeric, cumin, salt'],['Rinse rice and moong dal.','Pressure-cook with vegetables, turmeric and water.','Finish with measured oil tempering if desired.','Serve with curd statistics and carrot-cucumber.'],'Soft home-style khichdi; easy on busy days.'],
['Besan-paneer chilla','बेसन-पनीर चिल्ला','Breakfast','20 min','10 ml','~16 g','~5 g','~330 kcal',['160 g besan','150 g paneer','100 g grated carrot, onion and spinach','ginger, cumin, salt','10 ml oil'],['Whisk besan into a smooth batter.','Add vegetables and crumbled paneer.','Cook 4 chillas with measured oil.','Serve hot.'],'Keep batter medium-thick so it cooks evenly.'],
['Chole + roti + cabbage-peas + apple','छोले + पोळी + कोबी-वाटाणा + सफरचंद','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~520 kcal',['280 g dry chickpeas, soaked','8 whole-wheat rotis','350 g cabbage','100 g peas','1 apple','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook soaked chickpeas.','Prepare masala and simmer chole.','Cook cabbage and peas until just tender.','Serve with rotis and apple.'],'Home-style chole; keep the vegetable side lightly spiced.'],
['Milk + banana + peanut powder','दूध + केळे + शेंगदाणा पूड','Snack','5 min','0 ml','~10 g','~3 g','~250 kcal',['600 ml milk','4 bananas','40 g roasted peanut powder'],['Warm or serve milk as preferred.','Slice one banana per serving.','Sprinkle measured peanut powder.'],'Quick snack; avoid adding sugar routinely.'],
['Palak paneer + roti + cucumber','पालक पनीर + पोळी + काकडी','Lunch/Dinner','35 min','12 ml','~21 g','~7 g','~500 kcal',['400 g paneer','500 g spinach','8 whole-wheat rotis','2 cucumbers','200 g tomato-onion','12 ml oil','ginger, cumin, turmeric, salt'],['Blanch spinach briefly and blend.','Cook onion-tomato with spices.','Add spinach and simmer.','Add paneer and serve with rotis and cucumber.'],'Keep spinach bright and paneer lightly cooked.'],
['Handvo + curd','हांडवो + दही','Breakfast','45 min','15 ml','~14 g','~5 g','~360 kcal',['220 g rice and mixed dal handvo batter','150 g grated dudhi','400 g plain curd','ginger, sesame, cumin, salt','15 ml oil'],['Mix handvo batter with grated dudhi and seasoning.','Pour into a thick tawa or oven-safe pan.','Cook covered until set and browned, turning if needed.','Serve with curd.'],'Use fermented mixed rice-dal batter for traditional texture; weekend-friendly.'],
['Bharli vangi + jowar bhakri + curd + cucumber','भरली वांगी + ज्वारी भाकरी + दही + काकडी','Lunch/Dinner','45 min','15 ml','~16 g','~8 g','~500 kcal',['8 small brinjals','80 g roasted peanut powder','30 g sesame','4 jowar bhakri','400 g curd','2 cucumbers','200 g onion-tomato','15 ml oil','goda masala, turmeric, coriander, salt'],['Slit brinjals and fill with peanut-sesame masala.','Cook covered with measured oil until tender.','Serve with jowar bhakri and curd.','Add cucumber on the side.'],'Traditional Maharashtrian home-style preparation; keep stuffing moderate.'],
['Chana chaat + mosambi','हरभरा चाट + मोसंबी','Snack','10 min','0 ml','~8 g','~7 g','~220 kcal',['240 g boiled kala chana','150 g tomato-cucumber-onion','2 mosambi','lemon, coriander','roasted cumin, salt'],['Mix cooked chana with chopped vegetables.','Season with lemon, cumin and coriander.','Serve with mosambi segments.'],'Use fully cooked chana rather than raw sprouts.'],
['Soy-paneer keema + roti + cabbage','सोया-पनीर कीमा + पोळी + कोबी','Lunch/Dinner','30 min','12 ml','~22 g','~8 g','~500 kcal',['120 g dry soy granules','200 g paneer','8 whole-wheat rotis','300 g finely chopped cabbage','200 g tomato-onion','12 ml oil','ginger, cumin, turmeric, coriander powder, salt'],['Soak soy granules in hot water, rinse and squeeze well.','Cook tomato-onion masala.','Add minced soy and crumbled paneer; cook until dry.','Serve with rotis and lightly cooked cabbage.'],'Uses minced soy rather than soy chunks for a softer keema texture.'],
['Methi dashmi + curd + banana','मेथी दशमी + दही + केळे','Breakfast','35 min','12 ml','~13 g','~5 g','~380 kcal',['220 g whole-wheat atta','80 g besan','50 g chopped fresh methi','400 g plain curd','4 bananas','12 ml oil','turmeric, cumin, chilli, salt'],['Mix atta, besan, methi and spices into a soft dough.','Roll thin dashmi and cook on a tawa with measured oil.','Serve with curd and one banana per serving.'],'Traditional home-style flatbread; keep oil measured.'],
['Matki misal + pav + cucumber-onion','मटकी मिसळ + पाव + काकडी-कांदा','Lunch/Dinner','40 min','12 ml','~18 g','~9 g','~500 kcal',['500 g cooked sprouted matki usal','4 pav','200 g onion','1 cucumber','100 g measured farsan','200 g tomato-onion masala','12 ml oil','lemon, coriander, goda masala, salt'],['Cook sprouted matki until tender and make a moderately spiced usal.','Assemble bowls with usal and a measured amount of farsan.','Serve with pav, cucumber and onion.'],'Keep farsan measured; the usal remains the main protein component.'],
['Curd + papaya + flax','दही + पपई + जवस','Snack','5 min','0 ml','~8 g','~5 g','~200 kcal',['600 g plain curd','400 g papaya','20 g ground flaxseed'],['Cube papaya.','Add to curd.','Top with ground flaxseed.'],'Keep ground flax refrigerated and use fresh curd.'],
['Paneer vegetable tikka + roti + tomato-cucumber','पनीर भाजी टिक्का + पोळी + टोमॅटो-काकडी','Lunch/Dinner','35 min','10 ml','~21 g','~6 g','~480 kcal',['400 g paneer','300 g capsicum, onion and tomato','8 whole-wheat rotis','200 g tomato-cucumber','100 g curd','10 ml oil','turmeric, cumin, chilli, coriander, salt'],['Marinate paneer and vegetables in curd and spices.','Cook on tawa or bake until lightly browned.','Serve with rotis and fresh tomato-cucumber.'],'Home-style tawa/baked tikka; no deep frying.'],
['Peanuts + banana','शेंगदाणे + केळे','Snack','3 min','0 ml','~8 g','~3 g','~220 kcal',['80 g roasted peanuts','4 bananas'],['Portion peanuts.','Serve one banana per person.'],'Simple portable snack; portion peanuts rather than eating from the packet.'],
['Paneer bhurji + roti + spinach','पनीर भुर्जी + पोळी + पालक','Lunch/Dinner','25 min','10 ml','~21 g','~6 g','~470 kcal',['400 g paneer','8 whole-wheat rotis','300 g spinach','200 g tomato-onion','10 ml oil','cumin, turmeric, coriander, salt'],['Cook tomato-onion masala and crumble in paneer.','Cook spinach separately with light seasoning.','Serve bhurji with rotis and spinach.'],'Fast weekday protein-rich meal.'],
['Ragi dosa + sambar','नाचणी डोसा + सांबार','Breakfast','30 min','10 ml','~11 g','~6 g','~320 kcal',['160 g ragi flour','80 g rice flour','500 g vegetable sambar','10 ml oil','cumin, salt'],['Mix ragi and rice flour with water and rest.','Spread thin dosas and cook with measured oil.','Serve with vegetable-rich sambar.'],'Fermentation optional; batch batter saves weekday time.'],
['Chana usal + roti + cauliflower-carrot','हरभरा उसळ + पोळी + फुलकोबी-गाजर','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~500 kcal',['250 g dry kala chana, soaked','8 whole-wheat rotis','300 g cauliflower','150 g carrot','200 g tomato-onion','12 ml oil','cumin, turmeric, goda masala, salt'],['Pressure-cook chana until tender.','Prepare masala and simmer chana.','Cook cauliflower and carrot until just tender.','Serve with rotis.'],'A practical weekday variation of chana usal.'],
['Sprouted moong chaat','मोड आलेल्या मूगाची चाट','Snack','15 min','5 ml','~9 g','~6 g','~180 kcal',['400 g steamed sprouted moong','150 g tomato-cucumber','10 g peanuts','lemon, coriander','5 ml oil','roasted cumin, salt'],['Steam sprouts until safely cooked.','Mix with vegetables, peanuts and lemon.','Season lightly and serve.'],'Do not serve raw sprouts; steam/cook them first.'],
['Egg bhurji + roti + dudhi','अंडा भुर्जी + पोळी + दुधी','Lunch/Dinner','30 min','10 ml','~19 g','~6 g','~450 kcal',['8 eggs','8 whole-wheat rotis','400 g dudhi','200 g onion-tomato','10 ml oil','cumin, turmeric, coriander, salt'],['Cook chopped dudhi until tender.','Cook onion-tomato masala.','Add beaten eggs and scramble fully.','Serve with rotis and dudhi.'],'Cook eggs fully; keep dudhi soft and lightly seasoned.'],
['Vegetable poha + peanuts + curd','भाजी पोहे + शेंगदाणे + दही','Breakfast','20 min','10 ml','~10 g','~5 g','~330 kcal',['240 g poha','50 g peanuts','200 g onion, carrot and peas','400 g plain curd','10 ml oil','mustard, cumin, turmeric, lemon, salt'],['Rinse and drain poha.','Cook vegetables with tempering.','Add poha and season.','Finish with peanuts and serve with curd.'],'Measure peanuts and oil; easy daily breakfast.'],
['Rajma rice + cucumber + papaya','राजमा भात + काकडी + पपई','Lunch/Dinner','45 min','12 ml','~17 g','~9 g','~520 kcal',['280 g dry rajma, soaked','320 g cooked rice','1 cucumber','300 g papaya','200 g tomato-onion','12 ml oil','ginger, cumin, turmeric, salt'],['Pressure-cook rajma until completely tender.','Cook tomato-onion masala and simmer rajma.','Serve with measured rice.','Add cucumber and papaya on the side.'],'Keep the fruit as a separate simple side portion.'],
['Pesarattu + peanut chutney','पेसरट्टू + शेंगदाणा चटणी','Breakfast','30 min','10 ml','~13 g','~5 g','~300 kcal',['240 g soaked whole green gram','40 g roasted peanuts','coriander','ginger, cumin, lemon, salt','10 ml oil'],['Blend soaked moong into a smooth batter.','Spread thin pesarattu and cook with measured oil.','Grind peanuts, coriander, lemon and spices into chutney.','Serve together.'],'Soak overnight and make batter in batches.'],
['Mixed bean curry + roti + cabbage-carrot','मिश्र कडधान्य भाजी + पोळी + कोबी-गाजर','Lunch/Dinner','40 min','12 ml','~18 g','~11 g','~500 kcal',['280 g mixed beans, soaked','8 whole-wheat rotis','250 g cabbage','150 g carrot','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook mixed beans until tender.','Prepare tomato-onion masala and simmer beans.','Make a quick cabbage-carrot stir-fry.','Serve with rotis.'],'Use thoroughly cooked mixed beans.'],
['Tofu vegetable curry + roti + cucumber','टोफू भाजी + पोळी + काकडी','Lunch/Dinner','30 min','12 ml','~18 g','~6 g','~470 kcal',['350 g firm tofu','300 g tomato, onion, capsicum and peas','8 whole-wheat rotis','2 cucumbers','12 ml oil','ginger, cumin, turmeric, coriander powder, salt'],['Press and cube tofu.','Cook tomato-onion masala and vegetables.','Add tofu and simmer briefly.','Serve with rotis and cucumber.'],'A soft soy option without chunky soy texture.'],
['Besan vegetable chilla + curd','बेसन भाजी चिल्ला + दही','Breakfast','15 min','10 ml','~11 g','~5 g','~300 kcal',['160 g besan','150 g grated carrot, onion and spinach','400 g plain curd','ginger, cumin, salt','10 ml oil'],['Whisk besan with water and vegetables.','Cook thin chillas with measured oil.','Serve with curd.'],'Keep batter medium-thick and cook through.'],
['Chole + roti + bhindi + apple','छोले + पोळी + भेंडी + सफरचंद','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~520 kcal',['280 g dry chickpeas, soaked','8 whole-wheat rotis','400 g bhindi','1 apple','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook chickpeas.','Prepare masala and simmer chole.','Cook bhindi with measured oil.','Serve with rotis and apple.'],'Batch-cook chickpeas to shorten weekday preparation.'],
['Mixed-dal adai + tomato chutney','मिश्र डाळ अडई + टोमॅटो चटणी','Breakfast','35 min','10 ml','~14 g','~6 g','~330 kcal',['250 g mixed dals, soaked','150 g tomato','ginger, chilli, curry leaves','100 g vegetables','10 ml oil','salt'],['Soak and coarsely blend mixed dals.','Mix in vegetables and seasoning.','Cook thick adai on a tawa with measured oil.','Cook tomato, ginger and chilli and blend into chutney.'],'Use varied dals; cook the adai thoroughly.'],
['Bharli vangi + jowar bhakri + curd','भरली वांगी + ज्वारी भाकरी + दही','Lunch/Dinner','45 min','15 ml','~16 g','~8 g','~480 kcal',['8 small brinjals','80 g roasted peanut powder','30 g sesame','4 jowar bhakri','400 g curd','200 g onion-tomato','15 ml oil','goda masala, turmeric, coriander, salt'],['Fill slit brinjals with peanut-sesame masala.','Cook covered with measured oil until tender.','Serve with jowar bhakri and curd.'],'Traditional home-style preparation; keep stuffing moderate.'],
['Protein thalipeeth + curd','प्रोटीन थालीपीठ + दही','Breakfast','30 min','15 ml','~13 g','~6 g','~350 kcal',['120 g jowar flour','80 g besan','40 g ground peanuts','150 g grated vegetables','400 g plain curd','15 ml oil','cumin, sesame, salt'],['Mix flours, peanuts, vegetables and seasoning into a soft dough.','Pat 4 thalipeeth portions on a tawa.','Cook with measured oil until both sides are done.','Serve with curd.'],'Traditional-style mixed flour thalipeeth with added protein foods.'],
['Sprouts poha + curd','मोड आलेले पोहे + दही','Breakfast','25 min','10 ml','~11 g','~6 g','~340 kcal',['180 g poha','200 g cooked sprouted moong','150 g onion, carrot and peas','400 g plain curd','10 ml oil','mustard, cumin, turmeric, lemon, salt'],['Rinse poha.','Steam or pressure-cook sprouts until tender.','Cook vegetables and tempering, then add poha and sprouts.','Serve with curd.'],'Cook sprouts before mixing; good for batch-prepped weekday breakfast.'],
['Chana usal + jowar bhakri + dudhi','हरभरा उसळ + ज्वारी भाकरी + दुधी','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~500 kcal',['250 g dry kala chana, soaked','4 jowar bhakri','500 g dudhi','200 g tomato-onion','12 ml oil','cumin, turmeric, goda masala, salt'],['Pressure-cook chana until tender.','Prepare masala and simmer into usal.','Cook dudhi until soft.','Serve with jowar bhakri.'],'Batch-friendly Maharashtrian-style meal.'],
['Curd + banana + pumpkin seeds','दही + केळे + भोपळ्याच्या बिया','Snack','5 min','0 ml','~9 g','~4 g','~230 kcal',['600 g plain curd','4 bananas','30 g pumpkin seeds'],['Slice bananas.','Divide curd into 4 bowls.','Top with banana and measured pumpkin seeds.'],'No added sugar needed for routine use.'],
['Tofu bhurji + roti + cucumber-tomato','टोफू भुर्जी + पोळी + काकडी-टोमॅटो','Lunch/Dinner','25 min','10 ml','~18 g','~6 g','~440 kcal',['350 g firm tofu, crumbled','8 whole-wheat rotis','1 cucumber','2 tomatoes','200 g onion','10 ml oil','turmeric, cumin, coriander, salt'],['Cook onion and spices.','Add crumbled tofu and cook until dry.','Serve with rotis and fresh cucumber-tomato.'],'Press tofu well for a bhurji-like texture.'],
['Rajma rice + cabbage-carrot','राजमा भात + कोबी-गाजर','Lunch/Dinner','45 min','12 ml','~17 g','~10 g','~520 kcal',['280 g dry rajma, soaked','320 g cooked rice','250 g cabbage','150 g carrot','200 g tomato-onion','12 ml oil','ginger, cumin, turmeric, salt'],['Pressure-cook rajma until completely tender.','Cook masala and simmer rajma.','Stir-fry cabbage and carrot lightly.','Serve with measured rice.'],'A practical vegetable variation of rajma rice.'],
['Sprouted moong chaat + cucumber','मोड आलेल्या मूगाची चाट + काकडी','Snack','15 min','5 ml','~9 g','~7 g','~190 kcal',['400 g steamed sprouted moong','2 cucumbers','100 g tomato','10 g peanuts','lemon, coriander','5 ml oil','roasted cumin, salt'],['Steam sprouts until cooked.','Mix with chopped cucumber, tomato and peanuts.','Season with lemon and cumin.'],'Cook sprouts before serving.'],
['Egg bhurji + roti + bhindi','अंडा भुर्जी + पोळी + भेंडी','Lunch/Dinner','30 min','10 ml','~19 g','~6 g','~460 kcal',['8 eggs','8 whole-wheat rotis','400 g bhindi','200 g onion-tomato','10 ml oil','cumin, turmeric, coriander, salt'],['Cook bhindi with measured oil.','Prepare onion-tomato masala.','Add beaten eggs and scramble fully.','Serve with rotis and bhindi.'],'Cook eggs fully and keep bhindi lightly crisp.'],
['Mixed bean curry + roti + dudhi + apple','मिश्र कडधान्य भाजी + पोळी + दुधी + सफरचंद','Lunch/Dinner','40 min','12 ml','~18 g','~10 g','~520 kcal',['280 g mixed beans, soaked','8 whole-wheat rotis','500 g dudhi','1 apple','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook mixed beans until tender.','Cook tomato-onion masala and simmer beans.','Cook dudhi until soft.','Serve with rotis and apple.'],'Cook mixed beans thoroughly and keep fruit as a separate side.'],
['Chole + roti + cauliflower-carrot + papaya','छोले + पोळी + फुलकोबी-गाजर + पपई','Lunch/Dinner','40 min','12 ml','~18 g','~11 g','~530 kcal',['280 g dry chickpeas, soaked','8 whole-wheat rotis','300 g cauliflower','150 g carrot','300 g papaya','200 g tomato-onion','12 ml oil','cumin, turmeric, coriander powder, salt'],['Pressure-cook chickpeas.','Prepare masala and simmer chole.','Cook cauliflower and carrot until tender.','Serve with rotis and papaya.'],'Keep papaya as a simple fresh side.'],
['Roasted chana + banana','भाजलेला हरभरा + केळे','Snack','3 min','0 ml','~7 g','~5 g','~210 kcal',['120 g roasted chana','4 small bananas'],['Portion roasted chana.','Serve one banana per person.'],'Portable and quick.'],
['Soy-paneer keema + roti + cabbage salad','सोया-पनीर कीमा + पोळी + कोबी कोशिंबीर','Lunch/Dinner','30 min','12 ml','~22 g','~9 g','~510 kcal',['120 g dry soy granules','200 g paneer','8 whole-wheat rotis','300 g finely shredded cabbage','200 g tomato-onion','12 ml oil','lemon, coriander, cumin, turmeric, salt'],['Soak soy granules in hot water, rinse and squeeze.','Cook tomato-onion masala.','Add minced soy and crumbled paneer and cook until dry.','Toss cabbage with lemon and coriander and serve with rotis.'],'Minced soy gives a softer texture than soy chunks.'],
['Matki usal + jowar bhakri + cabbage-carrot koshimbir','मटकी उसळ + ज्वारी भाकरी + कोबी-गाजर कोशिंबीर','Lunch/Dinner','40 min','12 ml','~18 g','~11 g','~510 kcal',['250 g dry matki, sprouted','4 jowar bhakri','250 g cabbage','150 g carrot','200 g tomato-onion','12 ml oil','lemon, coriander, cumin, goda masala, salt'],['Pressure-cook sprouted matki until tender.','Cook tomato-onion masala and simmer matki.','Prepare cabbage-carrot koshimbir with lemon and coriander.','Serve with jowar bhakri.'],'Traditional Maharashtrian-style meal with measured oil.']
];
const calendarRecipeObj=calendarRecipeData.map((r,i)=>({id:'cr'+i,name:r[0],mr:r[1],course:r[2],time:r[3],oil:r[4],protein:r[5],fibre:r[6],cal:r[7],ingredients:r[8],method:r[9],note:r[10]}));
const recipeObj=dedupeRecipesByName(recipes.map((r,i)=>({id:'r'+i,name:r[0],mr:r[1],course:r[2],time:r[3],oil:r[4],protein:r[5],fibre:r[6],cal:r[7],ingredients:r[8],method:r[9],note:r[10]})).concat(calendarRecipeObj));
const shoppingNames=[['Whole-wheat atta','गव्हाचे पीठ','Staples','12–15 kg/month'],['Jowar flour','ज्वारीचे पीठ','Staples','4–5 kg/month'],['Rice','तांदूळ','Staples','4–5 kg/month'],['Poha','पोहे','Staples','2 kg/month'],['Besan','बेसन','Staples','2–3 kg/month'],['Moong dal','मूग डाळ','Pulses & Legumes','2–3 kg/month'],['Mixed dals','मिश्र डाळी','Pulses & Legumes','2–3 kg/month'],['Whole matki','अख्खी मटकी','Pulses & Legumes','2–3 kg/month'],['Chickpeas/kabuli chana','काबुली हरभरा','Pulses & Legumes','2–3 kg dry'],['Rajma','राजमा','Pulses & Legumes','1.5–2 kg dry'],['Lobia','चवळी','Pulses & Legumes','1–1.5 kg dry'],['Paneer','पनीर','Dairy','5–6 kg/month'],['Plain curd','साधे दही','Dairy','10–12 kg/month'],['Milk','दूध','Dairy','10–12 L/month'],['Eggs','अंडी','Eggs','2–3 dozen/month'],['Soy granules','सोया ग्रॅन्युल्स','Pulses & Legumes','1–1.5 kg/month'],['Bhindi','भेंडी','Vegetables','2–3 kg'],['Dudhi/bottle gourd','दुधी भोपळा','Vegetables','2–3 kg'],['Brinjal/vangi','वांगी','Vegetables','1.5–2 kg'],['Cabbage','कोबी','Vegetables','2–3 kg'],['Carrot','गाजर','Vegetables','2 kg'],['Cauliflower','फुलकोबी','Vegetables','1.5–2 kg'],['Spinach/palak','पालक','Vegetables','1.5–2 kg'],['Tomato','टोमॅटो','Vegetables','4–5 kg'],['Cucumber','काकडी','Vegetables','3–4 kg'],['Onion','कांदा','Vegetables','4–5 kg'],['Pomegranate','डाळिंब','Fruits','1.5–2 kg'],['Guava','पेरू','Fruits','2–3 kg'],['Banana','केळी','Fruits','5–7 dozen/month'],['Papaya','पपई','Fruits','3–4 kg'],['Mosambi','मोसंबी','Fruits','2–3 kg'],['Apples','सफरचंद','Fruits','2–3 kg'],['Peanuts','शेंगदाणे','Nuts & Seeds','1.5–2 kg'],['Flaxseed','जवस','Nuts & Seeds','500–750 g'],['Sesame','तीळ','Nuts & Seeds','500 g'],['Pumpkin seeds','भोपळ्याच्या बिया','Nuts & Seeds','300–500 g'],['Roasted chana','भाजलेला हरभरा','Pulses & Legumes','1.5–2 kg'],['Mustard/groundnut oil','मोहरी/शेंगदाणा तेल','Other','2–3 L combined']];
const prep=[['Sunday batch-cook chickpeas, rajma and lobia','रविवारी हरभरा, राजमा आणि चवळी शिजवून ठेवणे','2026-09-06','Meal Prep'],['Sprout matki and moong','मटकी आणि मूग मोड आणणे','2026-09-06','Batter / Sprouting'],['Prepare dosa/idli batter','डोसा/इडली बॅटर तयार करणे','2026-09-06','Batter / Sprouting'],['Make peanut-coriander chutney powder','शेंगदाणा-कोथिंबीर चटणी पूड तयार करणे','2026-09-06','Meal Prep'],['Make ground flaxseed portion','जवसाची पूड छोटे भाग करून ठेवणे','2026-09-06','Storage'],['Pre-portion roasted chana and peanuts','भाजलेला हरभरा आणि शेंगदाणे मोजून भाग करणे','2026-09-06','Meal Prep'],['Prepare shopping list for Month 1 week 1','पहिल्या आठवड्याची खरेदी यादी तयार करणे','2026-09-06','Shopping'],['Review Vikas food-reaction log','विकासच्या अन्न-प्रतिक्रिया नोंदी तपासणे','2026-09-13','Review']].map((x,i)=>({id:'p'+i,task:x[0],mr:x[1],date:x[2],area:x[3],done:false}));
const starter={version:2,members:family,meals:makeMeals(),recipes:recipeObj,shopping:shoppingNames.map((x,i)=>({id:'s'+i,item:x[0],mr:x[1],category:x[2],quantity:x[3],need:false,purchased:false})),prep,healthTips:[],healthTargets:[],nutritionEducation:[],ingredientCatalog:[],recipeIngredients:[],mealAssignments:[],dietaryRules:DEFAULT_DIETARY_RULES,frequencyRules:DEFAULT_FREQUENCY_RULES,householdSettings:{householdSize:4,oilStockMl:5000,oilMonthlyTargetMl:3000,displayName:'कुटुंब भोजन'},updatedAt:new Date().toISOString()};
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');return x&&(x.version===1||x.version===2)?{...clone(starter),...x,version:2}:clone(starter)}catch{return clone(starter)}}
let state=load();
state.recipes=state.recipes.map(r=>buildStructuredRecipe(r,state.recipeIngredients||[],state.ingredientCatalog||[]));
let page='today';let selectedDate=new Date().toISOString().slice(0,10);let selectedRecipe=null;let toastTimer;
let theme=localStorage.getItem(THEME_STORAGE)||'system';
let language=localStorage.getItem(LANGUAGE_STORAGE)||'both';
let cloudRefreshTimer=null;
let cloudInitializing=false;
let cloudApplyingRemote=false;
let showRecipeModal=false;
let editingRecipe=null;

async function save(){
 state.updatedAt=new Date().toISOString();
 localStorage.setItem(STORAGE,JSON.stringify(state));
 if(remoteReady&&!cloudApplyingRemote){await syncLocalChanges();await syncPhase2();}
 toast('जतन झाले · Saved');
}
async function saveHouseholdSettings(){
 const current=state.householdSettings||starter.householdSettings||{};
 const householdSize=Math.min(20,Math.max(1,Number(current.householdSize)||4));
 const oilStockMl=Math.max(0,Number(current.oilStockMl)||0);
 const oilMonthlyTargetMl=Math.max(100,Number(current.oilMonthlyTargetMl)||3000);
 const displayName=current.displayName||'कुटुंब भोजन';
 state.householdSettings={...current,householdSize,oilStockMl,oilMonthlyTargetMl,displayName};
 localStorage.setItem(STORAGE,JSON.stringify(state));
 if(!remoteReady||!remoteHouseholdId)return true;
 try{
  const payload={household_id:remoteHouseholdId,display_name:displayName,household_size:householdSize,oil_stock_ml:oilStockMl,oil_monthly_target_ml:oilMonthlyTargetMl,updated_at:new Date().toISOString()};
  const {error}=await supabase.from('household_settings').upsert(payload,{onConflict:'household_id'});
  if(error)throw error;
  return true;
 }catch(err){
  console.warn('saveHouseholdSettings failed',err);
  toast('Cloud sync failed / सेटिंग्ज क्लाउडमध्ये जतन होऊ शकली नाही');
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
  if(error){console.warn(`sync failed for ${table}`,error);toast('Cloud sync error · क्लाउड जतन अयशस्वी');return false;}
 }
 return true;
}
async function seedRemote(){
 const rows=buildRemoteRows(state,remoteHouseholdId);
 const conflicts={'meal_entries':'household_id,meal_date,slot','recipes':'household_id,recipe_key','family_members':'household_id,member_key','shopping_items':'household_id,item_key','prep_tasks':'household_id,task_key'};
 const batches=REMOTE_TABLES.map(table=>[table,rows[table],conflicts[table]]);
 for(const [table,payload,onConflict] of batches){
  const {error}=await supabase.from(table).upsert(payload,{onConflict});
  if(error)throw error;
 }
}
async function loadRemote(){
 const [a,b,c,d,e,f,g,h,i,j,k,rules,l]=await Promise.all([
  supabase.from('meal_entries').select('*').eq('household_id',remoteHouseholdId),
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
  supabase.from('nutrition_education').select('*').eq('active',true).order('sort_order')
 ]);
 const err=[a,b,c,d,e,f,g,h,i,j,k,rules,l].find(x=>x.error)?.error;
 if(err)throw err;
 const wasSeeded=!a.data?.length;
 if(wasSeeded){ await seedRemote(); return loadRemote(); }
 cloudApplyingRemote=true;
 try{
  if(wasSeeded){
   const mapped=mapRemoteState({members:c.data,meals:a.data,recipes:b.data,shopping:d.data,prep:e.data},state);
   state={...mapped,healthTips:mapHealthTips(f.data),healthTargets:mapHealthTargets(g.data),householdSettings:mapHouseholdSettings(h.data)||state.householdSettings,nutritionEducation:mapNutritionEducation(l.data),ingredientCatalog:mapIngredientCatalog(i.data),recipeIngredients:mapRecipeIngredients(j.data),mealAssignments:mapMealAssignments(k.data),dietaryRules:mapDietaryRules(rules.data)};
  }else{
   state=mapRemoteState({members:c.data,meals:a.data,recipes:b.data,shopping:d.data,prep:e.data},state);
   state.healthTips=mapHealthTips(f.data); state.healthTargets=mapHealthTargets(g.data); state.householdSettings=mapHouseholdSettings(h.data)||state.householdSettings;
   state.nutritionEducation=mapNutritionEducation(l.data); state.ingredientCatalog=mapIngredientCatalog(i.data); state.recipeIngredients=mapRecipeIngredients(j.data); state.mealAssignments=mapMealAssignments(k.data); state.dietaryRules=mapDietaryRules(rules.data);
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
 const tables=[...REMOTE_TABLES,'household_settings','recipe_ingredients','meal_assignments'];
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
  try{await loadRemote();render();}catch(err){console.warn('realtime refresh failed',err);}
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
  const {data,error}=await supabase.rpc('bootstrap_household',{household_name:'कुटुंब भोजन'});
  if(error)throw error;
  remoteHouseholdId=data;
  await loadRemote();
  remoteReady=true;
  await syncPhase2();
  subscribeToHousehold();
  render();
 }catch(err){
  console.error('Cloud initialization failed',err);
  cleanupCloud();
  render();
  toast('Cloud sync unavailable · क्लाउड sync उपलब्ध नाही. Local data चालू आहे.');
 }finally{cloudInitializing=false;}
}
supabase.auth.onAuthStateChange((_event,session)=>{
 if(session&&!remoteReady)initCloud();
 if(!session){cleanupCloud();initCloud();}
});
function toast(msg){clearTimeout(toastTimer);const el=document.getElementById('toast');if(!el)return;el.textContent='✓ '+msg;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),1600)}
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function dateLabel(d){return new Intl.DateTimeFormat(language==='en'?'en-IN':'mr-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T00:00:00'))}
function fmt(d){return new Intl.DateTimeFormat(language==='en'?'en-IN':'mr-IN',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d+'T00:00:00'))}
function findRecipe(title){return state.recipes.find(r=>r.name.toLowerCase()===String(title||'').toLowerCase())||null}
function applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='system'?'light dark':theme}
function setTheme(value){theme=value;localStorage.setItem(THEME_STORAGE,value);applyTheme();render()}
function applyLanguage(){document.documentElement.dataset.language=language}
function setLanguage(value){language=['mr','en','both'].includes(value)?value:'both';localStorage.setItem(LANGUAGE_STORAGE,language);tts.stop();applyLanguage();render()}

function t(mrText, enText){
  if(language==='mr') return mrText || enText || '';
  if(language==='en') return enText || mrText || '';
  if(!mrText) return enText || '';
  if(!enText || enText === mrText) return mrText;
  return `${mrText} · ${enText}`;
}
function ui(mrText, enText){
  return t(mrText, enText);
}

const slotNames = {
  Breakfast: { mr: 'सकाळचा नाश्ता', en: 'Breakfast' },
  Lunch: { mr: 'दुपारचे जेवण', en: 'Lunch' },
  Snack: { mr: 'संध्याकाळचा खाऊ', en: 'Evening Snack' },
  Dinner: { mr: 'रात्रीचे जेवण', en: 'Dinner' }
};

function ttsButtonLabel(isPlaying, lang=language){
 if(isPlaying){
  if(lang==='mr') return '⏹ <span class="tts-label">थांबवा</span>';
  if(lang==='en') return '⏹ <span class="tts-label">Stop</span>';
  return '⏹ <span class="tts-label">थांबवा / Stop</span>';
 }
 if(lang==='mr') return '🔊 <span class="tts-label">ऐका</span>';
 if(lang==='en') return '🔊 <span class="tts-label">Listen</span>';
 return '🔊 <span class="tts-label">ऐका / Listen</span>';
}

function ttsButtonHtml(key, mrText, enText, extraClass=''){
 if(!tts.isSupported()) return '';
 const active=tts.isSpeaking() && tts.getCurrentKey()===key;
 const ariaLabel=active
  ? (language==='mr'?'थांबवा':language==='en'?'Stop':'थांबवा / Stop')
  : (language==='mr'?'ऐका':language==='en'?'Listen':'ऐका / Listen');
 return `<button type="button" class="tts-btn ${active?'active':''} ${extraClass}" data-tts-key="${esc(key)}" data-tts-mr="${esc(mrText)}" data-tts-en="${esc(enText)}" aria-label="${esc(ariaLabel)}" aria-pressed="${active?'true':'false'}">${ttsButtonLabel(active,language)}</button>`;
}

function assignmentsForMeal(meal){return (state.mealAssignments||[]).filter(a=>a.mealEntryId===meal.id);}
function assignmentOptions(meal,member,assignment){
 const current=assignment?.recipeId;
 const candidates=state.recipes.filter(r=>r.dietaryFlags?.vegetarian && !r.dietaryFlags?.containsEgg);
 return candidates.map(r=>`<option value="${esc(r.id)}" ${r.id===current?'selected':''}>${esc(t(r.mr,r.name))}</option>`).join('');
}

function mealAssignmentsView(meal){
 const assignments=assignmentsForMeal(meal);
 if(!assignments.length)return '';
 const grouped=groupMemberAssignments(assignments, state.members, state.recipes);

 const familySummary = !grouped.hasAlternates
   ? `<div class="family-meal-badge">
        <span>👨‍👩‍👦 ${t('कुटुंब','Family')}</span>
        <small>${state.members.length} ${t('सदस्य · संपूर्ण कुटुंब एकच जेवण','members · shared meal')}</small>
      </div>`
   : `<div class="member-alternates-box">
        <div class="alternates-title">👨‍👩‍👦 ${t('सदस्य बदल','Member changes')}</div>
        ${grouped.groups.map(g=>{
          const memberList = g.members.map(m=>esc(t(m.mr,m.name))).join(', ');
          const isMissing = !g.recipe && !g.recipeId;
          const recName = g.recipe ? esc(t(g.recipe.mr,g.recipe.name)) : (isMissing ? `<span class="alternate-missing-text">${t('पर्याय उपलब्ध नाही','No alternate available')}</span>` : t('पर्याय','Alternate'));
          const hasFreqNote = g.members.some(m => {
            const a = assignments.find(x => x.memberId === m.id);
            return a?.frequencyConstraintApplied || (a?.overrideReason && a.overrideReason.includes('frequency'));
          });
          const tag = g.hasOverride
            ? `<span class="override-tag">${t('बदल','Override')}</span>`
            : hasFreqNote
              ? `<span class="frequency-tag" title="${t('पनीर मासिक मर्यादा (५/महिना) पाळण्यासाठी पर्याय','Selected alternate respecting monthly paneer limit')}">🧀 ${t('पनीर मर्यादा प्राधान्य','Frequency preference')}</span>`
              : g.hasAutoAlternate
                ? `<span class="alternate-note">${t('ऑटो पर्याय','Auto alternate')}</span>`
                : '';
          return `<div class="alternate-row"><b>${memberList}:</b> <span>${recName}</span> ${tag}</div>`;
        }).join('')}
        ${assignments.some(a=>!a.recipeId&&a.overrideReason&&a.overrideReason.includes('frequency'))?`<div class="alternate-warning">⚠️ ${t('कुटुंब नियोजन प्राधान्यांच्या मर्यादेत योग्य शाकाहारी पर्याय उपलब्ध नाही','No suitable alternate within household frequency preferences')}</div>`:''}
      </div>`;

 return `<div class="meal-assignments">
   ${familySummary}
   <details class="member-editor-details">
     <summary class="member-editor-summary">
       <span>⚙️ ${t('सदस्यांचे जेवण बदला','Change for this day')}</span>
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
               <span class="sr-only">${t('आजचा बदल','Change for this day')}</span>
               <select data-change-assignment="${esc(meal.id)}" data-member-id="${esc(member.id)}">
                 ${assignmentOptions(meal,member,a)}
               </select>
             </label>
             ${isOverridden?`<button type="button" class="secondary tiny" data-revert-assignment="${esc(meal.id)}" data-member-id="${esc(member.id)}">${t('मूळ निवडीवर परत या','Revert to automatic')}</button>`:''}
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
 const slotInfo=slotNames[m.slot];
 const slotLabel=slotInfo ? t(slotInfo.mr, slotInfo.en) : (slotMr[m.slot] || m.slot);
 const mealSpeechMr=`${slotInfo?.mr||m.slot}: ${m.marathi||m.title}. ${recipe?.note?`टीप: ${recipe.note}. `:''}${concepts.length?`पोषण: ${concepts.map(c=>c.marathiTitle).join(', ')}.`:''}`;
 const mealSpeechEn=`${slotInfo?.en||m.slot}: ${m.title}. ${recipe?.note?`Note: ${recipe.note}. `:''}${concepts.length?`Nutrition: ${concepts.map(c=>c.title).join(', ')}.`:''}`;
 return `<article class="meal-card">
  <div class="meal-card-head">
   <div class="meal-slot"><span>${icon[m.slot]||'🍲'}</span><div><b>${slotLabel}</b><small>${m.slot}</small></div></div>
   ${ttsButtonHtml(`meal-${m.id}`,mealSpeechMr,mealSpeechEn,'meal-tts-btn')}
  </div>
  <h3>${esc(m.marathi||m.title)}</h3>
  <p>${esc(m.title)}</p>
  ${concepts.length?`<div class="meal-nutrition-pills">${concepts.slice(0,4).map(e=>`<span>${esc(t(e.marathiTitle,e.title))}</span>`).join('')}</div>`:''}
  <button class="link" data-recipe="${esc(m.title)}">${t('पाककृती पाहा →','View recipe →')}</button>
  <div class="slot-reschedule"><span>${t('बदला:','Change slot:')}</span><select data-reschedule-slot="${esc(m.id)}">${state.recipes.map(r=>`<option value="${esc(r.name)}" ${r.name.toLowerCase()===m.title.toLowerCase()?'selected':''}>${esc(t(r.mr,r.name))}</option>`).join('')}</select></div>
  ${mealAssignmentsView(m)}
  ${mealBalanceMini(m)}
 </article>`;
}

function mealBalanceMini(meal){const result=evaluateMealBalance(assignmentsForMeal(meal),state.recipes);const present=result.indicators.filter(x=>x.status==='present').map(x=>`<span>✓ ${esc(t(x.marathiLabel,x.label))}</span>`).join('');return present?`<div class="balance-mini"><b>${t('जेवणाचा समतोल','Meal balance')}</b>${present}</div>`:'';}
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
  <div class="health-action"><b>${t('आजचा छोटा बदल','Small action')}</b><p>${esc(tVal.mrAction)}</p></div>
  ${compact?'':`<details><summary>${t('अधिक माहिती','More details')}</summary><p>${esc(tVal.mrDetail)}</p><p class="muted">${esc(tVal.detail)}</p>${tVal.sourceUrl?`<a href="${esc(tVal.sourceUrl)}" target="_blank" rel="noreferrer">${esc(tVal.sourceLabel||'Source')}</a>`:''}</details>`}
 </article>`;
}

function oilSnapshot(){
 const s=state.householdSettings||starter.householdSettings;
 const size=Math.max(1,Number(s.householdSize)||4);
 const target=Math.max(1,Number(s.oilMonthlyTargetMl)||3000);
 const stock=Math.max(0,Number(s.oilStockMl)||0);
 const daily=(target/30).toFixed(0);
 const perPerson=(target/30/size).toFixed(0);
 const status=stock<=target?t('टार्गेटच्या आत आहे','Within target'):t('साठा जास्त आहे','Stock above target');
 return `<div class="target-card oil-target">
  <div class="target-icon">🫗</div>
  <div>
   <div class="kicker">${t('घरचे नियोजन','HOUSEHOLD TARGET')}</div>
   <h3>${t('खाद्यतेल नियोजन','Cooking Oil Planning')}</h3>
   <p>${stock.toLocaleString('en-IN')} ml ${t('साठा','stock')} · ${status}</p>
  </div>
  <div class="target-values">
   <strong>${target.toLocaleString('en-IN')} ml</strong>
   <span>${t('मासिक नियोजन टार्गेट','monthly planning target')}</span>
  </div>
  <div class="target-meta">
   <span>≈ ${daily} ml/day ${t('घरगुती','household')}</span>
   <span>≈ ${perPerson} ml/person/day</span>
  </div>
  <button class="secondary" data-page="settings">${t('Target बदलायचा? →','Change target? →')}</button>
 </div>`;
}

function targetCards(){return (state.healthTargets||[]).filter(x=>x.id!=='household_oil_planning').slice(0,4).map(tVal=>`<article class="target-mini"><span>${esc(tVal.category)}</span><strong>${esc(tVal.valueText||tVal.value)} ${esc(tVal.unit||'')}</strong><b>${esc(t(tVal.mrLabel,tVal.label))}</b><small>${esc(t(tVal.mrContext,tVal.context))}</small></article>`).join('')}

function today(){
 const meals=state.meals.filter(x=>x.date===selectedDate);
 const tasks=state.prep.filter(x=>x.date===selectedDate);
 const buy=state.shopping.filter(x=>x.need&&!x.purchased).length;
 const tip=state.healthTips?.[0];
 const todayMrSpeech=`आजच्या ताटात: ${meals.map(m=>`${slotNames[m.slot]?.mr||m.slot}: ${m.marathi||m.title}`).join(', ')}. अन्न → पोषण → शरीर. प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.`;
 const todayEnSpeech=`What are we eating today: ${meals.map(m=>`${m.slot}: ${m.title}`).join(', ')}. Food to nutrition to body. Understand what each food contributes to the body.`;
 return `${head(t('आज','TODAY'),ui('आज काय बनवायचे?','What are we eating today?'),t('जेवण, तयारी, खरेदी आणि आरोग्य — एका स्क्रीनवर.','Meals, prep, shopping, and health — all in one place.'))}
 <div class="today-learning-strip">
  <div>
   <span class="learning-kicker">🍽️ ${ui('आजच्या ताटात','What are we eating today?')}</span>
   <strong>${ui('अन्न → पोषण → शरीर','Food → nutrition → body')}</strong>
   <small>${ui('प्रत्येक पदार्थातून शरीराला काय मिळते ते समजून घ्या.','Understand what each food contributes to the body.')}</small>
  </div>
  <div class="today-learning-actions">
   ${ttsButtonHtml('today-learning',todayMrSpeech,todayEnSpeech,'today-tts-btn')}
   <button class="secondary" data-page="health">${ui('पोषण समजून घ्या','Learn about nutrition')} →</button>
  </div>
 </div>
 <div class="today-balance-banner">
  <div>
   <b>⚖️ ${ui('जेवणाचा समतोल','Meal balance')}</b>
   <span>${ui('प्रथिने · तंतू · भाज्या · फळे · संपूर्ण धान्य','Protein · Fibre · Vegetables · Fruit · Whole grains')}</span>
  </div>
 </div>
 <div class="day-picker">
  <button data-day="prev" aria-label="${t('मागील दिवस','Previous day')}">←</button>
  <input id="date" type="date" value="${selectedDate}">
  <button data-day="next" aria-label="${t('पुढील दिवस','Next day')}">→</button>
 </div>
 <div class="meal-grid">${meals.map(mealCard).join('')}</div>
 ${todayFoodLearning(meals)}
 <div class="dashboard-health">${tip?healthTipCard(tip,true):''}${oilSnapshot()}</div>
 <div class="target-grid">${targetCards()}</div>
 <div class="three-col">
  <div class="panel">
   <div class="panel-title">🔪 ${ui('आजची तयारी','Today’s prep')}</div>
   ${tasks.length?tasks.map(tVal=>`<label class="check-row"><input type="checkbox" data-prep="${tVal.id}" ${tVal.done?'checked':''}><span><b>${esc(t(tVal.mr,tVal.task))}</b><small>${esc(tVal.task)}</small></span></label>`).join(''):`<p class="muted">${t('आज कोणतीही तयारी नियोजित नाही.','No prep tasks planned for today.')}</p>`}
  </div>
  <div class="panel">
   <div class="panel-title">🛒 ${ui('खरेदी','Shopping')}</div>
   <div class="big-number">${buy}</div>
   <p>${t('खरेदी करायच्या वस्तू शिल्लक आहेत','items to buy remaining')}</p>
   <button class="primary" data-page="shopping">${t('खरेदी यादी उघडा →','Open shopping list →')}</button>
  </div>
  <div class="panel">
   <div class="panel-title">🌿 ${ui('आरोग्य मार्गदर्शन','Health Guide')}</div>
   <p>${t('तेल, मीठ, साखर, भाज्या, protein आणि food safety याबद्दल practical guidance.','Practical guidance for oil, salt, sugar, vegetables, protein, and food safety.')}</p>
   <button class="primary" data-page="health">${t('आरोग्य मार्गदर्शन पाहा →','View Health Guide →')}</button>
  </div>
 </div>`;
}

function calendar(){
 const month=selectedDate.slice(0,7);
 const dates=[...new Set(state.meals.filter(x=>x.date.startsWith(month)).map(x=>x.date))];
 return `${head(t('कॅलेंडर','CALENDAR'),t('३० दिवसांचे नियोजन','30-Day Meal Planning'),t('महिन्याच्या प्रत्येक दिवशी चार meal slots.','Four meal slots planned for each day of the month.'))}
 <div class="toolbar">
  <input id="month" type="month" value="${month}">
  <span>${dates.length} ${t('दिवस','days')} · ${dates.length*4} ${t('जेवण नोंदी','meal entries')}</span>
 </div>
 <div class="calendar-grid">${dates.map(d=>`<button class="calendar-day ${d===selectedDate?'selected':''}" data-select-date="${d}"><strong>${new Date(d+'T00:00:00').getDate()}</strong><span>${fmt(d)}</span><em>4 ${t('जेवण','meals')}</em></button>`).join('')}</div>
 <div class="selected-day"><h3>${dateLabel(selectedDate)}</h3>${state.meals.filter(x=>x.date===selectedDate).map(mealCard).join('')}</div>`;
}

function recipesView(){
 return `${head(t('पाककृती','RECIPES'),t('कसे बनवायचे?','How to cook?'),t('कुटुंबासाठी निवडलेल्या पाककृती — साहित्य, वेळ, प्रमाण आणि पोषण नोट्स.','Family recipes with ingredients, cooking time, portions, and nutrition notes.'))}
 <div class="search">
  <input id="recipeSearch" placeholder="${t('पाककृती शोधा...','Search recipes...')}">
  <button class="primary" data-add-recipe>+ ${t('नवीन पाककृती','Add recipe')}</button>
  <span id="recipeCount">${state.recipes.length} ${t('पाककृती','recipes')}</span>
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
   <span>💪 ${t('प्रथिने','Protein')} ${esc(r.protein||'—')}</span>
   <span>🌾 ${t('तंतू','Fibre')} ${esc(r.fibre||'—')}</span>
   <span>🫗 ${t('तेल','Oil')} ${esc(r.oil||'—')}</span>
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
  <button class="back" data-back>← ${t('मागे','Back')}</button>
  <div class="detail">
   <div class="detail-head">
    <div>
     <div class="kicker">${t('पाककृती','RECIPE')}</div>
     <h2>${esc(r.mr)}</h2>
     <p>${esc(r.name)}</p>
     <div class="recipe-tags">
      <span>${esc(r.mealCategory||r.course||'Meal')}</span>
      <span>${esc(r.mealRole||'main')}</span>
      <span>${r.dietaryFlags?.containsEgg?'🥚 '+t('अंडे','Egg'):'🌿 '+t('शाकाहारी','Vegetarian')}</span>
     </div>
     <div class="detail-actions">
      <button class="secondary" data-edit-recipe="${esc(r.id)}">✏️ ${t('संपादित करा','Edit recipe')}</button>
      <div class="recipe-tts-wrap">${ttsButtonHtml(`recipe-${r.id}`,mrSpeech,enSpeech,'recipe-tts-btn')}</div>
     </div>
    </div>
    <div class="hero-metrics">
     <b>${esc(r.time)}</b>
     <span>${esc(r.servings||4)} ${t('व्यक्ती','servings')}</span>
    </div>
   </div>
   <div class="detail-grid">
    <div>
     <h3>${t('साहित्य','Ingredients')}</h3>
     <ul>
      ${ingredients.map(x=>`<li>${typeof x==='string'?esc(x):`${esc(x.quantity)} ${esc(x.unit)} · ${esc(x.displayText||x.ingredientKey)}`}</li>`).join('')}
      ${legacy.map(x=>`<li class="legacy-ingredient">${esc(x)} <small>${t('जुना मजकूर · अजून normalize केलेला नाही','Legacy text · unmapped')}</small></li>`).join('')}
     </ul>
    </div>
    <div>
     <h3>${t('कृती पायऱ्या','Method Steps')}</h3>
     <ol>${(r.method||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
    </div>
   </div>
   <div class="metrics big">
    <span>💪 ${t('प्रथिने','Protein')} ${esc(r.protein||'—')}</span>
    <span>🌾 ${t('तंतू','Fibre')} ${esc(r.fibre||'—')}</span>
    <span>🫗 ${t('तेल','Oil')} ${esc(r.oil||'—')}</span>
   </div>
   ${education.length?`<div class="nutrition-education">
    <h3>${t('पोषण समजून घ्या','Nutrition explained')}</h3>
    ${education.map(e=>`<details><summary>${esc(t(e.marathiTitle,e.title))}</summary><p><b>${t('काय?','What:')}</b> ${esc(t(e.marathiWhat,e.what))}</p><p><b>${t('शरीरात कुठे?','Body use:')}</b> ${esc(t(e.marathiBodyUse,e.bodyUse))}</p><p><b>${t('काय करते?','Function:')}</b> ${esc(t(e.marathiFunction,e.function))}</p><p><b>${t('का आवश्यक?','Why it matters:')}</b> ${esc(t(e.marathiWhyItMatters,e.whyItMatters))}</p><p><b>${t('प्रमुख स्रोत:','Food sources:')}</b> ${esc(t(e.marathiFoodSources,e.foodSources))}</p></details>`).join('')}
   </div>`:''}
   ${r.note?`<div class="note"><b>${t('टीप','Notes')}</b><p>${esc(r.note)}</p></div>`:''}
  </div>
 </div>`;
}

function shopping(){
 const generated=buildShoppingFromAssignments(state.mealAssignments||[],state.recipes,state.recipeIngredients||[],state.ingredientCatalog||[]).map((x,i)=>({id:`derived-${x.canonicalKey}-${x.unit}-${i}`,item:x.name,mr:x.marathiName,category:(state.ingredientCatalog||[]).find(c=>c.canonicalKey===x.canonicalKey)?.category||'Meal-derived',quantity:`${x.quantity} ${x.unit}`,need:false,purchased:false,derived:true}));
 const manual=state.shopping||[];
 const rows=[...generated,...manual].map(x=>`<div class="shop-row ${x.purchased?'done':''} ${x.derived?'derived':''}"><input type="checkbox" data-purchased="${esc(x.id)}" ${x.purchased?'checked':''} ${x.derived?'disabled':''}><div><b>${esc(t(x.mr,x.item))}</b><small>${esc(x.item)} · ${esc(x.category)}${x.derived?' · '+t('जेवण नियोजन','Meal plan'):''}</small></div><strong>${esc(x.quantity)}</strong>${x.derived?`<span class="derived-pill">${t('नियोजनानुसार','From assignments')}</span>`:`<label class="buy-pill"><input type="checkbox" data-need="${x.id}" ${x.need?'checked':''}><span>${t('खरेदी करायची','Need to buy')}</span></label><button class="btn-delete" data-delete-shopping="${esc(x.id)}" title="${t('काढा','Delete')}">🗑️</button>`}</div>`).join('');
 return `${head(t('खरेदी','SHOPPING'),t('काय आणायचे?','What to buy?'),t('Meal assignments मधून generated quantities + तुमची manual list.','Quantities generated from meal assignments plus your manual list.'))}
 <div class="add-bar">
  <input id="newShopMr" placeholder="${t('मराठी नाव (उदा. पोहे)','Marathi name (e.g. Pohe)')}">
  <input id="newShopEn" placeholder="${t('English नाव (उदा. Poha)','English name (e.g. Poha)')}">
  <input id="newShopQty" placeholder="${t('प्रमाण (उदा. 1 kg)','Quantity (e.g. 1 kg)')}">
  <select id="newShopCat">
   <option value="Staples">${t('धान्य','Staples')}</option>
   <option value="Pulses & Legumes">${t('कडधान्ये','Pulses & Legumes')}</option>
   <option value="Dairy">${t('दुग्धजन्य','Dairy')}</option>
   <option value="Vegetables">${t('भाज्या','Vegetables')}</option>
   <option value="Fruits">${t('फळे','Fruits')}</option>
   <option value="Nuts & Seeds">${t('बिया आणि सुकामेवा','Nuts & Seeds')}</option>
   <option value="Spices">${t('मसाले','Spices')}</option>
   <option value="Other">${t('इतर','Other')}</option>
  </select>
  <button class="primary" data-add-shopping>+ ${t('जोडा','Add')}</button>
 </div>
 <div class="toolbar"><span>${manual.filter(x=>x.need&&!x.purchased).length} ${t('वस्तू खरेदी बाकी','items to buy')}</span></div>
 <div class="shopping-list">${rows||`<p class="muted">${t('खरेदी यादीत कोणतीही वस्तू नाही.','No shopping items.')}</p>`}</div>`;
}

function prepView(){
 return `${head(t('तयारी','PREP'),t('आधी काय करायचे?','What to prep ahead?'),t('Batch prep केल्याने weekday cooking सोपी होते.','Batch prep makes weekday cooking easy and stress-free.'))}
 <div class="add-bar">
  <input id="newPrepMr" placeholder="${t('तयारीचे नाव (मराठी)','Prep task (Marathi)')}">
  <input id="newPrepEn" placeholder="${t('Task name (English)','Task name (English)')}">
  <input id="newPrepDate" type="date" value="${selectedDate}">
  <select id="newPrepArea">
   <option value="Meal Prep">${t('जेवणाची तयारी','Meal Prep')}</option>
   <option value="Batter / Sprouting">${t('मोड आणणे / पीठ भिजवणे','Batter / Sprouting')}</option>
   <option value="Storage">${t('साठवणूक','Storage')}</option>
   <option value="Shopping">${t('खरेदी','Shopping')}</option>
   <option value="Review">${t('आढावा','Review')}</option>
  </select>
  <button class="primary" data-add-prep>+ ${t('जोडा','Add')}</button>
 </div>
 <div class="prep-list">${state.prep.map(tVal=>`<div class="prep-row ${tVal.done?'done':''}"><input type="checkbox" data-prep="${tVal.id}" ${tVal.done?'checked':''}><div><b>${esc(t(tVal.mr,tVal.task))}</b><small>${esc(tVal.task)}</small></div><span>${fmt(tVal.date)}</span><em>${esc(tVal.area)}</em><button class="btn-delete" data-delete-prep="${esc(tVal.id)}" title="${t('काढा','Delete')}">🗑️</button></div>`).join('')}</div>`;
}

function familyView(){
 return `${head(t('कुटुंब','FAMILY'),t('कुटुंबातील सदस्य','Family Profiles'),t('ही माहिती पोषण संदर्भासाठी आहे; medical prescription नाही.','This information is for household nutritional context; not a clinical prescription.'))}
 <div class="family-grid">${state.members.map(m=>`<article class="person-card">
  <div class="avatar">${esc(m.name[0])}</div>
  <h3>${esc(t(m.mr,m.name))}</h3>
  <p>${esc(m.name)} · ${esc(m.age)} ${t('वर्षे','years')}</p>
  <div class="person-stats"><span>${esc(m.weight)} kg</span><span>${esc(m.height)} cm</span></div>
  <b>${esc(m.activity)}</b>
  <p class="muted">${esc(m.note)}</p>
 </article>`).join('')}</div>`;
}

function nutritionEducationCard(e){
 const mrSpeech=`${e.marathiTitle}. काय आहे: ${e.marathiWhat}. शरीरात कुठे: ${e.marathiBodyUse}. काय करते: ${e.marathiFunction}. का आवश्यक: ${e.marathiWhyItMatters}. प्रमुख अन्न स्रोत: ${e.marathiFoodSources}.`;
 const enSpeech=`${e.title}. What is it: ${e.what}. Where in the body: ${e.bodyUse}. What does it do: ${e.function}. Why does it matter: ${e.whyItMatters}. Food sources: ${e.foodSources}.`;
 return `<article class="nutrition-class-card" data-nutrition-concept="${esc(e.id)}">
  <div class="nutrition-class-icon">🧠</div>
  <div class="nutrition-class-head">
   <div>
    <span class="health-category">${t('पोषण','Nutrition')}</span>
    <h3>${esc(e.marathiTitle)}</h3>
    <p>${esc(e.title)}</p>
   </div>
   ${ttsButtonHtml(`nutrition-${e.id}`,mrSpeech,enSpeech,'nutrition-tts-btn')}
  </div>
  <div class="nutrition-facts">
   <section><b>${t('काय आहे?','What is it?')}</b><p>${esc(t(e.marathiWhat,e.what))}</p><small>${esc(e.what)}</small></section>
   <section><b>${t('शरीरात कुठे वापर?','Where in the body?')}</b><p>${esc(t(e.marathiBodyUse,e.bodyUse))}</p><small>${esc(e.bodyUse)}</small></section>
   <section><b>${t('काय करते?','What does it do?')}</b><p>${esc(t(e.marathiFunction,e.function))}</p><small>${esc(e.function)}</small></section>
   <section><b>${t('का आवश्यक?','Why does it matter?')}</b><p>${esc(t(e.marathiWhyItMatters,e.whyItMatters))}</p><small>${esc(e.whyItMatters)}</small></section>
   <section class="food-sources"><b>${t('अन्न स्रोत','Food sources')}</b><p>${esc(t(e.marathiFoodSources,e.foodSources))}</p><small>${esc(e.foodSources)}</small></section>
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
    <span class="learning-kicker">🥗 ${ui('आज आपण काय खातोय?','What foods are we eating?')}</span>
    <h3>${ui('अन्नापासून पोषणाकडे','From food to nutrition')}</h3>
    <p>${ui('आजच्या recipes मधील प्रमुख पदार्थ आणि त्यांचा nutrition context.','Key foods from today’s recipes and their nutrition context.')}</p>
   </div>
  </div>
  <div class="food-chip-grid">${foods.map(f=>`<span class="food-chip"><b>${esc(t(f.mr,f.name))}</b><small>${esc(f.name)} · ${esc(f.category)}</small></span>`).join('')||`<p class="muted">${ui('आजचे food details अजून उपलब्ध नाहीत.','Food details are not available yet.')}</p>`}</div>
 </section>`;
}

function healthView(){
 const cats=[...new Set((state.healthTips||[]).map(x=>x.category))];
 const education=(state.nutritionEducation||[]).slice().sort((a,b)=>Number(a.sortOrder??999)-Number(b.sortOrder??999));
 return `${head(t('आरोग्य मार्गदर्शक','HEALTH GUIDE'),t('आरोग्य मार्गदर्शन','Practical Health Guidance'),t('कुटुंबाच्या रोजच्या निर्णयांसाठी practical guidance. हे general information आहे; medical prescription नाही.','Practical guidance for daily household food decisions. General reference, not a medical prescription.'))}
 <div class="health-notice">🌿 <b>${t('सोपा नियम:','Simple rule:')}</b> ${t('आवश्यकता, समतोल, संयम आणि विविधता. खाली दिलेली आकडेवारी सामान्य मार्गदर्शक आहे, वैयक्तिक वैद्यकीय टार्गेट नाही.','adequacy, balance, moderation and variety. Values below are general references, not individual medical targets.')}</div>
 <div class="health-filter">
  <button class="secondary health-filter-btn active" data-health-category="all">${t('सर्व','All')}</button>
  ${cats.map(c=>`<button class="secondary health-filter-btn" data-health-category="${esc(c)}">${esc(c)}</button>`).join('')}
 </div>
 <div id="healthGrid" class="health-grid">${(state.healthTips||[]).map(tVal=>healthTipCard(tVal)).join('')}</div>
 ${education.length?`<section class="nutrition-learning">
  <div class="section-head nutrition-section-head">
   <div>
    <div class="kicker">${t('पोषण वर्ग','NUTRITION CLASSROOM')}</div>
    <h2>${t('पोषण समजून घ्या','Understand nutrition')}</h2>
    <p>${t('आपण खात असलेल्या अन्नातून शरीराला काय मिळते, ते काय करते आणि का आवश्यक आहे.','What nutrients each food provides, what they do, and why they matter.')}</p>
   </div>
  </div>
  <div class="nutrition-class-grid">${education.map(e=>nutritionEducationCard(e)).join('')}</div>
 </section>`:''}
 <div class="target-grid health-targets">${targetCards()}</div>
 <div class="source-note">${t('आरोग्य संदर्भ WHO आणि सार्वजनिक आरोग्य मार्गदर्शनातून घेतले आहेत.','Health references are sourced from WHO public-health guidance and are stored with the content record.')}</div>`;
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
  nutritionEducation: sourceState.nutritionEducation||[]
 };
}

function settings(){
 const s=state.householdSettings||starter.householdSettings;
 return `${head(t('सेटिंग्ज','SETTINGS'),t('डेटा आणि पर्याय','Data & Appearance'),t('Shared household settings cloud मध्ये; theme या device वर जतन होतो.','Shared household settings sync to the cloud; preferences save to this device.'))}
 <div class="settings-grid">
  <div class="panel">
   <h3>🌗 ${t('थीम','Theme')}</h3>
   <p>${t('प्रत्येक device वर Light, Dark किंवा System निवडा.','Select Light, Dark, or System mode for this device.')}</p>
   <div class="theme-switcher">${['light','dark','system'].map(x=>`<button class="${theme===x?'active':''}" data-theme="${x}">${x==='light'?'☀️ Light':x==='dark'?'🌙 Dark':'🖥️ System'}</button>`).join('')}</div>
  </div>
  <div class="panel preference-panel">
   <div class="preference-heading">
    <div>
     <h3>🌐 Language / भाषा</h3>
     <p>${t('मराठी, English किंवा दोन्ही निवडा.','Choose Marathi, English, or Bilingual mode.')}</p>
    </div>
    <span class="preference-icon">अA</span>
   </div>
   <div class="language-switcher">${[['mr','मराठी'],['en','English'],['both','मराठी + English']].map(([x,label])=>`<button class="${language===x?'active':''}" data-language="${x}">${label}</button>`).join('')}</div>
  </div>
  <div class="panel">
   <h3>🫗 ${t('तेल नियोजन','Oil planning')}</h3>
   <p>${t('Stock आणि monthly planning target वेगळे ठेवा. हा household planning tool आहे; medical limit नाही.','Keep stock and monthly target separate. This is a household tool, not a clinical limit.')}</p>
   <label class="field"><span>${t('सध्याचा साठा (ml)','Current stock (ml)')}</span><input id="oilStock" type="number" min="0" step="100" value="${esc(s.oilStockMl)}"></label>
   <label class="field"><span>${t('मासिक टार्गेट (ml)','Monthly target (ml)')}</span><input id="oilTarget" type="number" min="100" step="100" value="${esc(s.oilMonthlyTargetMl)}"></label>
   <label class="field"><span>${t('कुटुंबातील व्यक्ती संख्या','Household size')}</span><input id="householdSize" type="number" min="1" max="20" step="1" value="${esc(s.householdSize)}"></label>
   <div class="oil-advice"><b>${t('कुठे कमी करायचे?','Where to moderate?')}</b><p>${t('डीप-फ्राय, जास्त तेलाचा तडका आणि खूप तेलकट gravy आधी कमी करा. मोजून तेल वापरा; योग्य ठिकाणी भाजणे, वाफवणे किंवा pressure cooking वापरा.','Reduce deep frying, heavy tadka, and oily gravies. Measure oil, and prefer steaming, roasting, or pressure cooking.')}</p></div>
   <button class="primary" data-save-settings>${t('Settings जतन करा','Save settings')}</button>
  </div>
  <div class="panel">
   <h3>🧀 ${t('घरगुती नियोजन प्राधान्ये','Household Planning Preferences')}</h3>
   <p>${t('पनीर मासिक वारंवारता मर्यादा (घरगुती नियोजन प्राधान्य, वैद्यकीय सल्ला नाही).','Paneer monthly frequency limit (household planning preference, not medical advice).')}</p>
   <div class="frequency-status-box">
    <div class="frequency-status-row">
     <span><b>${t('पनीर वापर (या महिन्यात):','Paneer planned (this month):')}</b></span>
     <strong>${countIngredientMonthlyOccurrences({assignments:state.mealAssignments,recipes:state.recipes,meals:state.meals,ingredientKey:'paneer',month:selectedDate.slice(0,7)})} / 5 ${t('जेवण','meals')}</strong>
    </div>
    <small class="muted">${t('कॅलेंडर महिन्यात जास्तीत जास्त ५ वेळा पनीरचे जेवण. मर्यादा संपल्यावर इतर शाकाहारी पर्यायांना प्राधान्य दिले जाते.','Maximum 5 paneer meals per calendar month. When reached, other vegetarian alternates are preferred.')}</small>
   </div>
  </div>
  <div class="panel">
   <h3>💾 ${t('बॅकअप','Backup')}</h3>
   <p>${t('दर काही दिवसांनी JSON backup डाउनलोड करा. नवीन फोनवर Import करून data परत आणता येईल.','Download JSON backup regularly. Restore on any new device.')}</p>
   <button class="primary" data-export>⬇ ${t('Backup डाउनलोड','Export Backup')}</button>
   <label class="secondary upload">⬆ ${t('Backup Import','Import Backup')}<input id="importFile" type="file" accept="application/json"></label>
  </div>
  <div class="panel">
   <h3>☁️ ${t('क्लाउड जतन','Cloud sync')}</h3>
   <p>${t('Login/OTP लागत नाही. प्रत्येक device ला anonymous session मिळतो आणि shared household data Supabase मध्ये sync होतो.','No login/OTP required. Each device receives an anonymous session and shared household data syncs to Supabase.')}</p>
   <p class="muted">${t('Health content Supabase मधून येतो; content बदलण्यासाठी frontend code बदलण्याची गरज नाही.','Health content comes from Supabase; content updates require no code changes.')}</p>
  </div>
  <div class="panel">
   <h3>↺ ${t('सुरुवातीचा डेटा','Starter data')}</h3>
   <p>${t('Starter calendar, recipes, shopping आणि prep पुन्हा आणा. Local edits replace होतील.','Restore starter calendar, recipes, shopping, and prep. Replaces local changes.')}</p>
   <button class="danger" data-reset>${t('डेटा रीसेट करा','Reset starter data')}</button>
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
    <h3>${r ? t('पाककृती संपादित करा','Edit Recipe') : t('नवीन पाककृती जोडा','Add Recipe')}</h3>
    <button class="btn-delete" data-close-recipe-modal title="${t('बंद करा','Close')}">✕</button>
   </div>
   <div class="form-grid">
    <div>
     <label>${t('पाककृतीचे मराठी नाव *','Marathi Name *')}</label>
     <input id="recipeFormMr" placeholder="${t('उदा. मूग भाजी चिल्ला','e.g. Moong Bhaji Chilla')}" value="${esc(r?.mr || '')}">
    </div>
    <div>
     <label>${t('English नाव *','English Name *')}</label>
     <input id="recipeFormName" placeholder="e.g. Moong Vegetable Chilla" value="${esc(r?.name || '')}">
    </div>
    <div>
     <label>${t('वर्ग','Meal Category')}</label>
     <select id="recipeFormCourse">
      ${['Breakfast','Lunch','Snack','Dinner','Lunch/Dinner'].map(c => `<option value="${c}" ${(r?.course === c || r?.mealCategory === c) ? 'selected' : ''}>${c}</option>`).join('')}
     </select>
    </div>
    <div>
     <label>${t('भूमिका','Meal Role')}</label>
     <select id="recipeFormRole">
      <option value="main" ${r?.mealRole === 'main' ? 'selected' : ''}>${t('मुख्य पदार्थ','Main')}</option>
      <option value="snack" ${r?.mealRole === 'snack' ? 'selected' : ''}>${t('अल्पोपहार','Snack')}</option>
      <option value="side" ${r?.mealRole === 'side' ? 'selected' : ''}>${t('पूरक पदार्थ','Side')}</option>
     </select>
    </div>
    <div>
     <label>${t('वेळ','Time')}</label>
     <input id="recipeFormTime" placeholder="20 min" value="${esc(r?.time || '20 min')}">
    </div>
    <div>
     <label>${t('व्यक्ती','Servings')}</label>
     <input id="recipeFormServings" type="number" min="1" max="20" value="${esc(r?.servings || 4)}">
    </div>
    <div class="full-width">
     <label>${t('बनवण्याची पद्धत','Cooking Method')}</label>
     <input id="recipeFormCookingMethod" placeholder="Stovetop / Pan / Pressure cook" value="${esc(r?.cookingMethod || 'Stovetop')}">
    </div>
    <div class="full-width">
     <label>${t('साहित्य (प्रत्येक ओळीवर एक) *','Ingredients (one per line) *')}</label>
     <textarea id="recipeFormIngredients" rows="5" placeholder="200 g moong dal&#10;100 g vegetables&#10;10 ml oil">${esc(ingLines)}</textarea>
    </div>
    <div class="full-width">
     <label>${t('कृती पायऱ्या (प्रत्येक ओळीवर एक)','Method Steps (one per line)')}</label>
     <textarea id="recipeFormMethod" rows="4" placeholder="Blend soaked moong.&#10;Cook on tawa with measured oil.">${esc(methodLines)}</textarea>
    </div>
    <div class="full-width">
     <label>${t('नोंद','Notes')}</label>
     <input id="recipeFormNote" placeholder="${t('उदा. दही किंवा कोशिंबीर सोबत सर्व्ह करा.','e.g. Serve with curd or salad.')}" value="${esc(r?.note || '')}">
    </div>
   </div>
   <div class="modal-actions">
    <button class="secondary" data-close-recipe-modal>${t('रद्द करा','Cancel')}</button>
    <button class="primary" data-save-recipe>${t('जतन करा','Save')}</button>
   </div>
  </div>
 </div>`;
}

function render(){
 const nav=[
  ['today','🏠',t('आज','Today')],
  ['calendar','📅',t('कॅलेंडर','Calendar')],
  ['recipes','🍳',t('पाककृती','Recipes')],
  ['health','🌿',t('आरोग्य','Health')],
  ['shopping','🛒',t('खरेदी','Shopping')],
  ['prep','🔪',t('तयारी','Prep')],
  ['family','👨‍👩‍👦',t('कुटुंब','Family')],
  ['settings','⚙️',t('सेटिंग्ज','Settings')]
 ];
 let body=selectedRecipe?detail(selectedRecipe):page==='today'?today():page==='calendar'?calendar():page==='recipes'?recipesView():page==='health'?healthView():page==='shopping'?shopping():page==='prep'?prepView():page==='family'?familyView():settings();
 const modal=showRecipeModal?recipeModalHtml():'';
 document.getElementById('app').innerHTML=`<header class="topbar">
  <div>
   <div class="eyebrow">${t('कुटुंबाचे पोषण','FAMILY NUTRITION')}</div>
   <h1>🍛 ${t('कुटुंब भोजन','Kutumb Bhojan')} <span>${language==='both'?'Kutumb Bhojan':''}</span></h1>
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
    <strong>${t('सोपे कौटुंबिक जेवण','Simple Family Meals')}</strong>
    <small>${t('कुटुंबाची पोषण नियोजन पद्धत','Family meal planning system')}</small>
   </div>
   ${nav.map(n=>`<button class="nav ${page===n[0]?'active':''}" data-page="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join('')}
   <div class="sidebar-note">
    <b>${t('आजचे चार प्रश्न','Four Daily Questions')}</b><br>
    ${t('काय बनवायचे?','What to cook?')} → ${t('कॅलेंडर','Calendar')}<br>
    ${t('कसे बनवायचे?','How to cook?')} → ${t('पाककृती','Recipes')}<br>
    ${t('काय आणायचे?','What to buy?')} → ${t('खरेदी','Shopping')}<br>
    ${t('आधी काय करायचे?','What to prep?')} → ${t('तयारी','Prep')}<br>
    ${t('आरोग्य कसे सुधारायचे?','How to improve health?')} → ${t('आरोग्य','Health')}
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
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{tts.stop();page=b.dataset.page;selectedRecipe=null;render()});
 const date=document.getElementById('date');if(date)date.onchange=()=>{selectedDate=date.value;render()};
 document.querySelector('[data-day="prev"]')?.addEventListener('click',()=>shiftDay(-1));
 document.querySelector('[data-day="next"]')?.addEventListener('click',()=>shiftDay(1));
 document.getElementById('month')?.addEventListener('change',e=>{selectedDate=e.target.value+'-01';render()});
 document.querySelectorAll('[data-select-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.selectDate;render()});
 document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{const r=findRecipe(b.dataset.recipe);if(r){tts.stop();selectedRecipe=r;render()}else toast(t('पाककृती तपशील लवकरच उपलब्ध होईल','Recipe detail coming soon'))});
 document.querySelectorAll('[data-recipe-id]').forEach(b=>b.onclick=()=>{tts.stop();selectedRecipe=state.recipes.find(r=>r.id===b.dataset.recipeId);render()});
 document.querySelector('[data-back]')?.addEventListener('click',()=>{tts.stop();selectedRecipe=null;render()});

 // Recipe Add / Edit
 document.querySelector('[data-add-recipe]')?.addEventListener('click',()=>{editingRecipe=null;showRecipeModal=true;render()});
 document.querySelectorAll('[data-edit-recipe]').forEach(b=>b.onclick=()=>{const r=state.recipes.find(x=>x.id===b.dataset.editRecipe);if(r){editingRecipe=r;showRecipeModal=true;render()}});
 document.querySelectorAll('[data-close-recipe-modal]').forEach(b=>b.onclick=()=>{showRecipeModal=false;editingRecipe=null;render()});
 document.querySelector('[data-save-recipe]')?.addEventListener('click',async()=>{
  const name=(document.getElementById('recipeFormName')?.value||'').trim();
  const mrName=(document.getElementById('recipeFormMr')?.value||'').trim();
  if(!name||!mrName){toast(t('नाव आवश्यक आहे','Recipe name is required'));return;}
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
  toast(t('पाककृती जतन झाली','Recipe saved'));
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
  toast(t('वेळापत्रक बदलले','Meal updated'));
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
  if(!mrName&&!enName){toast(t('नाव आवश्यक आहे','Item name is required'));return;}
  const id='manual_'+Date.now();
  state.shopping.unshift({id,item:enName||mrName,mr:mrName||enName,category:cat,quantity:qty,need:true,purchased:false});
  await save();
  render();
  toast(t('खरेदी यादीत जोडले','Added to shopping'));
 });
 document.querySelectorAll('[data-delete-shopping]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.deleteShopping;
  state.shopping=(state.shopping||[]).filter(x=>x.id!==id);
  if(remoteReady&&remoteHouseholdId){
   try{await supabase.from('shopping_items').delete().eq('household_id',remoteHouseholdId).eq('item_key',id);}catch(e){console.warn(e);}
  }
  await save();
  render();
  toast(t('वस्तू काढली','Item removed'));
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
  if(!mrName&&!enName){toast(t('तयारीचे नाव आवश्यक आहे','Prep task is required'));return;}
  const id='prep_'+Date.now();
  state.prep.unshift({id,task:enName||mrName,mr:mrName||enName,date:dateVal,area:areaVal,done:false});
  await save();
  render();
  toast(t('तयारी जोडली','Prep task added'));
 });
 document.querySelectorAll('[data-delete-prep]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.deletePrep;
  state.prep=(state.prep||[]).filter(x=>x.id!==id);
  if(remoteReady&&remoteHouseholdId){
   try{await supabase.from('prep_tasks').delete().eq('household_id',remoteHouseholdId).eq('task_key',id);}catch(e){console.warn(e);}
  }
  await save();
  render();
  toast(t('तयारी काढली','Prep task removed'));
 });

 document.querySelectorAll('[data-prep]').forEach(i=>i.onchange=()=>{const x=state.prep.find(tVal=>tVal.id===i.dataset.prep);if(x){x.done=i.checked;save();render()}});
 document.querySelectorAll('[data-purchased]').forEach(i=>i.onchange=()=>{const x=state.shopping.find(tVal=>tVal.id===i.dataset.purchased);if(x){x.purchased=i.checked;save();render()}});
 document.querySelectorAll('[data-need]').forEach(i=>i.onchange=()=>{const x=state.shopping.find(tVal=>tVal.id===i.dataset.need);if(x){x.need=i.checked;save();render()}});
 document.getElementById('recipeSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();const list=state.recipes.filter(r=>`${r.name} ${r.mr} ${r.course}`.toLowerCase().includes(q));document.getElementById('recipeGrid').innerHTML=list.map(recipeCard).join('');document.getElementById('recipeCount').textContent=`${list.length} ${t('पाककृती','recipes')}`;bind()});
 document.querySelectorAll('[data-health-category]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-health-category]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const q=b.dataset.healthCategory;document.getElementById('healthGrid').innerHTML=(state.healthTips||[]).filter(tVal=>q==='all'||tVal.category===q).map(healthTipCard).join('')});
 document.querySelectorAll('[data-change-assignment]').forEach(sel=>sel.onchange=async e=>{const mealId=e.target.dataset.changeAssignment,memberId=e.target.dataset.memberId;state.mealAssignments=applyDayLevelOverride(state.mealAssignments,memberId,e.target.value,mealId);await save();render()});
 document.querySelectorAll('[data-revert-assignment]').forEach(b=>b.onclick=async()=>{state.mealAssignments=revertDayLevelOverride(state.mealAssignments,b.dataset.memberId,b.dataset.revertAssignment);await save();render()});
 document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
 document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>setLanguage(b.dataset.language));
 document.querySelectorAll('[data-tts-key]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();const key=b.dataset.ttsKey;if(tts.getCurrentKey()===key&&tts.isSpeaking()){tts.stop();}else{tts.speak({key,mrText:b.dataset.ttsMr,enText:b.dataset.ttsEn,language});}});
 document.querySelector('[data-save-settings]')?.addEventListener('click',async()=>{const s=state.householdSettings||clone(starter.householdSettings);s.oilStockMl=Math.max(0,Number(document.getElementById('oilStock').value)||0);s.oilMonthlyTargetMl=Math.max(100,Number(document.getElementById('oilTarget').value)||3000);s.householdSize=Math.min(20,Math.max(1,Number(document.getElementById('householdSize').value)||4));state.householdSettings=s;localStorage.setItem(STORAGE,JSON.stringify(state));const ok=await saveHouseholdSettings();if(ok)toast(t('घरची settings जतन झाली','Household settings saved'));render()});
 document.querySelector('[data-export]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(buildBackupPayload(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kutumb-bhojan-backup-${new Date().toISOString().slice(0,10)}.json`;a.click()});
 document.getElementById('importFile')?.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{const x=JSON.parse(r.result);if(x.version!==1&&x.version!==2)throw new Error('Invalid version');state={...clone(starter),...x,version:2};state.recipes=(state.recipes||[]).map(rec=>buildStructuredRecipe(rec,state.recipeIngredients||[],state.ingredientCatalog||[]));ensureAutomaticAssignments();localStorage.setItem(STORAGE,JSON.stringify(state));if(remoteReady){await saveHouseholdSettings();await syncLocalChanges();await syncPhase2();}render();toast(t('बॅकअप परत आला','Backup restored'))}catch(err){console.warn('Import error',err);toast(t('चुकीची बॅकअप फाइल','Invalid backup file'))}};r.readAsText(file)});
 document.querySelector('[data-reset]')?.addEventListener('click',()=>{if(confirm(t('सर्व स्थानिक बदल काढायचे?','Reset local changes?'))){state=clone(starter);state.recipes=state.recipes.map(r=>buildStructuredRecipe(r,[],[]));ensureAutomaticAssignments();save();if(remoteReady)saveHouseholdSettings();render()}});
}

tts.onStateChange(({ key, isSpeaking })=>{
 document.querySelectorAll('[data-tts-key]').forEach(btn=>{
  const active=isSpeaking && btn.dataset.ttsKey===key;
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active?'true':'false');
  const ariaLabel=active
   ? (language==='mr'?'थांबवा':language==='en'?'Stop':'थांबवा / Stop')
   : (language==='mr'?'ऐका':language==='en'?'Listen':'ऐका / Listen');
  btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML=ttsButtonLabel(active, language);
 });
});

function shiftDay(delta){const d=new Date(selectedDate+'T00:00:00');d.setUTCDate(d.getUTCDate()+delta);selectedDate=d.toISOString().slice(0,10);render()}
applyTheme();
applyLanguage();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(err=>console.warn('service worker unavailable',err)));}
ensureAutomaticAssignments();
render();
initCloud();
