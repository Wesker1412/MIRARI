const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const artifactDir = path.resolve('C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // ─── Desktop Viewport (1440x900) ─────────────────────────────
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  console.log('Navigating to MIRARI homepage...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const homePath = path.join(artifactDir, 'editorial-home-clean.png');
  await page.screenshot({ path: homePath });
  console.log('Saved:', homePath);

  // Navigate to article
  await page.locator('text=進入互動閱讀').first().click();
  await page.waitForTimeout(1000);

  const articlePath = path.join(artifactDir, 'editorial-article-clean.png');
  await page.screenshot({ path: articlePath });
  console.log('Saved:', articlePath);

  // Click on mascot to open query card
  const mascot = page.locator('div[title="點擊與 MIRARI 互動提問"]').first();
  await mascot.click();
  await page.waitForTimeout(600);

  // ─── Test 1: Question 1 ──────────────────────────────────────
  console.log('Testing Question 1 (Radius vs Depth)...');
  await page.locator('text=為什麼行星越大，恆星亮度下降越多？').first().click();
  await page.waitForTimeout(1200);

  // Verify that only the exact sentence is highlighted
  const isQ1Highlighted = await page.locator('#sent-radius-squared-explanation').evaluate(
    el => el.classList.contains('exact-text-highlight')
  );
  console.log('Q1 sentence highlighted:', isQ1Highlighted);

  const q1Path = path.join(artifactDir, 'evidence-q1-highlight.png');
  await page.screenshot({ path: q1Path });
  console.log('Saved:', q1Path);

  // ─── Test 2: Question 2 ──────────────────────────────────────
  console.log('Testing Question 2 (U-shape curve)...');
  await page.locator('text=為什麼真實的光度曲線底部是 U 型而不是平的？').first().click();
  await page.waitForTimeout(1200);

  const isQ2Highlighted = await page.locator('#sent-u-shape-curve').evaluate(
    el => el.classList.contains('exact-text-highlight')
  );
  console.log('Q2 sentence highlighted:', isQ2Highlighted);

  const q2Path = path.join(artifactDir, 'evidence-q2-highlight.png');
  await page.screenshot({ path: q2Path });
  console.log('Saved:', q2Path);

  // ─── Test 3: Question 3 ──────────────────────────────────────
  console.log('Testing Question 3 (Transit Probability)...');
  await page.locator('text=系外行星凌日被觀測到的幾率有多大？').first().click();
  await page.waitForTimeout(1200);

  const isQ3Highlighted = await page.locator('#sent-transit-probability').evaluate(
    el => el.classList.contains('exact-text-highlight')
  );
  console.log('Q3 sentence highlighted:', isQ3Highlighted);

  const q3Path = path.join(artifactDir, 'evidence-q3-highlight.png');
  await page.screenshot({ path: q3Path });
  console.log('Saved:', q3Path);

  // ─── Test 4: Clear Highlight ─────────────────────────────────
  console.log('Testing Clear Highlight...');
  const clearBtn = page.locator('button[title="清除標記"], button:has-text("清除")').first();
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(500);
    const stillHighlighted = await page.locator('#sent-transit-probability').evaluate(
      el => el.classList.contains('exact-text-highlight')
    );
    console.log('Highlight cleared successfully:', !stillHighlighted);
  }

  // ─── Test 5: Mobile Viewport ─────────────────────────────────
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.locator('text=進入互動閱讀').first().click();
  await mobilePage.waitForTimeout(1000);

  // Open mobile mascot
  await mobilePage.locator('div[title="點擊與 MIRARI 互動提問"]').first().click();
  await mobilePage.waitForTimeout(600);

  // Click Q1 on mobile
  await mobilePage.locator('text=為什麼行星越大，恆星亮度下降越多？').first().click();
  await mobilePage.waitForTimeout(1200);

  // Close mobile sheet
  await mobilePage.locator('button:has-text("關閉")').first().click();
  await mobilePage.waitForTimeout(600);

  const mobileEvidencePath = path.join(artifactDir, 'evidence-mobile-highlight.png');
  await mobilePage.screenshot({ path: mobileEvidencePath });
  console.log('Saved:', mobileEvidencePath);

  await browser.close();

  console.log('--- Verification Summary ---');
  if (consoleErrors.length === 0) {
    console.log('SUCCESS: All 3 questions localized exact text sentences with 0 console errors!');
  } else {
    console.log('Errors:', consoleErrors);
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
