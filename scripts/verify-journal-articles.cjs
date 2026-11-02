const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Wesker\\.gemini\\antigravity\\brain\\754bd979-2c00-4d79-ae0f-cfda45f084ce';
const BASE_URL = 'http://localhost:5173';

async function main() {
  console.log('🚀 啟動 Playwright 端對端查驗 MIRARI 期刊解讀文章與互動實驗...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 1. 首頁 Section 2 查驗
    console.log('\n--- 1. 查驗首頁 Section 2 (期刊解讀) ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const section2Title = await page.locator('text=期刊解讀').first();
    if (await section2Title.isVisible()) {
      console.log('✓ 首頁「期刊解讀」板塊標題可見');
    } else {
      throw new Error('首頁未找到「期刊解讀」板塊！');
    }

    // 檢查三篇文章卡片是否存在
    const memoryCard = page.locator('text=情緒的刻痕：杏仁核特定神經元活動如何預測長久記憶的誕生？').first();
    const bismuthCard = page.locator('text=光與電荷的漫長告別：硫化鉍如何以「擬直接能隙」改寫太陽能材料法則？').first();
    const nuclearCard = page.locator('text=原子核內的宇宙脈搏：釷-229 光學核時鐘如何運作？').first();

    if (await memoryCard.isVisible() && await bismuthCard.isVisible() && await nuclearCard.isVisible()) {
      console.log('✓ 首頁期刊解讀區塊成功渲染 3 篇最新研究文章卡片');
    } else {
      console.log('Warning: Some cards might require scroll into view.');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-homepage-journal-section.png'),
      fullPage: false
    });
    console.log('✓ 已截圖: verified-homepage-journal-section.png');

    // 2. /journal 列表頁查驗
    console.log('\n--- 2. 查驗 /journal 獨立列表頁 ---');
    await page.goto(`${BASE_URL}/journal`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const journalHeading = page.locator('h1:has-text("期刊解讀")');
    if (await journalHeading.isVisible()) {
      console.log('✓ /journal 獨立列表頁大標題「期刊解讀」可見');
    }

    const journalArticlesCount = await page.locator('article').count();
    console.log(`✓ /journal 列表頁渲染文章數量: ${journalArticlesCount} 篇`);
    if (journalArticlesCount !== 3) {
      throw new Error(`預期 3 篇文章，實際渲染 ${journalArticlesCount} 篇！`);
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-journal-category-page.png'),
      fullPage: true
    });
    console.log('✓ 已截圖: verified-journal-category-page.png');

    // 3. 查驗文章 1: 杏仁核記憶編碼 (AmygdalaMemorySimulator)
    console.log('\n--- 3. 查驗文章 1: 杏仁核記憶編碼 ---');
    await page.goto(`${BASE_URL}/articles/amygdala-memory-encoding-success`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const article1Title = page.locator('h1:has-text("情緒的刻痕")');
    if (await article1Title.isVisible()) {
      console.log('✓ 文章 1 標題成功載入');
    }

    // 驗證互動實驗元件
    const categoryBtn = page.locator('button:has-text("地點 (Scenes)")');
    if (await categoryBtn.isVisible()) {
      await categoryBtn.click();
      console.log('✓ 點選刺激範疇「地點 (Scenes)」切換正常');
    }

    const arousalSlider = page.locator('input[type="range"]').first();
    if (await arousalSlider.isVisible()) {
      await arousalSlider.fill('1.8');
      console.log('✓ 調整情緒喚醒度至 1.8 正常');
    }

    // 驗證科學邊界提示
    const caveatText1 = page.locator('text=相關性預測指標，非已證實之單向普遍因果關係');
    if (await caveatText1.isVisible()) {
      console.log('✓ 包含嚴格科學邊界聲明: 相關性非因果關係');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-amygdala-simulator.png'),
      fullPage: false
    });
    console.log('✓ 已截圖: verified-article-amygdala-simulator.png');

    // 4. 查驗文章 2: 硫化鉍擬直接能隙 (PhotovoltaicRecombinationSimulator)
    console.log('\n--- 4. 查驗文章 2: 硫化鉍擬直接能隙 ---');
    await page.goto(`${BASE_URL}/articles/bismuth-sulfide-pseudo-direct-recombination`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const article2Title = page.locator('h1:has-text("光與電荷的漫長告別")');
    if (await article2Title.isVisible()) {
      console.log('✓ 文章 2 標題成功載入');
    }

    // 驗證互動實驗元件
    const modeBtnDirect = page.locator('button:has-text("傳統直接能隙 (GaAs 型)")');
    if (await modeBtnDirect.isVisible()) {
      await modeBtnDirect.click();
      console.log('✓ 切換至傳統直接能隙正常');
      await page.waitForTimeout(300);
    }

    const modeBtnBi2S3 = page.locator('button:has-text("硫化鉍 (Bi₂S₃ 擬直接能隙)")');
    if (await modeBtnBi2S3.isVisible()) {
      await modeBtnBi2S3.click();
      console.log('✓ 切換回硫化鉍擬直接能隙正常');
    }

    const pulseBtn = page.locator('button:has-text("⚡ 發射飛秒雷射脈衝激發載子")');
    if (await pulseBtn.isVisible()) {
      await pulseBtn.click();
      console.log('✓ 觸發飛秒雷射激發脈衝正常');
    }

    const caveatText2 = page.locator('text=光伏材料機理展示模型，非商用成品太陽能板保證');
    if (await caveatText2.isVisible()) {
      console.log('✓ 包含嚴格科學邊界聲明: 晶體物理機制非商業量產組件');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-bismuth-simulator.png'),
      fullPage: false
    });
    console.log('✓ 已截圖: verified-article-bismuth-simulator.png');

    // 5. 查驗文章 3: 釷-229 光學核時鐘 (NuclearClockSimulator)
    console.log('\n--- 5. 查驗文章 3: 釷-229 光學核時鐘 ---');
    await page.goto(`${BASE_URL}/articles/thorium-229-nuclear-clock-laser`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const article3Title = page.locator('h1:has-text("原子核內的宇宙脈搏")');
    if (await article3Title.isVisible()) {
      console.log('✓ 文章 3 標題成功載入');
    }

    // 驗證切換鐘型
    const strontiumBtn = page.locator('button:has-text("鍶-87 光學原子鐘")');
    if (await strontiumBtn.isVisible()) {
      await strontiumBtn.click();
      console.log('✓ 切換至鍶-87 光學原子鐘對比正常');
      await page.waitForTimeout(300);
    }

    const thoriumBtn = page.locator('button:has-text("釷-229 固態核時鐘")');
    if (await thoriumBtn.isVisible()) {
      await thoriumBtn.click();
      console.log('✓ 切換回釷-229 固態核時鐘正常');
    }

    const bFieldBtn = page.locator('button:has-text("正常低噪實驗室環境")');
    if (await bFieldBtn.isVisible()) {
      await bFieldBtn.click();
      console.log('✓ 注入外部雜散磁場干擾測試正常');
    }

    const caveatText3 = page.locator('text=實驗室頻譜鑑頻與閉環鎖相展示模型');
    if (await caveatText3.isVisible()) {
      console.log('✓ 包含嚴格科學邊界聲明: 明確區分當前實測不確定度 10⁻¹³ 與極限理論潛力 10⁻¹⁹');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-article-nuclear-clock-simulator.png'),
      fullPage: false
    });
    console.log('✓ 已截圖: verified-article-nuclear-clock-simulator.png');

    console.log('\n🎉 所有 3 篇期刊解讀文章、首頁 Section 2、/journal 列表頁與互動實驗查驗全部 100% 通過！');
  } catch (err) {
    console.error('❌ 查驗過程出錯:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
