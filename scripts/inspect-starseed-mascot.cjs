const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

async function run() {
  console.log('=== Starting MIRARI Star-seed Sprite & Flask Container Verification ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // High-DPI screenshots
  });
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Page Console Error:', msg.text());
    }
  });

  // ─── 1. Home Page & Round-Bottom Flask Hero ───────────────────────────
  console.log('1. Loading Home Page with Star-seed Sprite...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000); // Wait for GLB load & initial animation

  // Close auto-greeting panel if open so we can inspect the hero mascot clearly
  const closeBtn = page.locator('button:has-text("關閉")').first();
  if (await closeBtn.isVisible()) {
    console.log('Closing greeting panel to inspect hero mascot...');
    await closeBtn.click();
    await page.waitForTimeout(600);
  }

  // Verify single WebGL canvas
  const canvasCount = await page.locator('canvas').count();
  console.log(`WebGL Canvas Count on Home: ${canvasCount} (Expected: 1)`);
  if (canvasCount !== 1) {
    throw new Error(`Expected exactly 1 persistent canvas, got ${canvasCount}`);
  }

  // Capture Home Hero Large screenshot
  console.log('Capturing: starseed-mascot-hero-large.png...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-hero-large.png'),
    fullPage: false,
  });

  // Capture close-up of mascot in flask
  const mascotEl = page.locator('#mirari-global-mascot');
  console.log('Capturing: starseed-mascot-flask-closeup.png...');
  await mascotEl.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-flask-closeup.png'),
  });

  // ─── 2. Multi-Angle Studio Showcase (Front, Side, 3/4 Perspective) ───
  console.log('2. Rendering multi-angle studio views of the Star-seed Sprite...');
  // Add clean studio photography backdrop to isolate model details
  await page.evaluate(() => {
    let studioBg = document.getElementById('studio-photo-bg');
    if (!studioBg) {
      studioBg = document.createElement('div');
      studioBg.id = 'studio-photo-bg';
      studioBg.style.position = 'fixed';
      studioBg.style.inset = '0';
      studioBg.style.zIndex = '45';
      studioBg.style.background = 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f1f3f9 65%, #e2e8f0 100%)';
      document.body.appendChild(studioBg);
    }

    const mascot = document.getElementById('mirari-global-mascot');
    if (mascot) {
      mascot.style.transition = 'none';
      mascot.style.transform = 'translate3d(580px, 240px, 0)';
      mascot.style.width = '280px';
      mascot.style.height = '336px';
    }
  });
  await page.waitForTimeout(600);

  // Front View (0° with neutral forward look)
  console.log('Capturing: starseed-mascot-front.png...');
  await page.evaluate(() => {
    if (window.__mirariSetGaze) window.__mirariSetGaze(0, 0);
  });
  await page.waitForTimeout(400);
  await mascotEl.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-front.png'),
  });

  // 3/4 Perspective View (Curious angle looking up and to the right)
  console.log('Capturing: starseed-mascot-perspective.png...');
  await page.evaluate(() => {
    if (window.__mirariSetGaze) window.__mirariSetGaze(0.85, -0.25);
  });
  await page.waitForTimeout(400);
  await mascotEl.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-perspective.png'),
  });

  // Side View (Direct side profile gaze)
  console.log('Capturing: starseed-mascot-side.png...');
  await page.evaluate(() => {
    if (window.__mirariSetGaze) window.__mirariSetGaze(1.6, 0);
  });
  await page.waitForTimeout(400);
  await mascotEl.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-side.png'),
  });

  // Remove studio backdrop and restore mascot layout for website interaction tests
  await page.evaluate(() => {
    const studioBg = document.getElementById('studio-photo-bg');
    if (studioBg) studioBg.remove();
    const mascot = document.getElementById('mirari-global-mascot');
    if (mascot) {
      mascot.style.width = '';
      mascot.style.height = '';
      mascot.style.transition = '';
    }
  });
  await page.waitForTimeout(400);

  // ─── 3. Test Dragging Mascot ──────────────────────────────────────────
  console.log('3. Testing free drag of Star-seed Sprite in Flask...');
  const boxBefore = await mascotEl.boundingBox();
  if (boxBefore) {
    const startX = boxBefore.x + boxBefore.width / 2;
    const startY = boxBefore.y + boxBefore.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 260, startY + 140, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    console.log('Capturing: starseed-mascot-dragged.png...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'starseed-mascot-dragged.png'),
    });

    // Test Reset Position Pill
    await page.mouse.move(startX - 260, startY + 140);
    const resetBtn = page.locator('button:has-text("復位")');
    if (await resetBtn.isVisible()) {
      console.log('Testing reset button...');
      await resetBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // ─── 4. Seamless Transition to Article View (Small Companion Size) ─────
  console.log('4. Navigating to Article View (Clicking 進入互動閱讀)...');
  // Clear any dragged position so companion docks to natural bottom-right corner
  await page.evaluate(() => localStorage.removeItem('mirari_mascot_pos'));
  await page.waitForTimeout(200);

  const readBtn = page.locator('button:has-text("進入互動閱讀")').first();
  await readBtn.click();
  await page.waitForTimeout(1000);

  // Verify single persistent mascot canvas survives route change
  const articleCanvasCount = await page.locator('#mirari-global-mascot canvas').count();
  console.log(`Persistent Mascot Canvas Count on Article View: ${articleCanvasCount} (Expected: 1)`);
  if (articleCanvasCount !== 1) {
    throw new Error(`Expected exactly 1 persistent mascot canvas on Article View, got ${articleCanvasCount}`);
  }

  // Capture Article Companion Small screenshot
  console.log('Capturing: starseed-mascot-companion-small.png...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'starseed-mascot-companion-small.png'),
  });

  // ─── 5. Test Reading Companion Exact Text Highlighting ────────────────
  console.log('5. Testing Reading Companion Q&A and exact text highlight...');
  // Mascot in companion mode is in bottom-right corner
  await mascotEl.click();
  await page.waitForTimeout(600);

  const questionChip = page.locator('button:has-text("為什麼行星越大，恆星亮度下降越多？")').first();
  if (await questionChip.isVisible()) {
    await questionChip.click();
    console.log('Triggered question, waiting for AI evidence matching and highlight...');
    await page.waitForTimeout(1200);

    // Verify highlighted text exists with exact-text-highlight class
    const highlightedEl = page.locator('.exact-text-highlight').first();
    const isHighlighted = await highlightedEl.isVisible();
    console.log(`Exact text evidence highlighted (.exact-text-highlight): ${isHighlighted}`);

    console.log('Capturing: starseed-mascot-evidence-highlight.png...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'starseed-mascot-evidence-highlight.png'),
    });
  }

  await browser.close();
  console.log('=== All Star-seed Sprite inspections completed successfully! ===');
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
