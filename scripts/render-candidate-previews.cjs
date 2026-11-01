const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

const candidates = [
  { id: 'candidate-a', name: 'Candidate A: 忠實還原原始第三款星種精靈 (Faithful Star-seed Sprite)' },
  { id: 'candidate-b', name: 'Candidate B: 更簡約、更重視輪廓與比例的日系角色 (Minimalist Japanese Chibi)' },
  { id: 'candidate-c', name: 'Candidate C: 更有原創辨識度的新方向 (Celestial Astrolabe Sprite)' },
];

const views = [
  { id: 'front', filename: 'front.png', label: '正面視角 (Front View)' },
  { id: 'side', filename: 'side.png', label: '側面視角 (Side View)' },
  { id: 'perspective', filename: 'perspective.png', label: '斜前方視角 (Perspective View)' },
  { id: 'article-corner', filename: 'article-80px.png', label: '文章角落實際尺寸 (Article Corner 80px)' },
];

async function run() {
  console.log('=== Starting MIRARI 3D Mascot Candidates Multi-Angle Studio Rendering ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Page Console Error:', msg.text());
    }
  });

  for (const candidate of candidates) {
    console.log(`\nRendering ${candidate.name}...`);
    for (const view of views) {
      const url = `http://localhost:5173/candidate-preview.html?model=${candidate.id}&view=${view.id}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for Three.js render ready flag
      try {
        await page.waitForFunction(() => window.__RENDER_READY === true, { timeout: 8000 });
      } catch {
        console.warn(`Render flag timeout on ${candidate.id} ${view.id}, proceeding with timeout...`);
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(400);

      const outputName = `${candidate.id}-${view.filename}`;
      const outputPath = path.join(ARTIFACT_DIR, outputName);

      if (view.id === 'article-corner') {
        // Screenshot full viewport simulation for article corner
        await page.screenshot({ path: outputPath, fullPage: false });
      } else {
        // High-res capture of the canvas container
        const canvas = page.locator('canvas');
        await canvas.screenshot({ path: outputPath });
      }

      console.log(`✓ Saved ${outputName} (${view.label})`);
    }
  }

  await browser.close();
  console.log('\n=== All 12 Candidate Previews rendered and saved successfully! ===');
}

run().catch((err) => {
  console.error('Candidate rendering failed:', err);
  process.exit(1);
});
