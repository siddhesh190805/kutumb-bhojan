const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const source=fs.readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');

const expectedMeals=[
'Moong vegetable chilla + curd','Moong-paneer chilla','Lobia curry + roti + bhindi + guava','Roasted chana + guava','Paneer vegetable curry + roti + cucumber',
'Chana usal + jowar bhakri + cabbage-carrot koshimbir','Tofu bhurji + roti + tomato-cucumber','Vegetable uttapam + sambar','Rajma rice + cucumber-onion','Buttermilk + roasted chana',
'Jowar bhakri + matki usal + cauliflower','Egg bhurji + roti','Mixed bean curry + roti + dudhi','Paneer chaat + pomegranate','Vegetable moong khichdi + curd + carrot-cucumber',
'Besan-paneer chilla','Chole + roti + cabbage-peas + apple','Milk + banana + peanut powder','Palak paneer + roti + cucumber','Handvo + curd',
'Bharli vangi + jowar bhakri + curd + cucumber','Chana chaat + mosambi','Soy-paneer keema + roti + cabbage','Methi dashmi + curd + banana','Matki misal + pav + cucumber-onion',
'Curd + papaya + flax','Paneer vegetable tikka + roti + tomato-cucumber','Peanuts + banana','Paneer bhurji + roti + spinach','Ragi dosa + sambar',
'Chana usal + roti + cauliflower-carrot','Sprouted moong chaat','Egg bhurji + roti + dudhi','Vegetable poha + peanuts + curd','Rajma rice + cucumber + papaya',
'Pesarattu + peanut chutney','Mixed bean curry + roti + cabbage-carrot','Tofu vegetable curry + roti + cucumber','Besan vegetable chilla + curd','Chole + roti + bhindi + apple',
'Mixed-dal adai + tomato chutney','Bharli vangi + jowar bhakri + curd','Protein thalipeeth + curd','Sprouts poha + curd','Chana usal + jowar bhakri + dudhi',
'Curd + banana + pumpkin seeds','Tofu bhurji + roti + cucumber-tomato','Rajma rice + cabbage-carrot','Sprouted moong chaat + cucumber','Egg bhurji + roti + bhindi',
'Mixed bean curry + roti + dudhi + apple','Chole + roti + cauliflower-carrot + papaya','Roasted chana + banana','Soy-paneer keema + roti + cabbage salad','Matki usal + jowar bhakri + cabbage-carrot koshimbir'
];

test('every calendar meal has an exact recipe record',()=>{
  for(const meal of expectedMeals){
    assert.ok(source.includes(`['${meal}',`),`Missing recipe: ${meal}`);
  }
});

test('recipe lookup does not use unrelated fallback dishes',()=>{
  const fn=source.match(/function findRecipe\(title\)\{(.*?)\n\}/s)?.[1]||'';
  assert.doesNotMatch(fn,/Matki Usal.*Tofu|Matki Usal.*Soy|Protein Thalipeeth.*Handvo/);
  assert.doesNotMatch(fn,/wanted=exact\[title\]\|\|title/);
});

test('recipe library keeps Pithla excluded and recipe names bilingual',()=>{
  assert.doesNotMatch(source,/Pithla|पिठलं/);
  const rows=[...source.matchAll(/^\['([^']+)','([^']+)','(?:Breakfast|Lunch\/Dinner|Snack|Breakfast\/Dinner)'/gm)];
  assert.ok(rows.length>=50);
  for(const [,name,mr] of rows){assert.ok(/[\u0900-\u097F]/.test(mr),`Missing Marathi name for ${name}`)}
});
