const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Wesker\\.gemini\\antigravity\\brain\\754bd979-2c00-4d79-ae0f-cfda45f084ce';
const BASE_URL = 'http://localhost:5173';

async function runVerification() {
  console.log('🚀 啟動 Playwright 驗證 MIRARI Phase 5 陪讀體驗精修...');
  const browser = await chromium.launch({ headless: true });

  try {
    // ══════════════════════════════════════════════════════════════════
    // 【測試 1：桌面版文章陪讀、真實文章 ID、白話解釋與去摘錄化】
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- 1. 測試桌面版文章陪讀 (動作電位篇) ---');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE_URL}/articles/action-potential-hodgkin-huxley`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 點擊吉祥物開啟面板
    const mascot = page.locator('#mirari-global-mascot');
    await mascot.click();
    await page.waitForTimeout(500);

    // 驗證面板已開啟
    const panel = page.locator('#mirari-floating-panel');
    await panel.waitFor({ state: 'visible' });
    console.log('✓ 吉祥物對話面板成功展開');

    // 驗證提問提示為當前文章專屬知識點，絕非寫死的系外行星問題
    const actionPotentialChip = page.locator('button:has-text("全或無定律")');
    await actionPotentialChip.waitFor({ state: 'visible' });
    console.log('✓ 成功偵測當前文章專屬提問提示: 「全或無定律」');

    // 點擊「全或無定律」提示提問
    await actionPotentialChip.click();
    await page.waitForTimeout(1000);

    // 驗證白話解釋內容
    const answerCard = page.locator('#mirari-floating-panel');
    const panelText = await answerCard.textContent();
    console.log('✓ 獲得 MIRARI 陪讀回答');
    
    // 驗證回答包含白話關鍵概念
    if (!panelText.includes('全或無定律') || !panelText.includes('-55 mV')) {
      throw new Error('回答未包含預期的全或無定律白話解釋');
    }
    console.log('✓ 白話解釋內容正確且自然');

    // 驗證已徹底移除原文引用引述區塊 (blockquote) 及虛構百分比 (0.9x 或 9x%)
    const blockquoteCount = await page.locator('#mirari-floating-panel blockquote').count();
    if (blockquoteCount !== 0) {
      throw new Error(`面板中仍存在 blockquote 引述區塊，未達去摘錄化要求`);
    }
    if (panelText.includes('信心度') || panelText.includes('% 信心')) {
      throw new Error('回答中仍包含虛構信心百分比');
    }
    console.log('✓ 成功移除 blockquote 引述區塊與虛構信心百分比');

    // 驗證文章原文句子已被標記高亮
    const highlightedSentence = page.locator('span.exact-text-highlight');
    await highlightedSentence.waitFor({ state: 'visible' });
    console.log('✓ 正文對應句子已成功標記高亮');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-companion-desktop-action-potential.png'),
    });

    // ══════════════════════════════════════════════════════════════════
    // 【測試 2：切換文章時清除前一篇狀態與標記，並載入新文章提問提示】
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- 2. 測試切換文章時狀態清除與上下文切換 (雙擺混沌篇) ---');
    await page.goto(`${BASE_URL}/articles/chaos-double-pendulum-lyapunov`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 驗證高亮標記已清除
    const oldHighlightCount = await page.locator('span.exact-text-highlight').count();
    if (oldHighlightCount !== 0) {
      throw new Error('切換文章後，前一篇的高亮標記未被完全清除');
    }
    console.log('✓ 切換文章後，前一篇的高亮標記已完全清除');

    // 重新點擊吉祥物展開
    await mascot.click();
    await page.waitForTimeout(500);

    // 驗證提問提示已更新為雙擺篇專屬知識點
    const chaosChip = page.locator('button:has-text("初值敏感性")');
    await chaosChip.waitFor({ state: 'visible' });
    console.log('✓ 提問提示已正確自動更新為雙擺專屬知識點: 「初值敏感性」');

    // ══════════════════════════════════════════════════════════════════
    // 【測試 3：無可靠依據時不編造回答】
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- 3. 測試無可靠依據時不編造回答 ---');
    const inputField = page.locator('#mirari-floating-panel input[type="text"]');
    await inputField.fill('請問台北明天會下大雨嗎？');
    const submitBtn = page.locator('#mirari-floating-panel button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(800);

    const fallbackText = await page.locator('#mirari-floating-panel').textContent();
    if (!fallbackText.includes('暫無法為這個問題提供可靠且具原文依據的解釋')) {
      throw new Error('無依據問題未顯示標準誠實告知訊息，可能存在假回答拼湊');
    }
    console.log('✓ 無可靠依據問題正確顯示誠實告知，未拼湊假回答');

    // ══════════════════════════════════════════════════════════════════
    // 【測試 4：手機閱讀優先 (Mobile UX)】
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- 4. 測試手機閱讀體驗 (Mobile Viewport 390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/articles/when-starlight-dims`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    // 驗證平時只顯示吉祥物，無遮擋畫面的面板
    const mobileMascot = mobilePage.locator('#mirari-global-mascot');
    await mobileMascot.waitFor({ state: 'visible' });
    const mobilePanelInitial = await mobilePage.locator('#mirari-floating-panel').count();
    if (mobilePanelInitial !== 0) {
      throw new Error('手機初始狀態不應預設展開大面板');
    }
    console.log('✓ 手機初始狀態純淨，僅保留吉祥物，無遮擋文章');

    // 點擊吉祥物開啟精簡提問抽屜
    await mobileMascot.click();
    await mobilePage.waitForTimeout(500);

    const transitChip = mobilePage.locator('button:has-text("半徑與深度平方關係")');
    await transitChip.waitFor({ state: 'visible' });
    console.log('✓ 手機精簡提問抽屜展開，呈現當前文章提問提示: 「半徑與深度平方關係」');

    // 點擊提示提問
    await transitChip.click();
    await mobilePage.waitForTimeout(1000);

    // 驗證大型輸入抽屜已自動收起
    const mobilePanelAfterSubmit = await mobilePage.locator('#mirari-floating-panel').count();
    if (mobilePanelAfterSubmit !== 0) {
      throw new Error('送出問題後未自動收起大型輸入抽屜');
    }
    console.log('✓ 送出提問後，大型輸入抽屜已自動收起');

    // 驗證正文已標記高亮且平滑定位
    const mobileHighlight = mobilePage.locator('span.exact-text-highlight');
    await mobileHighlight.waitFor({ state: 'visible' });
    console.log('✓ 手機正文句子成功高亮標記');

    // 驗證底部小型可關閉白話回答卡片呈現
    const mobileCompanionCard = mobilePage.locator('#mirari-mobile-companion-card');
    await mobileCompanionCard.waitFor({ state: 'visible' });
    const cardText = await mobileCompanionCard.textContent();
    console.log('✓ 底部小型白話陪讀卡片成功浮現:');
    if (!cardText.includes('MIRARI 白話陪讀') || !cardText.includes('平方關係')) {
      throw new Error('小型陪讀卡片未包含正確白話解讀');
    }

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'verified-companion-mobile-transit.png'),
    });

    // 點擊關閉按鈕 ✕
    const closeBtn = mobileCompanionCard.locator('button:has-text("✕")');
    await closeBtn.click();
    await mobilePage.waitForTimeout(500);

    const companionCardAfterClose = await mobilePage.locator('#mirari-mobile-companion-card').count();
    const highlightAfterClose = await mobilePage.locator('span.exact-text-highlight').count();
    if (companionCardAfterClose !== 0 || highlightAfterClose !== 0) {
      throw new Error('點擊 ✕ 後未正常關閉陪讀卡片或未清除標記');
    }
    console.log('✓ 點擊 ✕ 後成功關閉陪讀卡片並清除高亮標記');

    // ══════════════════════════════════════════════════════════════════
    // 【測試 5：驗證吉祥物全站單一實例與首頁/探索頁不受影響】
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- 5. 測試吉祥物單一實例與首頁/探索頁相容性 ---');
    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const mascotCount = await page.locator('#mirari-global-mascot').count();
    if (mascotCount !== 1) {
      throw new Error(`全站吉祥物實例數量異常: ${mascotCount}，預期 1 個`);
    }
    console.log('✓ 全站吉祥物實例唯一性驗證通過 (只有 1 個實例)');

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const homeSections = await page.locator('section').count();
    if (homeSections < 3) {
      throw new Error('首頁結構受影響');
    }
    console.log('✓ 首頁結構完整，未受任何影響');

    await browser.close();
    console.log('\n🎉 MIRARI Phase 5 文章陪讀體驗精修驗收全部 100% 通過！');
  } catch (err) {
    console.error('❌ 驗證過程出錯:', err);
    await browser.close();
    process.exit(1);
  }
}

runVerification();
