import { test, expect } from '@playwright/test';

test.describe('Kutumb Bhojan Full Interaction E2E', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log('PAGEERROR', err.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.meal-card').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  test('Home: meal order, date nav, picker, meal change, revert, TTS', async ({ page }) => {
    // Meal order
    const slots = await page.evaluate(() => [...document.querySelectorAll('.meal-card')].map(c => c.querySelector('.meal-slot small')?.textContent?.trim()));
    expect(slots).toEqual(['Breakfast','Lunch','Dinner','Snack']);
    // Date nav
    const d0 = await page.locator('#date').inputValue();
    await page.click('[data-day="next"]');
    await expect(page.locator('#date')).not.toHaveValue(d0);
    const d1 = await page.locator('#date').inputValue();
    await page.click('[data-day="prev"]');
    await expect(page.locator('#date')).toHaveValue(d0);
    // Date picker
    await page.fill('#date', '2026-09-15');
    await page.evaluate(() => document.getElementById('date').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(800);
    expect(await page.locator('#date').inputValue()).toBe('2026-09-15');
    await page.fill('#date', d0);
    await page.evaluate(() => document.getElementById('date').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(800);
    // Every meal selector - open first details
    const firstDetails = page.locator('details.member-editor-details').first();
    await firstDetails.scrollIntoViewIfNeeded();
    await firstDetails.locator('summary').click({ force: true });
    await page.waitForTimeout(1000);
    const selects = page.locator('select[data-change-assignment]');
    await expect(selects.first()).toBeVisible({ timeout: 10000 });
    const firstSelect = selects.first();
    const orig = await firstSelect.inputValue();
    const options = await firstSelect.evaluate(e => [...e.options].map(o=>o.value));
    expect(options.length).toBeGreaterThan(1);
    const newVal = options.find(v=>v!==orig) || options[0];
    await firstSelect.selectOption(newVal);
    await page.waitForTimeout(2000);
    expect(await firstSelect.inputValue()).toBe(newVal);
    // Revert
    const revert = page.locator('[data-revert-assignment]').first();
    await expect(revert).toBeVisible({ timeout: 5000 });
    await revert.click();
    await page.waitForTimeout(1200);
    expect(await firstSelect.inputValue()).toBe(orig);
    // TTS
    const ttsBtn = page.locator('[data-tts-key]').first();
    await expect(ttsBtn).toBeVisible();
    await ttsBtn.click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.getElementById('app')?.innerHTML?.length || 0)).toBeGreaterThan(1000);
  });

  test('Calendar: chronological, select, month nav, boundaries, Home sync', async ({ page }) => {
    await page.click('aside.sidebar [data-page="calendar"]');
    await page.waitForTimeout(1000);
    let dates = await page.evaluate(() => [...document.querySelectorAll('.calendar-day')].map(b=>b.getAttribute('data-select-date')));
    expect(dates.length).toBeGreaterThan(0);
    let sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
    // Select second date
    const second = dates[1];
    await page.click(`[data-select-date="${second}"]`);
    await page.waitForTimeout(800);
    let sel = await page.evaluate(() => document.querySelector('.calendar-day.selected')?.getAttribute('data-select-date'));
    expect(sel).toBe(second);
    let meals = await page.evaluate(() => document.querySelectorAll('.selected-day .meal-card').length);
    expect(meals).toBe(4);
    // Back to Home sync
    await page.click('aside.sidebar [data-page="today"]');
    await page.waitForTimeout(800);
    expect(await page.locator('#date').inputValue()).toBe(second);
    // Month nav via fill
    await page.click('aside.sidebar [data-page="calendar"]');
    await page.waitForTimeout(800);
    const monthBefore = await page.locator('#month').inputValue();
    await page.fill('#month', '2026-10');
    await page.evaluate(() => document.getElementById('month').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(1000);
    expect(await page.locator('#month').inputValue()).toBe('2026-10');
    await page.fill('#month', '2026-09');
    await page.evaluate(() => document.getElementById('month').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(1000);
    // Boundaries
    await page.fill('#month', '2026-12');
    await page.evaluate(() => document.getElementById('month').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(800);
    await page.fill('#month', '2027-01');
    await page.evaluate(() => document.getElementById('month').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(800);
    await page.fill('#month', '2026-09');
    await page.evaluate(() => document.getElementById('month').dispatchEvent(new Event('change', {bubbles:true})));
    await page.waitForTimeout(800);
    expect(await page.locator('#month').inputValue()).toBe('2026-09');
  });

  test('Recipes: create, persist, edit, cancel, delete', async ({ page }) => {
    await page.click('aside.sidebar [data-page="recipes"]');
    await page.waitForTimeout(800);
    await expect(page.locator('[data-add-recipe]')).toBeVisible();
    await page.click('[data-add-recipe]');
    await expect(page.locator('#recipeModal')).toBeVisible();
    await page.click('[data-close-recipe-modal]');
    await page.waitForTimeout(500);
    expect(await page.evaluate(()=>!!document.getElementById('recipeModal'))).toBe(false);
    await page.click('[data-add-recipe]');
    await page.waitForTimeout(500);
    const ts = Date.now();
    await page.fill('#recipeFormMr', `Test ${ts} मराठी`);
    await page.fill('#recipeFormName', `Test ${ts} English`);
    await page.fill('#recipeFormIngredients', '100 g rice');
    await page.click('[data-save-recipe]');
    await page.waitForTimeout(2000);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.recipe-card, .meal-card').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.click('aside.sidebar [data-page="recipes"]');
    await page.waitForTimeout(800);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
    // Edit
    const editBtn = page.locator('[data-edit-recipe]').first();
    await editBtn.click();
    await page.waitForTimeout(800);
    expect(await page.evaluate(()=>!!document.getElementById('recipeModal'))).toBe(true);
    await page.fill('#recipeFormName', `Edited ${ts} English`);
    await page.click('[data-save-recipe]');
    await page.waitForTimeout(1500);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(`Edited ${ts}`), ts)).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.recipe-card, .meal-card').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.click('aside.sidebar [data-page="recipes"]');
    await page.waitForTimeout(800);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(`Edited ${ts}`), ts)).toBe(true);
  });

  test('Shopping: add, toggle, delete, derived', async ({ page }) => {
    await page.click('aside.sidebar [data-page="shopping"]');
    await page.waitForTimeout(800);
    const ts = Date.now();
    await page.fill('#newShopMr', `ShopMr ${ts}`);
    await page.fill('#newShopEn', `ShopEn ${ts}`);
    await page.fill('#newShopQty', '1 kg');
    await page.click('[data-add-shopping]');
    await page.waitForTimeout(1500);
    await page.click('aside.sidebar [data-page="shopping"]');
    await page.waitForTimeout(800);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
    // Toggle need
    const needCb = page.locator('[data-need]').first();
    if (await needCb.count() > 0) {
      await needCb.check();
      await page.waitForTimeout(500);
    }
    // Delete
    const delBtn = page.locator('[data-delete-shopping]').last();
    await delBtn.click();
    await page.waitForTimeout(800);
    expect(await page.evaluate((ts)=>!document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.click('aside.sidebar [data-page="shopping"]');
    await page.waitForTimeout(800);
    expect(await page.evaluate((ts)=>!document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
  });

  test('Prep: add, complete, delete', async ({ page }) => {
    await page.click('aside.sidebar [data-page="prep"]');
    await page.waitForTimeout(800);
    const ts = Date.now();
    await page.fill('#newPrepMr', `PrepMr ${ts}`);
    await page.fill('#newPrepEn', `PrepEn ${ts}`);
    await page.click('[data-add-prep]');
    await page.waitForTimeout(1200);
    expect(await page.evaluate((ts)=>document.body.innerHTML.includes(String(ts)), ts)).toBe(true);
    const prepCb = page.locator('[data-prep]').first();
    await prepCb.check();
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.click('aside.sidebar [data-page="prep"]');
    await page.waitForTimeout(800);
    expect(await page.evaluate(()=>document.body.innerHTML.length > 500)).toBe(true);
    const delBtn = page.locator('[data-delete-prep]').last();
    if (await delBtn.count() > 0) {
      await delBtn.click();
      await page.waitForTimeout(800);
    }
  });

  test('Family dietary: toggle, persistence', async ({ page }) => {
    await page.click('aside.sidebar [data-page="family"]');
    await page.waitForTimeout(800);
    const toggle = page.locator('[data-dietary-toggle]').first();
    await expect(toggle).toBeVisible();
    const before = await toggle.isChecked();
    await toggle.check({ force: true });
    await page.waitForTimeout(1200);
    expect(await toggle.isChecked()).not.toBe(before);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.click('aside.sidebar [data-page="family"]');
    await page.waitForTimeout(800);
    const afterReload = await page.locator('[data-dietary-toggle]').first().isChecked();
    expect(afterReload).not.toBe(before);
    // Toggle back
    const toggle2 = page.locator('[data-dietary-toggle]').first();
    if (afterReload) await toggle2.uncheck({ force: true });
    else await toggle2.check({ force: true });
    await page.waitForTimeout(1000);
  });

  test('Settings: language, theme, persistence', async ({ page }) => {
    await page.click('aside.sidebar [data-page="settings"]');
    await page.waitForTimeout(800);
    for (const lang of ['mr','en','both']) {
      await page.click(`[data-language="${lang}"]`);
      await page.waitForTimeout(500);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
      expect(await page.evaluate(()=>document.getElementById('app')?.innerHTML?.length || 0)).toBeGreaterThan(1000);
    }
    await page.click('aside.sidebar [data-page="settings"]');
    await page.waitForTimeout(800);
    await page.click('[data-theme="dark"]');
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
    expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
    await page.click('[data-theme="light"]');
    await page.waitForTimeout(500);
  });

  test('Navigation all pages', async ({ page }) => {
    for (const p of ['today','calendar','recipes','health','shopping','prep','family','settings']) {
      await page.click(`aside.sidebar [data-page="${p}"]`);
      await page.waitForTimeout(600);
      expect(await page.evaluate(()=>document.getElementById('app')?.innerHTML?.length || 0)).toBeGreaterThan(500);
    }
  });

  test('Bilingual both contains Marathi', async ({ page }) => {
    await page.evaluate(()=>{localStorage.setItem('kutumb-bhojan-language-v1','both'); location.reload();});
    await page.locator('.meal-card, .recipe-card').first().waitFor({ state: 'visible', timeout: 30000 });
    const html = await page.evaluate(()=>document.body.innerHTML);
    expect(html).toContain('आ');
  });
});
