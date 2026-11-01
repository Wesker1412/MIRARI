const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const artifactDir = path.resolve('C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // ─── 1. Desktop Viewport (1440x900) ─────────────────────────
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  console.log('Visiting Homepage on Desktop...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Desktop Homepage Screenshot
  const homeDesktopPath = path.join(artifactDir, 'redesign-home-desktop.png');
  await page.screenshot({ path: homeDesktopPath });
  console.log('Saved:', homeDesktopPath);

  // Test in-preparation modal click
  const prepCard = await page.locator('text=早期宇宙「超重黑洞」異常吸積特徵').first();
  await prepCard.click();
  await page.waitForTimeout(600);
  const prepModalPath = path.join(artifactDir, 'redesign-modal-prep.png');
  await page.screenshot({ path: prepModalPath });
  console.log('Saved:', prepModalPath);

  // Close modal by clicking "先看精選互動特輯"
  const viewCoverBtn = await page.locator('text=先看精選互動特輯《當星光暗了一點》').first();
  await viewCoverBtn.click();
  await page.waitForTimeout(1200);

  // Desktop Article Screenshot (Notice default state: ONLY small mascot in bottom right!)
  const articleDefaultPath = path.join(artifactDir, 'redesign-article-default.png');
  await page.screenshot({ path: articleDefaultPath });
  console.log('Saved:', articleDefaultPath);

  // Scroll to simulator
  await page.locator('#kp-transit-simulator').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const simPath = path.join(artifactDir, 'redesign-simulator.png');
  await page.screenshot({ path: simPath });
  console.log('Saved:', simPath);

  // Click on the 3D mascot to open the inquiry card!
  console.log('Clicking on mascot...');
  const mascotTrigger = await page.locator('div[title="點擊與 MIRARI 互動提問"]').first();
  await mascotTrigger.click();
  await page.waitForTimeout(800);

  const companionOpenedPath = path.join(artifactDir, 'redesign-companion-opened.png');
  await page.screenshot({ path: companionOpenedPath });
  console.log('Saved:', companionOpenedPath);

  // Click question: "為什麼行星越大，恆星亮度下降越多？"
  console.log('Asking question in companion...');
  const questionBtn = await page.locator('text=為什麼行星越大，恆星亮度下降越多？').first();
  await questionBtn.click();
  await page.waitForTimeout(1400);

  const companionAnsweredPath = path.join(artifactDir, 'redesign-companion-answered.png');
  await page.screenshot({ path: companionAnsweredPath });
  console.log('Saved:', companionAnsweredPath);

  // Test closing the companion
  const closeBtn = await page.locator('button[title="關閉"]').first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  // ─── 2. Mobile Viewport (390x844) ───────────────────────────
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  const homeMobilePath = path.join(artifactDir, 'redesign-home-mobile.png');
  await mobilePage.screenshot({ path: homeMobilePath });
  console.log('Saved:', homeMobilePath);

  // Navigate to article on mobile
  const mobileEnterBtn = await mobilePage.locator('text=進入互動閱讀').first();
  await mobileEnterBtn.click();
  await mobilePage.waitForTimeout(1200);

  // Mobile Article: verify mascot is just small in corner without blocking
  const articleMobileDefaultPath = path.join(artifactDir, 'redesign-article-mobile.png');
  await mobilePage.screenshot({ path: articleMobileDefaultPath });
  console.log('Saved:', articleMobileDefaultPath);

  // Click mascot on mobile to verify bottom sheet
  const mobileMascot = await mobilePage.locator('div[title="點擊與 MIRARI 互動提問"]').first();
  await mobileMascot.click();
  await mobilePage.waitForTimeout(600);

  const mobileSheetPath = path.join(artifactDir, 'redesign-mobile-sheet.png');
  await mobilePage.screenshot({ path: mobileSheetPath });
  console.log('Saved:', mobileSheetPath);

  await browser.close();

  console.log('--- Verification Complete ---');
  if (consoleErrors.length === 0) {
    console.log('SUCCESS: 0 console errors detected!');
  } else {
    console.log('Console Errors:', consoleErrors);
  }
}

run().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
