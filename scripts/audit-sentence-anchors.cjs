const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Normalizes text by removing LaTeX, Markdown syntax, punctuation, and whitespace
 * to allow semantic and textual comparison between canonical quotes and DOM content.
 */
function normalizeForComparison(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    // Remove LaTeX formulas
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[\s\S]*?\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    // Remove leading heading line if followed by body text, or strip heading prefix if standalone
    .replace(/^(#{1,6})\s+[^\r\n]*\r?\n(?=[\s\S])/g, '')
    .replace(/^(#{1,6})\s+/g, '')
    // Remove list markers at line start
    .replace(/^(\d+\.|[-*+])\s+/gm, '')
    // Remove blockquote prefix
    .replace(/^>\s*/gm, '')
    // Strip inline markdown (bold, italic, code, links)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove all whitespace, punctuation, and symbols for robust CJK/ASCII character comparison
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

async function auditSentenceAnchors() {
  const manifest = JSON.parse(fs.readFileSync('src/data/generated/articles-manifest.json', 'utf8'));
  const evidenceIndex = JSON.parse(fs.readFileSync('src/data/generated/evidence-index.json', 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let totalChecked = 0;
  let totalMissing = 0;
  let totalDuplicate = 0;
  let totalTextMismatch = 0;
  let exactMatchCount = 0;
  let containmentMatchCount = 0;
  const issues = [];

  console.log('================================================================');
  console.log('🔍 MIRARI 10 篇文章句子錨點完整性與文字正規化內容全面審查');
  console.log('================================================================\n');

  for (const art of manifest) {
    const artEvidence = evidenceIndex[art.id] || [];
    console.log(`正在檢驗篇章: 《${art.title}》 (${art.slug}) - 應有句子數: ${artEvidence.length}`);

    await page.goto(`http://localhost:5173/articles/${art.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);

    const validSents = artEvidence.filter(s => /[\p{L}\p{N}]/u.test(s.exactQuote));

    // Batch query DOM elements for this article with KaTeX stripped from clone
    const pageData = await page.evaluate((ids) => {
      const data = {};
      for (const id of ids) {
        const els = document.querySelectorAll('#' + id);
        if (els.length === 0) {
          data[id] = { count: 0 };
        } else {
          const el = els[0];
          const clone = el.cloneNode(true);
          // Strip KaTeX rendered markup so internal MathML/HTML does not pollute textual verification
          clone.querySelectorAll('.katex').forEach(k => k.remove());
          data[id] = {
            count: els.length,
            domCleanText: clone.textContent || '',
          };
        }
      }
      return data;
    }, validSents.map(s => s.sentenceId));

    for (const sent of validSents) {
      totalChecked++;
      const id = sent.sentenceId;
      const d = pageData[id] || { count: 0 };

      if (d.count === 0) {
        totalMissing++;
        issues.push({
          type: 'MISSING',
          articleSlug: art.slug,
          sentenceId: id,
          quote: sent.exactQuote,
          contextNote: sent.contextNote,
        });
      } else if (d.count > 1) {
        totalDuplicate++;
        issues.push({
          type: 'DUPLICATE',
          articleSlug: art.slug,
          sentenceId: id,
          count: d.count,
          quote: sent.exactQuote,
          contextNote: sent.contextNote,
        });
      } else {
        const normQuote = normalizeForComparison(sent.exactQuote);
        const normDom = normalizeForComparison(d.domCleanText);

        if (!normDom || normDom.length === 0) {
          totalTextMismatch++;
          issues.push({
            type: 'EMPTY_DOM',
            articleSlug: art.slug,
            sentenceId: id,
            quote: sent.exactQuote,
          });
        } else if (normQuote === normDom) {
          exactMatchCount++;
        } else if (normQuote.includes(normDom) || normDom.includes(normQuote)) {
          // Valid structural containment (e.g. composite sentence spanning lead-in and list item)
          containmentMatchCount++;
        } else {
          totalTextMismatch++;
          issues.push({
            type: 'TEXT_MISMATCH',
            articleSlug: art.slug,
            sentenceId: id,
            quote: sent.exactQuote,
            domText: d.domCleanText,
            normQuote,
            normDom,
            contextNote: sent.contextNote,
          });
        }
      }
    }
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('📊 審查總結報告:');
  console.log(`總檢驗句子數: ${totalChecked}`);
  console.log(`完整完全匹配數 (EXACT): ${exactMatchCount}`);
  console.log(`合規包含匹配數 (CONTAINMENT): ${containmentMatchCount}`);
  console.log(`缺漏句子數 (MISSING): ${totalMissing}`);
  console.log(`重複 ID 數 (DUPLICATE): ${totalDuplicate}`);
  console.log(`文字不符數 (MISMATCH): ${totalTextMismatch}`);
  console.log('================================================================');

  if (issues.length > 0) {
    console.error(`\n❌ 發現 ${issues.length} 個異常項目:`);
    for (let i = 0; i < issues.length; i++) {
      const it = issues[i];
      console.error(`[#${i + 1}] [${it.type}] ${it.articleSlug} - ${it.sentenceId}`);
      if (it.contextNote) console.error(`     情境: ${it.contextNote}`);
      console.error(`     引文: ${it.quote.slice(0, 70).replace(/\n/g, '\\n')}`);
      if (it.domText) {
        console.error(`     DOM:  ${it.domText.slice(0, 70).replace(/\n/g, '\\n')}`);
      }
    }
    // Fail test with non-zero exit code as required
    process.exit(1);
  } else {
    console.log('🎉 100% 句子錨點完整對應，無任何缺漏、重複或文字不符！');
    process.exit(0);
  }
}

auditSentenceAnchors().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
