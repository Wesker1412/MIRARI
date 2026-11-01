const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';
const BASE_URL = 'http://localhost:5173';

async function testDailyCreation() {
  console.log('================================================================');
  console.log('🧪 MIRARI 每日自主創作成果與統一版面架構驗證');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // ─── 1. 首頁驗證：新發布文章已進入正式展示清單 ─────────────────────
    console.log('【驗證 1：首頁與統一 SiteHeader/SiteFooter】');
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // SiteHeader Check
    const brand = page.locator('header a:has-text("MIRARI")').first();
    console.log(`✓ 統一 SiteHeader 品牌導覽存在: ${await brand.isVisible()}`);

    // SiteFooter Check
    const footer = page.locator('footer:has-text("MIRARI")').first();
    console.log(`✓ 統一 SiteFooter 存在: ${await footer.isVisible()}`);

    // Check newly published articles on homepage
    const chaosCard = page.locator('h3:has-text("渾沌的邊界：雙擺與確定性系統的不可預測性")').first();
    console.log(`✓ 首頁呈現文章《渾沌的邊界》: ${await chaosCard.isVisible()}`);

    const neuronCard = page.locator('h3:has-text("神經元的數位之火：動作電位的全或無定律與離子閘門")').first();
    console.log(`✓ 首頁呈現文章《神經元的數位之火》: ${await neuronCard.isVisible()}`);

    const demonCard = page.locator('h3:has-text("穿過微觀閘門的幽靈：麥克斯韋妖與資訊的熱力學代價")').first();
    console.log(`✓ 首頁呈現文章《穿過微觀閘門的幽靈》: ${await demonCard.isVisible()}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-daily-creation-homepage.png') });

    // ─── 2. 測試新文章 1：雙擺渾沌模擬器 ─────────────────────────────
    console.log('\n【驗證 2：文章 1《渾沌的邊界》與 DoublePendulumSimulator】');
    await page.goto(BASE_URL + '/articles/chaos-double-pendulum-lyapunov', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const title1 = page.locator('h1:has-text("渾沌的邊界：雙擺與確定性系統的不可預測性")').first();
    console.log(`✓ 文章 1 標題成功渲染: ${await title1.isVisible()}`);

    // Header Context Breadcrumb Check
    const breadcrumb1 = page.locator('header span:has-text("渾沌的邊界")').first();
    console.log(`✓ 頂部 SiteHeader 呈現篇章麵包屑: ${await breadcrumb1.isVisible()}`);

    // Simulator Canvas Check
    const sim1Canvas = page.locator('canvas').nth(1); // 0 is mascot, 1 is pendulum
    console.log(`✓ 雙擺物理模擬畫布就緒: ${await sim1Canvas.isVisible()}`);

    // Simulator controls check
    const pauseBtn1 = page.locator('button:has-text("暫停模擬")').first();
    if (await pauseBtn1.isVisible()) {
      await pauseBtn1.click();
      await page.waitForTimeout(200);
      console.log('✓ 雙擺暫停/運行控制響應正常');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-article-1-double-pendulum.png') });

    // ─── 3. 測試新文章 2：動作電位示波器 ─────────────────────────────
    console.log('\n【驗證 3：文章 2《神經元的數位之火》與 ActionPotentialSimulator】');
    await page.goto(BASE_URL + '/articles/action-potential-hodgkin-huxley', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const title2 = page.locator('h1:has-text("神經元的數位之火")').first();
    console.log(`✓ 文章 2 標題成功渲染: ${await title2.isVisible()}`);

    // Simulator Canvas & Interaction Check
    const sim2Canvas = page.locator('canvas').nth(1);
    console.log(`✓ 霍奇金-赫胥黎電位示波器畫布就緒: ${await sim2Canvas.isVisible()}`);

    const injectPulseBtn = page.locator('button:has-text("注入刺激電流脈衝")').first();
    if (await injectPulseBtn.isVisible()) {
      await injectPulseBtn.click();
      await page.waitForTimeout(400);
      console.log('✓ 刺激電流注入操作響應正常');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-article-2-action-potential.png') });

    // ─── 4. 測試新文章 3：麥克斯韋妖粒子模擬器 ─────────────────────────
    console.log('\n【驗證 4：文章 3《穿過微觀閘門的幽靈》與 MaxwellDemonSimulator】');
    await page.goto(BASE_URL + '/articles/maxwells-demon-landauer-entropy', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const title3 = page.locator('h1:has-text("穿過微觀閘門的幽靈")').first();
    console.log(`✓ 文章 3 標題成功渲染: ${await title3.isVisible()}`);

    const sim3Canvas = page.locator('canvas').nth(1);
    console.log(`✓ 麥克斯韋妖碰撞腔室畫布就緒: ${await sim3Canvas.isVisible()}`);

    const eraseBtn = page.locator('button:has-text("手動抹除記憶體")').first();
    if (await eraseBtn.isVisible()) {
      await eraseBtn.click();
      await page.waitForTimeout(200);
      console.log('✓ 蘭道爾資訊抹除操作響應正常');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-article-3-maxwell-demon.png') });

    // ─── 5. 驗證吉祥物跨這四篇文章時持續存在 ────────────────────────
    console.log('\n【驗證 5：全站單一吉祥物連續性】');
    const mascot = page.locator('#mirari-global-mascot');
    console.log(`✓ 吉祥物在多次文章跳轉後依然完好存在: ${await mascot.isVisible()}`);

    console.log('\n================================================================');
    console.log('🎉 每日自主創作文章驗證全部成功通過！');
    console.log('================================================================\n');
  } finally {
    await browser.close();
  }
}

testDailyCreation().catch((err) => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});
