const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, '.mirari-cache', 'markdown-verification');
const BASE_URL = process.env.MARKDOWN_BASE_URL || 'http://127.0.0.1:5173';

// Run against a dev server or production preview. PLAYWRIGHT_CHANNEL and
// PLAYWRIGHT_EXECUTABLE_PATH select an installed browser when needed.
// Reports and failure screenshots stay in the project's ignored cache directory.
function plainText(text) {
  return text
    .replace(/\$\$[\s\S]*?\$\$|\$[^$]+\$/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, '');
}

function expectations(article) {
  const body = article.sections.flatMap((section) => section.paragraphs).join('\n\n');
  const lines = body.split(/\r?\n/);
  return {
    headings: lines.flatMap((line) => {
      const match = line.match(/^(#{3,6})\s+(.+)$/);
      return match ? [{ level: match[1].length, text: plainText(match[2]) }] : [];
    }),
    ordered: lines.filter((line) => /^\s*\d+\.\s+/.test(line)).map((line) => plainText(line.replace(/^\s*\d+\.\s+/, ''))),
    unordered: lines.filter((line) => /^\s*[-*+]\s+/.test(line)).map((line) => plainText(line.replace(/^\s*[-*+]\s+/, ''))),
    quotes: lines.filter((line) => /^\s*>\s?/.test(line)).map((line) => plainText(line.replace(/^\s*>\s?/, ''))).filter(Boolean),
    links: [...body.matchAll(/\[([^\]]+)\]\(([^\s)]+)\)/g)].map((match) => ({ text: plainText(match[1]), href: match[2] })),
    formulas: [
      ...article.sections.flatMap((section) => section.formulas).map((formula) => formula.slice(2, -2).trim()),
      ...[body, article.quoteLead || ''].flatMap((text) => [...text.matchAll(/(?<![\\$])\$(?!\$)([^$]+?)\$(?!\$)/g)].map((match) => match[1].trim())),
    ],
    simulators: article.sections.filter((section) => section.interactiveComponentId),
  };
}

async function renderedText(locator) {
  return locator.evaluateAll((nodes) => nodes.map((node) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.katex').forEach((math) => math.remove());
    return clone.textContent;
  }));
}

