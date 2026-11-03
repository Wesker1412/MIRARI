const { chromium } = require('playwright');
const fs = require('fs');

async function auditSentenceAnchors() {
  const manifest = JSON.parse(fs.readFileSync('src/data/generated/articles-manifest.json', 'utf8'));
  const evidenceIndex = JSON.parse(fs.readFileSync('src/data/generated/evidence-index.json', 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let totalChecked = 0;
  let totalMissing = 0;
  let totalDuplicate = 0;
  let totalTextMismatch = 0;
  const issues = [];

  console.log('================================================================');
  console.log('🔍 MIRARI 10 篇文章句子錨點完整性全面審查');
  console.log('================================================================\n');

  for (const art of manifest) {
    const artEvidence = evidenceIndex[art.id] || [];
    console.log(`正在檢驗篇章: 《${art.title}》 (${art.slug}) - 應有句子數: ${artEvidence.length}`);

    await page.goto(`http://localhost:5173/articles/${art.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    for (const sent of artEvidence) {
      // Delimiter residual tokens like '**' have no text content and are absorbed into bold delimiters
      const isPureDelimiter = !/[\p{L}\p{N}]/u.test(sent.exactQuote);
      if (isPureDelimiter) continue;

      totalChecked++;
      const id = sent.sentenceId;

      const elements = await page.$$(`#${id}`);
      if (elements.length === 0) {
        totalMissing++;
        issues.push({
          type: 'MISSING',
          articleSlug: art.slug,
          articleTitle: art.title,
          sentenceId: id,
          quote: sent.exactQuote,
          contextNote: sent.contextNote,
        });
      } else if (elements.length > 1) {
        totalDuplicate++;
        issues.push({
          type: 'DUPLICATE',
          articleSlug: art.slug,
          articleTitle: art.title,
          sentenceId: id,
          count: elements.length,
          quote: sent.exactQuote,
          contextNote: sent.contextNote,
        });
      } else {
        const text = (await elements[0].textContent()) || '';
        const cleanDomText = text.replace(/\s+/g, ' ').trim();
        if (cleanDomText.length === 0) {
          totalTextMismatch++;
          issues.push({
            type: 'EMPTY_DOM',
            articleSlug: art.slug,
            sentenceId: id,
            quote: sent.exactQuote,
          });
        }
      }
    }
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('📊 審查總結報告:');
  console.log(`總檢驗句子數: ${totalChecked}`);
  console.log(`缺漏句子數 (MISSING): ${totalMissing}`);
  console.log(`重複 ID 數 (DUPLICATE): ${totalDuplicate}`);
  console.log(`文字為空數 (EMPTY_DOM): ${totalTextMismatch}`);
  console.log('================================================================');

  if (issues.length > 0) {
    console.log(`\n發現 ${issues.length} 個異常項目:`);
    for (let i = 0; i < issues.length; i++) {
      const it = issues[i];
      console.log(`[#${i + 1}] [${it.type}] ${it.articleSlug} - ${it.sentenceId}`);
      console.log(`     情境: ${it.contextNote || ''}`);
      console.log(`     引文: ${it.quote.slice(0, 70).replace(/\n/g, '\\n')}`);
    }
  } else {
    console.log('🎉 100% 句子錨點完整對應，無任何缺漏或重複！');
  }

  process.exit(0);
}

auditSentenceAnchors().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
