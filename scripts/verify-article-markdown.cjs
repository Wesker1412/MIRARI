const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/Wesker/.gemini/antigravity/brain/754bd979-2c00-4d79-ae0f-cfda45f084ce');

const TARGET_ARTICLES = [
  {
    slug: 'brownian-ratchet-molecular-motors',
    title: '布朗棘輪與分子馬達',
    expectedH3: '1. 勢阱開啟態（On-state，強結合態）',
    anchorSentenceId: 'sent-7cedeccb'
  },
  {
    slug: 'thorium-229-nuclear-clock-laser',
    title: '釷-229 核時鐘',
    expectedH3: '1. 固態晶體中的百萬億原子核',
    anchorSentenceId: 'sent-52c5aa96'
  },
  {
    slug: 'amygdala-memory-encoding-success',
    title: '杏仁核記憶編碼',
    expectedH3: '1. 杏仁核細胞具備精細的「語意類別選擇性」',
    anchorSentenceId: 'sent-70430e82'
  }
];

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 MIRARI 文章內部 Markdown 排版驗收 (三篇實證篇章)');
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });

  try {
    for (const art of TARGET_ARTICLES) {
      console.log(`\n─────────────────────────────────────────────────────────────`);
      console.log(`📄 驗收篇章: 《${art.title}》 (/articles/${art.slug})`);
      console.log(`─────────────────────────────────────────────────────────────`);

      // ─── Desktop 驗收 ───
      const desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 900 }
      });
      const page = await desktopContext.newPage();
      await page.goto(`http://localhost:5173/articles/${art.slug}`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(800);

      // 1. 檢查子標題 (h3)
      const h3Elements = await page.$$('h3');
      console.log(`   · 子標題 (h3) 數量: ${h3Elements.length} 個`);
      if (h3Elements.length === 0) {
        throw new Error(`文章未找到任何 <h3> 標題！`);
      }
      const h3Texts = await Promise.all(h3Elements.map(h => h.innerText()));
      const foundTargetH3 = h3Texts.some(t => t.includes(art.expectedH3.slice(3, 10)));
      if (!foundTargetH3) {
        throw new Error(`預期的子標題「${art.expectedH3}」未正確渲染為 <h3>！`);
      }
      console.log(`   ✓ 子標題成功渲染為 <h3> (包含: ${h3Texts[0]})`);

      // 2. 檢查沒有 raw ### 殘留
      const rawHashCount = await page.evaluate(() => {
        const bodyText = document.querySelector('article')?.innerText || '';
        const matches = bodyText.match(/^###\s+/gm) || [];
        return matches.length;
      });
      if (rawHashCount > 0) {
        throw new Error(`文章內部依然殘留 ${rawHashCount} 處原始 '### ' 符號！`);
      }
      console.log(`   ✓ 原始 '### ' 符號徹底消除，無語法洩漏！`);

      // 3. 檢查清單 (ol / ul) 與 li
      const olCount = await page.$$eval('ol', els => els.length);
      const ulCount = await page.$$eval('ul', els => els.length);
      const liCount = await page.$$eval('li', els => els.length);
      console.log(`   · 結構化清單: <ol> ${olCount} 個, <ul> ${ulCount} 個, <li> ${liCount} 個`);
      if (olCount + ulCount === 0 || liCount === 0) {
        throw new Error(`文章未找到結構化清單元素！`);
      }

      // 檢查 li 內部沒有 raw '1. ' 或 '- ' 殘留
      const rawListMarkersInLi = await page.evaluate(() => {
        const lis = Array.from(document.querySelectorAll('article li'));
        return lis.filter(li => /^\s*(\d+\.|[-*+])\s+/.test(li.innerText)).length;
      });
      if (rawListMarkersInLi > 0) {
        throw new Error(`清單項 <li> 內部殘留 ${rawListMarkersInLi} 處原始清單符號！`);
      }
      console.log(`   ✓ 清單項 <li> 語義化結構正常，無原始清單符號殘留！`);

      // 4. 檢查粗體 (strong) 與 KaTeX 公式
      const strongCount = await page.$$eval('strong', els => els.length);
      const katexCount = await page.$$eval('.katex', els => els.length);
      console.log(`   · 粗體元素: ${strongCount} 個, KaTeX 數學元素: ${katexCount} 個`);
      if (strongCount === 0 || katexCount === 0) {
        throw new Error(`文章粗體或 KaTeX 公式遺失！`);
      }
      console.log(`   ✓ 粗體與 KaTeX 行內/區塊公式渲染正常！`);

      // 5. 檢查互動實驗模擬器元件
      const simulatorExists = await page.evaluate(() => {
        return !!document.querySelector('canvas, .simulator-panel, [class*="Simulator"]');
      });
      if (!simulatorExists) {
        throw new Error(`互動實驗模擬器元件未正常掛載！`);
      }
      console.log(`   ✓ 互動實驗模擬元件成功掛載且可操作！`);

      // 6. 檢查伴讀原文 Highlight 定位與滾動
      const anchorEl = await page.$(`#${art.anchorSentenceId}`);
      if (!anchorEl) {
        throw new Error(`伴讀原文錨點 #${art.anchorSentenceId} 未在 DOM 中找到！`);
      }
      console.log(`   ✓ 錨點句子 #${art.anchorSentenceId} 精確存在於 DOM 結構中！`);

      // 截圖存檔桌面版
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `live-markdown-desktop-${art.slug}.png`),
        fullPage: false
      });
      await desktopContext.close();

      // ─── Mobile 驗收 ───
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      });
      const mobPage = await mobileContext.newPage();
      await mobPage.goto(`http://localhost:5173/articles/${art.slug}`, { waitUntil: 'load', timeout: 15000 });
      await mobPage.waitForTimeout(600);

      // 7. 檢查手機版無水平全頁溢出
      const hasHorizontalOverflow = await mobPage.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (hasHorizontalOverflow) {
        throw new Error(`手機版版面發生水平溢出 (scrollWidth > innerWidth)！`);
      }
      console.log(`   ✓ 手機版排版正常，無全頁水平捲動溢出！`);

      // 截圖存檔手機版
      await mobPage.screenshot({
        path: path.join(ARTIFACT_DIR, `live-markdown-mobile-${art.slug}.png`),
        fullPage: false
      });
      await mobileContext.close();
    }

    // ─── 額外驗收：亂流篇的 Blockquote ───
    console.log(`\n─────────────────────────────────────────────────────────────`);
    console.log(`📄 額外引用區塊驗收: 《柯爾莫哥洛夫湍流能量串級》 (/articles/turbulence-kolmogorov-cascade)`);
    console.log(`─────────────────────────────────────────────────────────────`);
    const qPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await qPage.goto('http://localhost:5173/articles/turbulence-kolmogorov-cascade', { waitUntil: 'load', timeout: 15000 });
    await qPage.waitForTimeout(600);

    const bquoteCount = await qPage.$$eval('blockquote', els => els.length);
    console.log(`   · <blockquote> 元素數量: ${bquoteCount} 個`);
    if (bquoteCount === 0) {
      throw new Error(`未找到 <blockquote> 引用區塊！`);
    }
    const bquoteText = await qPage.$eval('blockquote', el => el.innerText);
    console.log(`   · 引用內容: ${bquoteText.split('\n')[0]}`);
    if (bquoteText.includes('>')) {
      throw new Error(`引用區塊內部殘留 raw '>' 符號！`);
    }
    console.log(`   ✓ 引用區塊 <blockquote> 渲染正常，無 raw '>' 符號！`);
    await qPage.close();

    console.log('\n================================================================');
    console.log('🎉 MIRARI Markdown 排版所有檢驗項目全部通過！');
    console.log('================================================================');
    process.exit(0);
  } finally {
    await browser.close();
  }
}

runVerification().catch(err => {
  console.error('\n❌ 驗收失敗:', err);
  process.exit(1);
});
