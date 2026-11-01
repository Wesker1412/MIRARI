const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const artifactDir = path.resolve('C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop Viewport
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // Allow Three.js to render first frame

  // Capture Homepage Desktop
  const homeDesktopPath = path.join(artifactDir, 'homepage-desktop.png');
  await page.screenshot({ path: homeDesktopPath, fullPage: false });
  console.log('Saved:', homeDesktopPath);

  // Click on the cover article button "進入本期封面互動實驗" or "立即進入互動閱讀"
  const enterBtn = await page.locator('text=進入本期封面互動實驗').first();
  await enterBtn.click();
  await page.waitForTimeout(1200);

  // Capture Article Desktop with Simulator & Mascot Companion
  const articleDesktopPath = path.join(artifactDir, 'article-desktop.png');
  await page.screenshot({ path: articleDesktopPath, fullPage: false });
  console.log('Saved:', articleDesktopPath);

  // Scroll to simulator
  await page.locator('#kp-transit-simulator').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const simulatorPath = path.join(artifactDir, 'simulator-desktop.png');
  await page.screenshot({ path: simulatorPath, fullPage: false });
  console.log('Saved:', simulatorPath);

  // Test Mascot companion question: "為什麼行星越大，恆星亮度下降越多？"
  const questionBtn = await page.locator('text=為什麼行星越大，恆星亮度下降越多？').first();
  if (await questionBtn.isVisible()) {
    await questionBtn.click();
    await page.waitForTimeout(1500);
    const companionActionPath = path.join(artifactDir, 'companion-navigation.png');
    await page.screenshot({ path: companionActionPath, fullPage: false });
    console.log('Saved:', companionActionPath);
  }

  // 2. Mobile Viewport (iPhone 14 / 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  const homeMobilePath = path.join(artifactDir, 'homepage-mobile.png');
  await mobilePage.screenshot({ path: homeMobilePath, fullPage: false });
  console.log('Saved:', homeMobilePath);

  // Navigate to article on mobile
  const mobileEnterBtn = await mobilePage.locator('text=進入本期封面互動實驗').first();
  await mobileEnterBtn.click();
  await mobilePage.waitForTimeout(1200);

  const articleMobilePath = path.join(artifactDir, 'article-mobile.png');
  await mobilePage.screenshot({ path: articleMobilePath, fullPage: false });
  console.log('Saved:', articleMobilePath);

  await browser.close();

  console.log('--- Console Errors Check ---');
  if (consoleErrors.length === 0) {
    console.log('SUCCESS: 0 console errors detected!');
  } else {
    console.log('Errors:', consoleErrors);
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
