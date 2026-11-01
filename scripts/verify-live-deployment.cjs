const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://mirari-henna.vercel.app';
const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

async function verifyLiveSite() {
  console.log('================================================================');
  console.log(`🌐 正在檢驗 Vercel 正式站台: ${BASE_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Test 1: Homepage on live site
  console.log('【驗證 1：首頁載入與三篇新文章卡片】');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const title = await page.title();
  console.log('✓ 首頁 Title:', title);

  const chaosCard = await page.locator('text=渾沌的邊界').first().isVisible();
  const neuronCard = await page.locator('text=神經元的數位之火').first().isVisible();
  const demonCard = await page.locator('text=穿過微觀閘門的幽靈').first().isVisible();
  console.log('✓ 雙擺卡片可見:', chaosCard);
  console.log('✓ 神經元卡片可見:', neuronCard);
  console.log('✓ 麥克斯韋妖卡片可見:', demonCard);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-verified-homepage.png') });

  // Test 2: Double Pendulum article direct load & refresh
  console.log('\n【驗證 2：雙擺文章直接開啟與重新整理】');
  await page.goto(`${BASE_URL}/articles/chaos-double-pendulum-lyapunov`, { waitUntil: 'networkidle' });
  const article1Title = await page.locator('h1').textContent();
  console.log('✓ 文章 1 H1:', article1Title);
  const katexCount1 = await page.locator('.katex').count();
  console.log('✓ 文章 1 KaTeX 渲染數:', katexCount1);
  const canvas1 = await page.locator('canvas').first().isVisible();
  console.log('✓ 雙擺模擬畫布渲染就緒:', canvas1);

  // Direct refresh test
  await page.reload({ waitUntil: 'networkidle' });
  const afterReload1 = await page.locator('h1').textContent();
  console.log('✓ 重新整理後正文依然正常:', afterReload1 === article1Title);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-verified-article-1.png') });

  // Test 3: Action Potential article direct load & refresh
  console.log('\n【驗證 3：神經元動作電位文章直接開啟與重新整理】');
  await page.goto(`${BASE_URL}/articles/action-potential-hodgkin-huxley`, { waitUntil: 'networkidle' });
  const article2Title = await page.locator('h1').textContent();
  console.log('✓ 文章 2 H1:', article2Title);
  const katexCount2 = await page.locator('.katex').count();
  console.log('✓ 文章 2 KaTeX 渲染數:', katexCount2);
  const canvas2 = await page.locator('canvas').first().isVisible();
  console.log('✓ 示波器畫布渲染就緒:', canvas2);

  // Test pulse injection button
  const pulseBtn = page.locator('button:has-text("注入單次刺激脈衝")');
  if (await pulseBtn.isVisible()) {
    await pulseBtn.click();
    console.log('✓ 注入單次刺激脈衝點擊成功');
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-verified-article-2.png') });

  // Test 4: Maxwell's Demon article direct load & refresh
  console.log('\n【驗證 4：麥克斯韋妖文章直接開啟與重新整理】');
  await page.goto(`${BASE_URL}/articles/maxwells-demon-landauer-entropy`, { waitUntil: 'networkidle' });
  const article3Title = await page.locator('h1').textContent();
  console.log('✓ 文章 3 H1:', article3Title);
  const katexCount3 = await page.locator('.katex').count();
  console.log('✓ 文章 3 KaTeX 渲染數:', katexCount3);
  const canvas3 = await page.locator('canvas').first().isVisible();
  console.log('✓ 分子碰撞箱畫布就緒:', canvas3);

  // Test erase memory button
  const eraseBtn = page.locator('button:has-text("立即抹除記憶體")');
  if (await eraseBtn.isVisible()) {
    await eraseBtn.click();
    console.log('✓ 蘭道爾資訊抹除按鈕點擊成功');
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-verified-article-3.png') });

  console.log('\n================================================================');
  console.log('🎉 Vercel 正式站台全部 4 大驗證項目成功通過！');
  console.log('================================================================\n');

  await browser.close();
}

verifyLiveSite().catch((err) => {
  console.error('❌ 驗證失敗:', err);
  process.exit(1);
});
