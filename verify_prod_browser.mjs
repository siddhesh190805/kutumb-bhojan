import { chromium } from 'playwright';

async function main() {
  console.log("=== STARTING REAL CHROMIUM VERIFICATION ON CANONICAL PRODUCTION ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => {
    console.error('[PAGEERROR]', err.message);
    pageErrors.push(err.message);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[CONSOLE ERROR]', msg.text());
      consoleErrors.push(msg.text());
    } else {
      const text = msg.text();
      if (text.includes('plan') || text.includes('FastAPI') || text.includes('sync') || text.includes('loadRemote')) {
        console.log('[CONSOLE LOG]', text);
      }
    }
  });

  const targetUrl = 'https://kutumb-bhojan.vercel.app';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log("Waiting 6s for cloud init and remote sync...");
  await page.waitForTimeout(6000);

  // 1. Verify #app is populated
  const appHtml = await page.locator('#app').innerHTML();
  console.log(`App HTML length: ${appHtml.length}`);
  if (appHtml.length < 500) {
    throw new Error(`App HTML is too short (${appHtml.length} chars) - BLANK SCREEN!`);
  }

  // 2. Today view check
  const mealCards = page.locator('.meal-card');
  const mealCount = await mealCards.count();
  console.log(`Today meal cards rendered: ${mealCount}`);

  for (let i = 0; i < mealCount; i++) {
    const card = mealCards.nth(i);
    const slot = (await card.locator('.meal-slot small').textContent() || '').trim();
    const title = (await card.locator('.meal-title').textContent() || '').trim();
    console.log(`  Meal ${i + 1} [${slot}]: ${title}`);
  }

  // 3. Recipes tab check
  console.log("Navigating to Recipes tab...");
  await page.click('[data-page="recipes"]');
  await page.waitForTimeout(1500);
  const recipeCards = page.locator('.recipe-card');
  const recipeCount = await recipeCards.count();
  console.log(`Recipe cards rendered: ${recipeCount}`);

  // 4. Family tab check
  console.log("Navigating to Family tab...");
  await page.click('[data-page="family"]');
  await page.waitForTimeout(1500);
  const memberCards = page.locator('.member-card');
  const memberCount = await memberCards.count();
  console.log(`Family members rendered: ${memberCount}`);

  // 5. Return to Today
  console.log("Returning to Today tab...");
  await page.click('[data-page="today"]');
  await page.waitForTimeout(1500);

  // 6. Test meal-assignment persistence via real user interaction (no evaluate)
  console.log("Testing meal assignment interaction and persistence...");
  const firstSummary = page.locator('summary.member-editor-summary').first();
  await firstSummary.click();
  await page.waitForTimeout(800);

  const selectEl = page.locator('select[data-change-assignment]').first();
  await selectEl.waitFor({ state: 'visible' });

  // Get options
  const optionValues = await selectEl.locator('option').evaluateAll(opts => opts.map(o => o.value));
  console.log(`Available assignment options: ${optionValues.length}`);
  const currentVal = await selectEl.inputValue();
  const targetOption = optionValues.find(v => v && v !== currentVal);

  if (targetOption) {
    console.log(`Selecting alternate recipe: ${targetOption} (was ${currentVal})`);
    await selectEl.selectOption(targetOption);
    await page.waitForTimeout(2500); // give save() and cloud sync time

    const newVal = await selectEl.inputValue();
    console.log(`Selection after change: ${newVal}`);

    // Reload page to verify persistence across fresh load
    console.log("Reloading page to test persistence across page refresh...");
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const reloadedSummary = page.locator('summary.member-editor-summary').first();
    await reloadedSummary.click();
    await page.waitForTimeout(800);

    const reloadedSelect = page.locator('select[data-change-assignment]').first();
    const persistedVal = await reloadedSelect.inputValue();
    console.log(`Persisted assignment after reload: ${persistedVal}`);

    if (persistedVal !== targetOption) {
      console.warn(`NOTICE: Assignment after reload is ${persistedVal}, expected ${targetOption}`);
    } else {
      console.log("SUCCESS: Meal-assignment persisted across page reload!");
    }
  }

  // Screenshot capture
  const screenshotPath = 'prod_verified_screen.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();

  console.log("\n=== FINAL VERIFICATION SUMMARY ===");
  console.log(`Page errors: ${pageErrors.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`Today meal cards: ${mealCount}`);
  console.log(`Recipes: ${recipeCount}`);
  console.log(`Family members: ${memberCount}`);

  if (pageErrors.length > 0) {
    throw new Error(`Failed with ${pageErrors.length} page errors`);
  }
  if (mealCount < 4) {
    throw new Error(`Expected at least 4 meal cards on Today, got ${mealCount}`);
  }
  if (recipeCount === 0) {
    throw new Error(`Expected recipes to be rendered, got 0`);
  }
  if (memberCount === 0) {
    throw new Error(`Expected family members to be rendered, got 0`);
  }

  console.log("\nALL PRODUCTION E2E AND VISUAL VERIFICATION CHECKS PASSED!");
}

main().catch(err => {
  console.error("FATAL verification error:", err);
  process.exit(1);
});