async function verifyPage(page, article, expected) {
  await page.goto(new URL('/articles/' + article.slug, BASE_URL).href, { waitUntil: 'load', timeout: 30000 });
  await page.getByRole('heading', { level: 1, name: article.title, exact: true }).waitFor();
  // Sentence spans are created by the React renderer, rather than the static shell.
  const anchor = article.sections.flatMap((section) => section.sentences)
    .find((sentence) => /[\p{L}\p{N}]/u.test(sentence.exactQuote));
  assert.ok(anchor, 'Manifest has no sentence anchors');
  await page.locator('article [id="' + anchor.sentenceId + '"]').waitFor();
  const body = page.locator('article');

  for (const section of article.sections) {
    const heading = body.locator('[id="' + section.id + '"] > h2');
    assert.equal(await heading.count(), 1, 'Section heading missing: ' + section.title);
    assert.equal(plainText(await heading.innerText()), plainText(section.title));
  }
  for (const heading of expected.headings) {
    const actual = (await renderedText(body.locator('h' + heading.level))).map(plainText);
    assert.ok(actual.includes(heading.text), 'Markdown heading missing: ' + heading.text);
  }

  for (const [kind, selector] of [['ordered', 'section[id] ol > li'], ['unordered', 'section[id] ul > li']]) {
    const items = (await renderedText(body.locator(selector))).map(plainText);
    for (const expectedItem of expected[kind]) {
      assert.ok(items.some((item) => item.includes(expectedItem)), kind + ' list item missing: ' + expectedItem);
    }
  }

  const formulas = await body.locator('.katex annotation[encoding="application/x-tex"]').allTextContents();
  for (const formula of expected.formulas) {
    assert.ok(formulas.some((rendered) => rendered.replace(/\s/g, '') === formula.replace(/\s/g, '')),
      'Formula did not render as KaTeX: ' + formula);
  }
  assert.equal(await body.locator('.katex-error').count(), 0, 'KaTeX reported an invalid formula');
  const quotes = (await renderedText(body.locator('blockquote'))).map(plainText);
  for (const quote of expected.quotes) {
    assert.ok(quotes.some((text) => text.includes(quote)), 'Blockquote missing: ' + quote);
  }
  const links = await body.locator('a').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, href: node.getAttribute('href') })));
  for (const link of expected.links) {
    assert.ok(links.some((node) => plainText(node.text) === link.text && node.href === link.href),
      'Markdown link missing or incorrect: ' + link.href);
  }

  // textContent omits browser-generated list counters and KaTeX annotations.
  const rawBlocks = await body.locator('section[id] p, section[id] li, section[id] h2, section[id] h3, section[id] blockquote').evaluateAll((nodes) => nodes.flatMap((node) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.katex, code').forEach((child) => child.remove());
    const text = clone.textContent.trim();
    const rawBlock = /^(?:#{1,6}|>)\s/.test(text) ||
      (['P', 'LI'].includes(node.tagName) && /^(?:\d+\.|[-*+])\s/.test(text));
    return rawBlock || text.includes('**') ? [text.slice(0, 120)] : [];
  }));
  assert.deepEqual(rawBlocks, [], 'Raw Markdown markers remain in article blocks');
  for (const sentence of article.sections.flatMap((section) => section.sentences)) {
    if (!/[\p{L}\p{N}]/u.test(sentence.exactQuote)) continue;
    assert.equal(await body.locator('[id="' + sentence.sentenceId + '"]').count(), 1,
      'Sentence anchor missing or duplicated: ' + sentence.sentenceId);
  }

  for (const section of expected.simulators) {
    const simulator = body.locator('[id="' + section.id + '"]');
    const canvas = simulator.locator('canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction((sectionId) => {
      return [...document.getElementById(sectionId).querySelectorAll('canvas')].some((node) => {
        if (!node.width || !node.height) return false;
        const context = node.getContext('2d');
        if (!context) return false;
        const pixels = context.getImageData(0, 0, node.width, node.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
      });
    }, section.id);
    const slider = simulator.locator('input[type="range"]:enabled').first();
    if (await slider.count()) {
      const before = await slider.inputValue();
      const textBefore = await simulator.innerText();
      const key = await slider.evaluate((node) => Number(node.value) < Number(node.max) ? 'ArrowRight' : 'ArrowLeft');
      await slider.focus();
      await slider.press(key);
      assert.notEqual(await slider.inputValue(), before, 'Simulator slider did not move');
      assert.notEqual(await simulator.innerText(), textBefore, 'Simulator did not update after input');
    } else {
      const button = simulator.getByRole('button').filter({ visible: true }).first();
      assert.ok(await button.count(), 'Simulator has no usable control');
      const before = await simulator.innerHTML();
      await button.click();
      assert.notEqual(await simulator.innerHTML(), before, 'Simulator did not react to a control');
    }
  }

  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'Full-page horizontal overflow');
  return {
    headings: article.sections.length + expected.headings.length,
    lists: expected.ordered.length + expected.unordered.length,
    formulas: expected.formulas.length,
    quotes: expected.quotes.length,
    links: expected.links.length,
    simulators: expected.simulators.map((section) => section.interactiveComponentId),
  };
}

async function runVerification() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const { isArticlePublished } = await import('../src/utils/date.ts');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/generated/articles-manifest.json'), 'utf8'));
  const articles = manifest.filter((article) => isArticlePublished(article));
  assert.ok(articles.length, 'No published articles in the manifest');
  const report = { baseUrl: BASE_URL, status: 'unverified', results: [] };
  const saveReport = () => fs.writeFileSync(path.join(ARTIFACT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    });
    for (const article of articles) {
      const expected = expectations(article);
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, isMobile: viewport.width < 640, hasTouch: viewport.width < 640, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        let checks;
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          checks = await verifyPage(page, article, expected);
          assert.deepEqual(errors, [], 'Page raised a runtime error');
          report.results.push({ slug: article.slug, width: viewport.width, status: 'passed', checks });
          console.log('PASS', viewport.width, article.slug, JSON.stringify(checks));
        } catch (error) {
          report.results.push({ slug: article.slug, width: viewport.width, status: 'failed', checks, error: error.message, runtimeErrors: [...new Set(errors)] });
          console.error('FAIL', viewport.width, article.slug, error.message);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, article.slug + '-' + viewport.width + '.png'), fullPage: false }).catch(() => {});
        } finally {
          await context.close();
          saveReport();
        }
      }
    }
    report.status = report.results.some((result) => result.status === 'failed') ? 'failed' : 'passed';
    if (report.status !== 'passed') process.exitCode = 1;
    console.log('Markdown browser verification:', report.status, report.results.length, 'pages');
  } catch (error) {
    report.error = error.message;
    console.error('實際瀏覽器驗收未驗證:', error.message);
    process.exitCode = 1;
  } finally {
    saveReport();
    if (browser) await browser.close();
  }
}

runVerification().catch((error) => {
  console.error('Markdown verification failed:', error);
  process.exitCode = 1;
});
