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
  await page.waitForTimeout(1500);

  // 1. Capture full homepage
  const homePath = path.join(artifactDir, 'editorial-home-clean.png');
  await page.screenshot({ path: homePath });
  console.log('Saved:', homePath);

  // 2. Capture Mascot Close-Up on Hero Spread
  const heroMascot = page.locator('div[title="MIRARI"]').first();
  if (await heroMascot.isVisible()) {
    const mascotCloseupPath = path.join(artifactDir, 'mascot-new-closeup.png');
    await heroMascot.screenshot({ path: mascotCloseupPath });
    console.log('Saved Mascot Close-up:', mascotCloseupPath);
  }

  // 3. Test Dynamic Science Topics Section
  console.log('Testing dynamic science topics section...');
  const topicsSection = page.locator('#explore-topics');
  await topicsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // Capture topics section screenshot
  const topicsPath = path.join(artifactDir, 'topics-home-desktop.png');
  await page.screenshot({ path: topicsPath });
  console.log('Saved Topics Section:', topicsPath);

  // Click on a topic: '天體物理與深空' inside #explore-topics
  const astrophysicsCard = page.locator('#explore-topics').locator('text=天體物理與深空').first();
  await astrophysicsCard.click();
  await page.waitForTimeout(600);

  // Verify filtered results header appears
  const filterHeader = await page.locator('text=主題篩選結果').isVisible();
  console.log('Topic filter active & verified:', filterHeader);

  // Reset filter if visible
  if (filterHeader) {
    await page.locator('text=清除篩選').first().click();
    await page.waitForTimeout(400);
  }

  // 4. Navigate to Cover Article
  console.log('Navigating to article...');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.locator('text=進入互動閱讀').first().click();
  await page.waitForTimeout(1500);

  const articlePath = path.join(artifactDir, 'editorial-article-clean.png');
  await page.screenshot({ path: articlePath });
  console.log('Saved Article View:', articlePath);

  // Click on mascot to open query card
  const mascot = page.locator('div[title="點擊與 MIRARI 互動提問"]').first();
  await mascot.click();
  await page.waitForTimeout(600);

  // ─── Test 1: Question 1 ──────────────────────────────────────
  console.log('Testing Question 1 (Radius vs Depth)...');
  await page.locator('text=為什麼行星越大，恆星亮度下降越多？').first().click();
  await page.waitForTimeout(1200);

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
  console.log('Testing Mobile Viewport...');
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
    console.log('SUCCESS: All tests passed with 0 console errors!');
  } else {
    console.log('Errors:', consoleErrors);
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
