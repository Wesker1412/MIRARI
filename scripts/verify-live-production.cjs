const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Wesker\\.gemini\\antigravity\\brain\\754bd979-2c00-4d79-ae0f-cfda45f084ce';
const LIVE_URL = 'https://mirari-henna.vercel.app';

async function verifyLive() {
  console.log('🌐 驗證 Vercel 線上正式環境:', LIVE_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. 首頁
    console.log('1. 訪問線上首頁...');
    await page.goto(`${LIVE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    const sec2 = page.locator('text=期刊解讀').first();
    await sec2.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ 線上首頁「期刊解讀」板塊已上線');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-journal-homepage-production.png') });

    // 2. /journal 頁
    console.log('2. 訪問線上 /journal 頁面...');
    await page.goto(`${LIVE_URL}/journal`, { waitUntil: 'networkidle', timeout: 30000 });
    const heading = page.locator('h1:has-text("期刊解讀")');
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    const count = await page.locator('article').count();
    console.log(`✓ 線上 /journal 頁面成功列出 ${count} 篇最新期刊解讀文章`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-journal-page-production.png'), fullPage: true });

    // 3. 文章 1
    console.log('3. 訪問線上文章 1 (杏仁核)...');
    await page.goto(`${LIVE_URL}/articles/amygdala-memory-encoding-success`, { waitUntil: 'networkidle', timeout: 30000 });
    const sim1 = page.locator('text=人腦杏仁核單神經元：刺激選擇性發火與情節記憶編碼示範').first();
    await sim1.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ 線上文章 1 互動實驗 (AmygdalaMemorySimulator) 正常載入');

    // 4. 文章 2
    console.log('4. 訪問線上文章 2 (硫化鉍)...');
    await page.goto(`${LIVE_URL}/articles/bismuth-sulfide-pseudo-direct-recombination`, { waitUntil: 'networkidle', timeout: 30000 });
    const sim2 = page.locator('text=硫化鉍擬直接能隙：強光吸收與延遲電荷復合之物理機制').first();
    await sim2.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ 線上文章 2 互動實驗 (PhotovoltaicRecombinationSimulator) 正常載入');

    // 5. 文章 3
    console.log('5. 訪問線上文章 3 (釷-229)...');
    await page.goto(`${LIVE_URL}/articles/thorium-229-nuclear-clock-laser`, { waitUntil: 'networkidle', timeout: 30000 });
    const sim3 = page.locator('text=釷-229 光學核時鐘：同質異能共振與雷射鎖定閉環實驗').first();
    await sim3.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ 線上文章 3 互動實驗 (NuclearClockSimulator) 正常載入');

    console.log('🎉 Vercel 正式線上部署驗收全部 100% 通過！');
  } catch (err) {
    console.error('線上驗收失敗:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyLive();
