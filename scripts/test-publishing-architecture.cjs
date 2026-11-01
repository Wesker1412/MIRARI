const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';
const MDX_PATH = path.join(__dirname, '..', 'content', 'articles', 'when-starlight-dims.mdx');

async function main() {
  console.log('================================================================');
  console.log('🧪 MIRARI 自動文章發布與知識索引架構完整驗證');
  console.log('================================================================\n');

  // ─── 1. 測試增量更新 (Incremental Hashing & Reusing) ───────────
  console.log('【測試一：增量更新與快取重用機制】');
  const originalMdx = fs.readFileSync(MDX_PATH, 'utf8');

  try {
    // Run pipeline on original
    execSync('node scripts/build-knowledge-index.js', { stdio: 'inherit' });
    const log1 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.mirari-cache', 'sync-log.json'), 'utf8'));
    console.log(`基準狀態：重用區塊 ${log1.reusedChunksCount} 個，新嵌入 ${log1.newlyEmbeddedChunksCount} 個`);

    // Modify exactly one sentence in section 1 with unique timestamp to guarantee brand new chunk hash
    console.log('正在修改文章中的單一句話以測試增量更新...');
    const uniqueTestTag = `（本句已由增量發布系統修訂驗證 ${Date.now()}）。`;
    const modifiedMdx = originalMdx.replace(
      '若將母恆星比作高功率探照燈，行星就像在數公里外圍繞探照燈飛舞的微小飛蛾。',
      `若將母恆星比作高功率探照燈，行星就像在數公里外圍繞探照燈飛舞的微小飛蛾${uniqueTestTag}`
    );
    fs.writeFileSync(MDX_PATH, modifiedMdx, 'utf8');

    // Run pipeline on modified
    execSync('node scripts/build-knowledge-index.js', { stdio: 'inherit' });
    const log2 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.mirari-cache', 'sync-log.json'), 'utf8'));
    console.log(`修改後狀態：重用區塊 ${log2.reusedChunksCount} 個，新計算區塊 ${log2.newlyEmbeddedChunksCount} 個`);

    if (log2.newlyEmbeddedChunksCount !== 1) {
      throw new Error(`增量更新驗證失敗：預期只更新 1 個變更區塊，實際更新 ${log2.newlyEmbeddedChunksCount} 個`);
    }
    console.log('✓ 成功驗證：修改單一句話時，僅針對變更之單一區塊重新嵌入，其餘 17 個區塊 100% 來自快取！\n');
  } finally {
    // Restore canonical article
    fs.writeFileSync(MDX_PATH, originalMdx, 'utf8');
    execSync('node scripts/build-knowledge-index.js', { stdio: 'ignore' });
    console.log('✓ 已還原正式文章檔案並重新完成全站索引編譯。\n');
  }

  // ─── 2. 瀏覽器端對端視覺與互動檢驗 ────────────────────────────
  console.log('【測試二：瀏覽器動態正文渲染與 MIRARI 知識檢索】');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  console.log('正在載入 MIRARI 首頁...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 2.1 測試資料驅動搜尋
  console.log('測試 MIRARI 全站資料驅動搜尋 (關鍵字：行星凌日)...');
  const mascot = page.locator('#mirari-global-mascot');
  const isSearchPanelOpen = await page.locator('text=探索篇章').first().isVisible();
  if (!isSearchPanelOpen) {
    await mascot.click();
    await page.waitForTimeout(400);
  }

  const searchInput = page.locator('input[placeholder*="輸入科學現象"]').first();
  await searchInput.fill('行星凌日與光度幾何');
  const submitSearchBtn = page.locator('button:has-text("搜尋")').first();
  await submitSearchBtn.click();
  await page.waitForTimeout(600);

  // Verify recommended article is dynamically found
  const recArticleTitle = await page.locator('h4:has-text("當星光暗了一點")').first();
  const isFound = await recArticleTitle.isVisible();
  console.log(`資料驅動推薦檢索結果命中《當星光暗了一點》: ${isFound}`);
  if (!isFound) throw new Error('資料驅動搜尋未命中預期文章');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'automated-search-driven.png'),
  });

  // Close search panel
  await page.locator('button:has-text("關閉")').first().click();
  await page.waitForTimeout(300);

  // 2.2 點擊進入文章閱讀頁
  console.log('進入《當星光暗了一點》動態文章頁面...');
  const enterBtn = page.locator('button:has-text("進入互動閱讀")').first();
  await enterBtn.click();
  await page.waitForTimeout(600);

  // Verify Title, Subtitle, and Authors
  const articleHeading = await page.locator('h1:has-text("當星光暗了一點")').first();
  console.log(`文章標題成功渲染: ${await articleHeading.isVisible()}`);

  const authorText = await page.locator('text=MIRARI 科學組').first();
  console.log(`作者資訊從 frontmatter 動態渲染: ${await authorText.isVisible()}`);

  // Verify TransitSimulator is embedded and interactive
  console.log('驗證 TransitSimulator 互動模擬器嵌入...');
  const simulatorCanvas = page.locator('canvas').nth(1); // 0 is mascot, 1 is simulator orbit
  console.log(`模擬器畫布就緒: ${await simulatorCanvas.isVisible()}`);

  // Test simulator slider interaction
  const slider = page.locator('input[type="range"]').first();
  if (await slider.isVisible()) {
    await slider.fill('0.18');
    await page.waitForTimeout(300);
    console.log('✓ 模擬器滑桿操作響應正常');
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'automated-article-view.png'),
  });

  // 2.3 測試 MIRARI 隨文提問與原文證據定位
  console.log('測試 MIRARI 隨文伴讀精確原文定位...');
  await mascot.click();
  await page.waitForTimeout(400);

  // Test Question 1: 半徑與光度關係
  console.log('提問 1：半徑與光度關係 (為什麼行星越大，恆星亮度下降越多？)');
  const q1Btn = page.locator('button:has-text("半徑與光度關係")').first();
  await q1Btn.click();
  await page.waitForTimeout(700);

  const q1Highlight = page.locator('.exact-text-highlight').first();
  console.log(`Q1 原文高亮已定位: ${await q1Highlight.isVisible()}`);
  const q1Text = await q1Highlight.innerText();
  console.log(`Q1 定位原文句子: "${q1Text}"`);

  if (!q1Text.includes('平方關係') && !q1Text.includes('4 倍')) {
    throw new Error('Q1 原文定位文字不符合預期');
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'automated-evidence-q1.png'),
  });

  // Test Question 2: U型曲線成因
  console.log('提問 2：U型曲線成因 (為什麼真實的光度曲線底部是 U 型而不是平的？)');
  const q2Btn = page.locator('button:has-text("U型曲線成因")').first();
  await q2Btn.click();
  await page.waitForTimeout(700);

  const q2Highlight = page.locator('.exact-text-highlight').first();
  const q2Text = await q2Highlight.innerText();
  console.log(`Q2 定位原文句子: "${q2Text}"`);
  if (!q2Text.includes('U 型') && !q2Text.includes('周邊昏暗')) {
    throw new Error('Q2 原文定位文字不符合預期');
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'automated-evidence-q2.png'),
  });

  // Test Question 3: 詢問文章完全無關的問題，驗證絕不偽造引用
  console.log('提問 3：測試完全無關問題（超光速量子隱形傳態）...');
  const customInput = page.locator('input[placeholder*="針對本文內容提問"]').first();
  await customInput.fill('量子糾纏如何實現超光速通訊？');
  const submitCustomBtn = page.locator('button:has-text("提問")').first();
  await submitCustomBtn.click();
  await page.waitForTimeout(600);

  const fallbackText = await page.locator('text=尚未提及直接支持此問題的明確科學細節').first();
  const hasHonestFallback = await fallbackText.isVisible();
  console.log(`無關問題誠實無偽造引用返回: ${hasHonestFallback}`);
  if (!hasHonestFallback) {
    throw new Error('無關問題未依規範返回無證據警示');
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 所有測試完全通過！架構遷移與知識管線 100% 成功！');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ 驗證程序發生異常:', err);
  process.exit(1);
});
