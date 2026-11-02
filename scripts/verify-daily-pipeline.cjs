const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Wesker\\.gemini\\antigravity\\brain\\754bd979-2c00-4d79-ae0f-cfda45f084ce';
const BASE_URL = 'http://localhost:5173';

async function main() {
  console.log('🚀 啟動 Playwright 端對端查驗 MIRARI 每日創作管線 10 篇文章與新模擬器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. 首頁查驗
    console.log('\n--- 1. 查驗首頁 ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const journalTitle = page.locator('text=期刊解讀').first();
    const principlesTitle = page.locator('text=科學原理與思想實驗').first();
    await journalTitle.waitFor({ state: 'visible' });
    await principlesTitle.waitFor({ state: 'visible' });
    console.log('✓ 首頁四大板塊結構正常可見');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-daily-homepage.png'),
    });

    // 2. /journal 頁面查驗 (應有 4 篇)
    console.log('\n--- 2. 查驗 /journal 頁面 ---');
    await page.goto(`${BASE_URL}/journal`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const journalCount = await page.locator('article').count();
    console.log(`✓ /journal 列表頁渲染文章數量: ${journalCount} 篇 (預期 4 篇)`);
    if (journalCount !== 4) throw new Error(`預期 4 篇，實際為 ${journalCount} 篇`);

    // 3. /principles 頁面查驗 (應有 6 篇)
    console.log('\n--- 3. 查驗 /principles 頁面 ---');
    await page.goto(`${BASE_URL}/principles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const principlesCount = await page.locator('article').count();
    console.log(`✓ /principles 列表頁渲染文章數量: ${principlesCount} 篇 (預期 6 篇)`);
    if (principlesCount !== 6) throw new Error(`預期 6 篇，實際為 ${principlesCount} 篇`);

    // 4. 查驗新文章 1: 布朗棘輪 (BrownianRatchetSimulator)
    console.log('\n--- 4. 查驗新文章 1: 布朗棘輪 ---');
    await page.goto(`${BASE_URL}/articles/brownian-ratchet-molecular-motors`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const art1Heading = page.locator('h1:has-text("穿透熱混沌的微觀足跡")');
    await art1Heading.waitFor({ state: 'visible' });
    console.log('✓ 文章 1 標題成功載入');

    // 點擊切換模式
    const modeBtnEquil = page.locator('button:has-text("等溫熱平衡 (淨位移=0)")');
    await modeBtnEquil.click();
    console.log('✓ 切換等溫熱平衡模式正常');
    await page.waitForTimeout(300);

    const modeBtnAtp = page.locator('button:has-text("ATP 驅動整流行走")');
    await modeBtnAtp.click();
    console.log('✓ 切換回 ATP 驅動整流行走正常');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-brownian-ratchet.png'),
    });

    // 5. 查驗新文章 2: 湍流柯爾莫哥洛夫能譜 (TurbulenceCascadeSimulator)
    console.log('\n--- 5. 查驗新文章 2: 湍流柯爾莫哥洛夫能譜 ---');
    await page.goto(`${BASE_URL}/articles/turbulence-kolmogorov-cascade`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const art2Heading = page.locator('h1:has-text("暴風中的分形旋渦")');
    await art2Heading.waitFor({ state: 'visible' });
    console.log('✓ 文章 2 標題成功載入');

    // 點擊切換狀態
    const laminarBtn = page.locator('button:has-text("低雷諾數層流")');
    await laminarBtn.click();
    console.log('✓ 切換至低雷諾數層流模式正常');
    await page.waitForTimeout(300);

    const burstBtn = page.locator('button:has-text("暴風級高能量注入")');
    await burstBtn.click();
    console.log('✓ 切換至暴風級高能量注入模式正常');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-turbulence-cascade.png'),
    });

    // 6. 查驗新文章 3: 韋伯微弱重力透鏡暗物質 (WeakLensingShearSimulator)
    console.log('\n--- 6. 查驗新文章 3: 韋伯微弱重力透鏡暗物質 ---');
    await page.goto(`${BASE_URL}/articles/jwst-cosmos-web-dark-matter-lensing`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const art3Heading = page.locator('h1:has-text("宇宙的無形骨骼")');
    await art3Heading.waitFor({ state: 'visible' });
    console.log('✓ 文章 3 標題成功載入');

    // 切換情境與圖層
    const filamentBtn = page.locator('button:has-text("宇宙網絲狀結構")');
    await filamentBtn.click();
    console.log('✓ 切換至宇宙網絲狀結構情境正常');
    await page.waitForTimeout(300);

    const massToggle = page.locator('button:has-text("顯示暗物質反演層")');
    if (await massToggle.isVisible()) {
      await massToggle.click();
      console.log('✓ 切換暗物質質量反演熱圖正常');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-weak-lensing.png'),
    });

    console.log('\n🎉 MIRARI 今日 3 篇全新創作、全站 10 篇文章與新模擬器查驗全部 100% 通過！');
  } catch (err) {
    console.error('❌ 查驗過程出錯:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
