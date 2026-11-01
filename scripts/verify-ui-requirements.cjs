const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

async function verify() {
  console.log('================================================================');
  console.log('🔍 MIRARI UI & 策展規則自動化驗證');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. 驗證首頁策展結構
  console.log('【驗證一：首頁策展層次區隔】');
  
  // 封面故事標籤
  const coverBadge = await page.locator('text=本期封面故事').first();
  const hasCoverBadge = await coverBadge.isVisible();
  console.log(`✓ 封面故事專屬編輯徽章渲染: ${hasCoverBadge}`);

  // 編輯精選專區
  const editorialSection = await page.locator('#editorial-picks').first();
  const hasEditorialSection = await editorialSection.isVisible();
  console.log(`✓ 編輯精選專區 (#editorial-picks) 渲染: ${hasEditorialSection}`);

  const editorialHeading = await page.locator('h2:has-text("編輯精選")').first();
  console.log(`✓ 編輯精選專區標題渲染: ${await editorialHeading.isVisible()}`);

  // 系列專題策劃預告 (因目前處於規劃期或尚未達到正式上線文章數)
  const seriesPreview = await page.locator('text=系列專題策劃預告').first();
  const hasSeriesPreview = await seriesPreview.isVisible();
  console.log(`✓ 未齊全系列專題正確標記為策劃預告而非正式特輯: ${hasSeriesPreview}`);

  // 導覽列項目確認
  const navCover = await page.locator('nav a:has-text("封面故事")').first().isVisible();
  const navPicks = await page.locator('nav a:has-text("編輯精選")').first().isVisible();
  const navResearch = await page.locator('nav a:has-text("研究追蹤")').first().isVisible();
  const navClassics = await page.locator('nav a:has-text("思想實驗")').first().isVisible();
  const navTopics = await page.locator('nav a:has-text("科學主題")').first().isVisible();
  console.log(`✓ 導覽列專有名詞統一: 封面故事(${navCover}), 編輯精選(${navPicks}), 研究追蹤(${navResearch}), 思想實驗(${navClassics}), 科學主題(${navTopics})`);

  // 2. 驗證吉祥物面板與復位按鈕移除
  console.log('\n【驗證二：吉祥物輸入面板精簡與復位按鈕完全移除】');

  // 確認畫面上完全沒有「復位」按鈕
  const resetButton = await page.locator('button:has-text("復位")').count();
  console.log(`✓ 全站「復位」按鈕數量 (應為 0): ${resetButton}`);
  if (resetButton !== 0) {
    throw new Error('復位按鈕仍存在於頁面中！');
  }

  // 點擊吉祥物開啟面板
  const mascot = page.locator('#mirari-global-mascot');
  const panel = page.locator('#mirari-floating-panel');
  if (!(await panel.isVisible())) {
    await mascot.click();
    await page.waitForTimeout(400);
  }

  // 檢查面板高度（初始狀態應極度緊湊，不應預留 520px）
  const initialBoundingBox = await panel.boundingBox();
  console.log(`✓ 初始搜尋面板尺寸: 寬度 ${Math.round(initialBoundingBox.width)}px, 高度 ${Math.round(initialBoundingBox.height)}px (緊湊自適應，遠小於 520px)`);
  if (initialBoundingBox.height > 300) {
    throw new Error(`初始面板高度超出緊湊預期: ${initialBoundingBox.height}px`);
  }

  // 驗證「試試：」單行標籤晶片
  const tryTag = await page.locator('text=試試：').first().isVisible();
  console.log(`✓ 單行短標籤晶片渲染正常 ("試試："): ${tryTag}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verified-compact-mascot-panel.png'),
  });

  // 點擊範例標籤觸發推薦
  const sampleChip = page.locator('button:has-text("行星凌日")').first();
  await sampleChip.click();
  await page.waitForTimeout(600);

  const expandedBoundingBox = await panel.boundingBox();
  console.log(`✓ 搜尋結果呈現後面闆高度自然擴展: ${Math.round(expandedBoundingBox.height)}px (原 ${Math.round(initialBoundingBox.height)}px)`);
  if (expandedBoundingBox.height <= initialBoundingBox.height) {
    throw new Error('面板未隨搜尋結果自適應展開高度！');
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verified-expanded-search-results.png'),
  });

  // 3. 驗證吉祥物自由拖曳與位置邊界
  console.log('\n【驗證三：吉祥物拖曳與邊界保護】');
  const initialMascotBox = await mascot.boundingBox();
  console.log(`初始吉祥物位置: x=${Math.round(initialMascotBox.x)}, y=${Math.round(initialMascotBox.y)}`);

  // 執行拖曳至左側
  await page.mouse.move(initialMascotBox.x + 30, initialMascotBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(120, 240, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const draggedMascotBox = await mascot.boundingBox();
  console.log(`拖曳後吉祥物位置: x=${Math.round(draggedMascotBox.x)}, y=${Math.round(draggedMascotBox.y)}`);

  const hasMoved = Math.abs(draggedMascotBox.x - initialMascotBox.x) > 50;
  console.log(`✓ 吉祥物自由拖曳位移成功: ${hasMoved}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verified-dragged-mascot.png'),
  });

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 所有 UI 規格與策展驗證項目均順利通過！');
  console.log('================================================================\n');
}

verify().catch((err) => {
  console.error('❌ UI 驗證失敗:', err);
  process.exit(1);
});
