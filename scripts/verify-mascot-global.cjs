const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

async function run() {
  console.log('--- Starting MIRARI Global Mascot & Continuous Transition Verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Page Console Error:', msg.text());
    }
  });

  // 1. Visit Home
  console.log('1. Loading Home page...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Wait for greeting & panel pull-out
  console.log('Waiting for proactive search panel to pull out...');
  await page.waitForSelector('text=探索科學篇章', { timeout: 4000 });

  // Verify Single Canvas
  const canvasCount = await page.locator('canvas').count();
  console.log(`Canvas count on home page: ${canvasCount}`);
  if (canvasCount !== 1) {
    throw new Error(`Expected exactly 1 canvas instance, found ${canvasCount}`);
  }

  const panelTitle = page.locator('text=探索科學篇章').first();
  const isPanelVisible = await panelTitle.isVisible();
  console.log(`Proactive search panel automatically pulled out: ${isPanelVisible}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-home-greeting-search.png'),
  });

  // 2. Perform search in panel
  console.log('2. Performing search in MIRARI panel...');
  const chip = page.locator('button:has-text("可以親手操作的天文物理文章")').first();
  await chip.click();
  await page.waitForTimeout(600); // Wait for recommendation result
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-home-search-results.png'),
  });

  // 3. Close panel
  console.log('3. Closing search panel...');
  const closeBtn = page.locator('button:has-text("關閉")').first();
  await closeBtn.click();
  await page.waitForTimeout(400);

  // 4. Test Free Dragging
  console.log('4. Testing free drag of MIRARI mascot...');
  // Find mascot container by ID
  const mascot = page.locator('#mirari-global-mascot');
  const boxBefore = await mascot.boundingBox();
  console.log('Mascot initial position:', boxBefore);

  if (!boxBefore) {
    throw new Error('Mascot container not found');
  }

  // Pointer drag actions: drag mascot from current position left and down
  const startX = boxBefore.x + boxBefore.width / 2;
  const startY = boxBefore.y + boxBefore.height / 2;
  const targetX = startX - 250;
  const targetY = startY + 180;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const boxAfter = await mascot.boundingBox();
  console.log('Mascot dragged position:', boxAfter);

  // Verify position changed significantly
  const movedX = Math.abs(boxAfter.x - boxBefore.x);
  const movedY = Math.abs(boxAfter.y - boxBefore.y);
  console.log(`Moved dx: ${movedX}, dy: ${movedY}`);
  if (movedX < 50 || movedY < 50) {
    throw new Error('Mascot did not move as expected during drag');
  }

  // Verify localStorage persistence
  const savedPos = await page.evaluate(() => localStorage.getItem('mirari_mascot_pos'));
  console.log('Saved localStorage position:', savedPos);
  if (!savedPos) {
    throw new Error('localStorage position not saved after drag');
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-dragged-home.png'),
  });

  // 5. Test Tap/Click after Drag to Toggle Panel
  console.log('5. Clicking dragged mascot to test panel toggle...');
  await mascot.click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-dragged-panel-opened.png'),
  });

  // Close panel
  await page.locator('button:has-text("關閉")').first().click();
  await page.waitForTimeout(300);

  // 6. Navigate to Article View (Seamless continuity)
  console.log('6. Navigating to Article View...');
  const coverStory = page.locator('button:has-text("進入互動閱讀")').first();
  await coverStory.click();
  await page.waitForTimeout(600);

  // Verify Canvas count is STILL strictly 1 for mascot
  const mascotCanvasCountArticle = await page.locator('#mirari-global-mascot canvas').count();
  console.log(`Mascot canvas count on article page: ${mascotCanvasCountArticle}`);
  if (mascotCanvasCountArticle !== 1) {
    throw new Error(`Expected exactly 1 mascot canvas instance on article page, found ${mascotCanvasCountArticle}`);
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-article-view.png'),
  });

  // 7. Click mascot in article view to open Question Companion
  console.log('7. Opening Reading Q&A Companion on Article...');
  await mascot.click();
  await page.waitForTimeout(400);

  // Ask question 1: 為什麼行星越大，恆星亮度下降越多？
  console.log('Asking question 1...');
  const q1 = page.locator('button:has-text("為什麼行星越大，恆星亮度下降越多？")').first();
  await q1.click();
  await page.waitForTimeout(600); // Wait for evidence search & highlight

  // Check highlight class in DOM
  const highlighted = await page.locator('.exact-text-highlight').first();
  const isHighlighted = await highlighted.isVisible();
  const highlightedText = await highlighted.innerText();
  console.log(`Exact text highlighted: ${isHighlighted}, text: "${highlightedText.slice(0, 30)}..."`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-article-evidence-q1.png'),
  });

  // 8. Test Mobile Viewport
  console.log('8. Testing mobile viewport (375x667)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  const mobileMascotCanvasCount = await mobilePage.locator('#mirari-global-mascot canvas').count();
  console.log(`Mobile mascot canvas count: ${mobileMascotCanvasCount}`);
  if (mobileMascotCanvasCount !== 1) {
    throw new Error(`Expected exactly 1 mascot canvas on mobile, found ${mobileMascotCanvasCount}`);
  }

  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'mascot-mobile-bottom-sheet.png'),
  });

  await browser.close();
  console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
