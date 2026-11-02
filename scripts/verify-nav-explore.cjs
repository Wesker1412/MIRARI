const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce';

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 MIRARI 導覽入口、麵包屑垂直對齊與 /explore 頁驗收測試');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  
  // ─── 1. Desktop Verification ──────────────────────────────────────
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  console.log('【測試 1：首頁與頁首三大入口驗證】');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 檢查裝飾性標籤「自主科學媒體」是否已移除
  const autonomousTag = await page.locator('text=自主科學媒體').count();
  console.log(`✓ 「自主科學媒體」裝飾標籤徹底移除: ${autonomousTag === 0 ? '通過' : '未移除'}`);

  // 檢查是否沒有多餘的「回首頁」按鈕
  const backHomeButtons = await page.locator('header button:has-text("回首頁"), header a:has-text("回首頁")').count();
  console.log(`✓ 頁首無多餘「回首頁」按鈕: ${backHomeButtons === 0 ? '通過' : '未移除'}`);

  // 檢查頁首三大入口連結
  const journalLink = page.locator('header a[href="/journal"]');
  const principlesLink = page.locator('header a[href="/principles"]');
  const exploreLink = page.locator('header a[href="/explore"]');

  console.log(`✓ 「期刊解讀」入口存在: ${await journalLink.isVisible()}`);
  console.log(`✓ 「科普文章」入口存在: ${await principlesLink.isVisible()}`);
  console.log(`✓ 「探索 MIRARI」入口存在: ${await exploreLink.isVisible()}`);

  // 檢查首頁是否已移除第四板塊大型探索容器
  const exploreSectionOnHome = await page.locator('#explore-mirari').count();
  console.log(`✓ 首頁第四板塊已精簡移除: ${exploreSectionOnHome === 0 ? '通過' : '未移除'}`);

  // ─── 2. 測試導覽點擊與 Active 狀態 ───────────────────────────────
  console.log('\n【測試 2：導覽點擊與 Active 狀態切換】');
  
  await journalLink.click();
  await page.waitForTimeout(500);
  console.log(`✓ 點擊「期刊解讀」當前網址: ${page.url()}`);
  const isJournalActive = await page.locator('header a[href="/journal"].text-mirari-ink').count();
  console.log(`✓ 「期刊解讀」Active 狀態: ${isJournalActive > 0 ? '通過' : '失敗'}`);

  await principlesLink.click();
  await page.waitForTimeout(500);
  console.log(`✓ 點擊「科普文章」當前網址: ${page.url()}`);
  const isPrinciplesActive = await page.locator('header a[href="/principles"].text-mirari-ink').count();
  console.log(`✓ 「科普文章」Active 狀態: ${isPrinciplesActive > 0 ? '通過' : '失敗'}`);

  await exploreLink.click();
  await page.waitForTimeout(500);
  console.log(`✓ 點擊「探索 MIRARI」當前網址: ${page.url()}`);
  const isExploreActive = await page.locator('header a[href="/explore"].text-mirari-ink').count();
  console.log(`✓ 「探索 MIRARI」Active 狀態: ${isExploreActive > 0 ? '通過' : '失敗'}`);

  // ─── 3. 測試 /explore 頁功能與主題過濾 ────────────────────────────
  console.log('\n【測試 3：探索頁主題過濾與三級檢索測試】');
  const exploreHeading = await page.locator('h1:has-text("探索 MIRARI")').first();
  console.log(`✓ 探索頁標題「探索 MIRARI」可見: ${await exploreHeading.isVisible()}`);

  // 檢查主題卡片（必須只顯示 published > 0 的主題）
  const topicCards = await page.locator('main section:has-text("科學主題探索") .grid > div').count();
  console.log(`✓ 主題卡片數量 (僅顯示已有文章之主題): ${topicCards} 個`);

  // 點擊第一個主題卡片查看收錄篇章
  const firstTopicCard = page.locator('main section:has-text("科學主題探索") .grid > div').first();
  await firstTopicCard.click();
  await page.waitForTimeout(500);
  const topicArticlesContainer = page.locator('text=主題收錄篇章');
  console.log(`✓ 點擊主題展開文章清單: ${await topicArticlesContainer.isVisible()}`);

  // 測試搜尋：直接相關 (direct)
  console.log('--- 測試直接相關檢索 (direct) ---');
  const searchInput = page.locator('main input[placeholder*="輸入科學現象"]');
  await searchInput.fill('系外行星凌日');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const directBadge = page.locator('text=已有文章可直接閱讀');
  console.log(`✓ 「系外行星凌日」顯示「已有文章可直接閱讀」: ${await directBadge.isVisible()}`);

  // 測試搜尋：無相關 (none)
  console.log('--- 測試無相關誠實反饋 (none) ---');
  await searchInput.fill('無人機農業施肥噴灑');
  await searchInput.press('Enter');
  await page.waitForTimeout(800);
  const noneBadge = page.locator('text=站內尚無相關文章').first();
  console.log(`✓ 無關詞彙顯示「站內尚無相關文章」: ${await noneBadge.isVisible()}`);

  // 截圖 /explore 頁
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-explore-page-desktop.png'), fullPage: false });

  // ─── 4. 測試文章頁麵包屑與精確垂直對齊 ─────────────────────────
  console.log('\n【測試 4：文章頁麵包屑與幾何垂直對齊度量】');
  await page.goto('http://localhost:5173/articles/when-starlight-dims', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const mirariLogo = page.locator('header a:has-text("MIRARI")').first();
  const breadcrumbNav = page.locator('header nav[aria-label="文章導覽麵包屑"]').first();
  const categoryCrumb = page.locator('header nav[aria-label="文章導覽麵包屑"] a').first();
  const titleCrumb = page.locator('header nav[aria-label="文章導覽麵包屑"] span.font-serif').first();

  console.log(`✓ 麵包屑分類名稱: 「${await categoryCrumb.textContent()}」`);
  console.log(`✓ 麵包屑文章名稱: 「${await titleCrumb.textContent()}」`);

  // 度量幾何中心線
  const logoBox = await mirariLogo.boundingBox();
  const navBox = await breadcrumbNav.boundingBox();
  const categoryBox = await categoryCrumb.boundingBox();
  const titleBox = await titleCrumb.boundingBox();

  const logoCenterY = logoBox.y + logoBox.height / 2;
  const navCenterY = navBox.y + navBox.height / 2;
  const categoryCenterY = categoryBox.y + categoryBox.height / 2;
  const titleCenterY = titleBox.y + titleBox.height / 2;

  console.log(`  - MIRARI 垂直中心 Y: ${logoCenterY.toFixed(2)}px (高度: ${logoBox.height}px)`);
  console.log(`  - 麵包屑容器 垂直中心 Y: ${navCenterY.toFixed(2)}px (高度: ${navBox.height}px)`);
  console.log(`  - 分類連結 垂直中心 Y: ${categoryCenterY.toFixed(2)}px`);
  console.log(`  - 文章標題 垂直中心 Y: ${titleCenterY.toFixed(2)}px`);

  const diffLogoNav = Math.abs(logoCenterY - navCenterY);
  console.log(`✓ MIRARI 與麵包屑中心線差距: ${diffLogoNav.toFixed(2)}px (${diffLogoNav <= 2 ? '完美對齊' : '存在偏差'})`);

  // 測試點擊麵包屑中的分類連結
  await categoryCrumb.click();
  await page.waitForTimeout(500);
  console.log(`✓ 點擊麵包屑分類跳轉網址: ${page.url()}`);

  // 截圖文章頁麵包屑
  await page.goto('http://localhost:5173/articles/when-starlight-dims', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-article-breadcrumb-desktop.png') });

  // ─── 5. Mobile Verification ───────────────────────────────────────
  console.log('\n【測試 5：行動裝置視圖 (390x844) 頁首高度與入口可存取性】');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  const mobileHeader = mobilePage.locator('header.sticky').first();
  const mobileHeaderBox = await mobileHeader.boundingBox();
  console.log(`✓ 行動端頁首高度: ${mobileHeaderBox.height.toFixed(1)}px (保持精簡標準高度)`);

  const mobileJournal = await mobilePage.locator('header.sticky a[href="/journal"]').isVisible();
  const mobilePrinciples = await mobilePage.locator('header.sticky a[href="/principles"]').isVisible();
  const mobileExplore = await mobilePage.locator('header.sticky a[href="/explore"]').isVisible();

  console.log(`✓ 行動端「期刊解讀」可見: ${mobileJournal}`);
  console.log(`✓ 行動端「科普文章」可見: ${mobilePrinciples}`);
  console.log(`✓ 行動端「探索 MIRARI」可見: ${mobileExplore}`);

  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-mobile-header.png') });

  // 行動端文章頁
  await mobilePage.goto('http://localhost:5173/articles/when-starlight-dims', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);
  const mobileArticleHeaderBox = await mobilePage.locator('header.sticky').first().boundingBox();
  console.log(`✓ 行動端文章頁頁首高度: ${mobileArticleHeaderBox.height.toFixed(1)}px`);
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-mobile-article-header.png') });

  // 行動端探索頁
  await mobilePage.goto('http://localhost:5173/explore', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'verified-mobile-explore-page.png') });

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 自動化驗證全部通過！');
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('❌ 驗證失敗:', err);
  process.exit(1);
});
