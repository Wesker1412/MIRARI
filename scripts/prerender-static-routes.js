/**
 * MIRARI 靜態路由預渲染與 SEO 自動化生成管線
 *
 * 核心原則：
 * 1. 於 vite build 後自動執行，無需手動為每篇文章增添路由或 HTML。
 * 2. 產出純靜態 HTML（含獨立 title、meta description、canonical link、OG 標籤與結構化正文）。
 * 3. 搜尋引擎爬蟲、社群分享機器人或未啟用 JS 的客戶端可直接擷取完整文章正文與學術資訊。
 * 4. 具備 JavaScript 的客戶端載入後，React 19 與 Three.js 全站吉祥物無縫掛載接管。
 * 5. 全站 robots noindex 狀態集中自 src/config/site.ts 讀取，直接注入所有靜態預渲染檔案，而非僅依賴 client-side JS。
 * 6. Canonical Origin 集中配置，徹底消除硬編碼過期網址。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MANIFEST_PATH = path.join(ROOT_DIR, 'src', 'data', 'generated', 'articles-manifest.json');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const SITE_CONFIG_PATH = path.join(ROOT_DIR, 'src', 'config', 'site.ts');

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadSiteConfig() {
  let canonicalOrigin = 'https://mirari-henna.vercel.app';
  let preventIndexing = true;

  if (fs.existsSync(SITE_CONFIG_PATH)) {
    const siteTs = fs.readFileSync(SITE_CONFIG_PATH, 'utf8');
    const originMatch = siteTs.match(/canonicalOrigin:\s*['"]([^'"]+)['"]/);
    if (originMatch) {
      canonicalOrigin = originMatch[1].replace(/\/+$/, '');
    }
    const indexingMatch = siteTs.match(/preventIndexing:\s*(true|false)/);
    if (indexingMatch) {
      preventIndexing = indexingMatch[1] === 'true';
    }
  }

  return { canonicalOrigin, preventIndexing };
}

function generatePrerenderedHTML() {
  console.log('================================================================');
  console.log('📰 MIRARI 靜態文章預渲染與 SEO 建置管線');
  console.log('================================================================');

  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error(`❌ 未找到 dist/index.html，請先執行 vite build`);
    process.exit(1);
  }

  const { canonicalOrigin, preventIndexing } = loadSiteConfig();
  console.log(`🌐 網站來源 Canonical Origin: ${canonicalOrigin}`);
  console.log(`🤖 搜尋引擎收錄防護 Prevent Indexing: ${preventIndexing ? 'true (noindex, nofollow)' : 'false (index, follow)'}`);

  const robotsMetaTag = preventIndexing
    ? '<meta name="robots" content="noindex, nofollow" />'
    : '<meta name="robots" content="index, follow" />';

  let baseHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // 確保 dist/index.html 本體具備正確的 robots meta 與 canonical
  let rootIndexHtml = baseHtml;
  if (rootIndexHtml.includes('<meta name="robots"')) {
    rootIndexHtml = rootIndexHtml.replace(/<meta\s+name="robots"[^>]*>/i, robotsMetaTag);
  } else {
    rootIndexHtml = rootIndexHtml.replace('</head>', `    ${robotsMetaTag}\n  </head>`);
  }
  fs.writeFileSync(INDEX_HTML_PATH, rootIndexHtml, 'utf8');
  baseHtml = rootIndexHtml;

  const articles = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  let publishedPrerenderCount = 0;
  let unpublishedNoticeCount = 0;

  for (const article of articles) {
    const isPublished = article.status === 'published';
    const articleDir = path.join(DIST_DIR, 'articles', article.slug);
    ensureDir(articleDir);

    let pageTitle = '';
    let pageDesc = '';
    let ogType = 'website';
    let canonicalUrl = `${canonicalOrigin}/articles/${article.slug}`;
    let preRenderedBody = '';

    if (isPublished) {
      pageTitle = `${article.title} | MIRARI 數位科學雜誌`;
      pageDesc = article.summary || article.leadParagraph || '';
      ogType = 'article';

      // 構建結構化文章語意 HTML
      const authorsHtml = (article.authors && article.authors.length > 0)
        ? article.authors.map((a) => `<span>${escapeHtml(a.role)}／${escapeHtml(a.name)}</span>`).join(' · ')
        : '<span>MIRARI 科學組</span>';

      const sectionsHtml = (article.sections || [])
        .map((sec) => {
          const paragraphs = (sec.paragraphs || [])
            .map((p) => {
              if (p.startsWith('$$')) {
                return `<div class="mirari-formula-block py-2 font-mono text-center text-xs text-mirari-cobalt">${escapeHtml(p)}</div>`;
              }
              return `<p class="leading-relaxed font-serif text-base sm:text-lg text-mirari-ink mb-4">${escapeHtml(p)}</p>`;
            })
            .join('\n');

          return `
            <section class="mb-10">
              <h2 class="font-serif text-xl sm:text-2xl font-bold text-mirari-ink mb-4 pb-2 border-b border-mirari-line">${escapeHtml(sec.title)}</h2>
              <div class="space-y-4">
                ${paragraphs}
              </div>
            </section>
          `;
        })
        .join('\n');

      const referencesHtml = (article.references && article.references.length > 0)
        ? `
          <footer class="mt-12 pt-8 border-t border-mirari-line text-xs font-sans text-mirari-muted space-y-2">
            <h3 class="font-bold text-mirari-ink text-sm">參考文獻與實證資料來源：</h3>
            <ol class="list-decimal pl-5 space-y-1.5">
              ${article.references.map((r) => `<li>${escapeHtml(r.citation)}</li>`).join('\n')}
            </ol>
          </footer>
        `
        : '';

      preRenderedBody = `
        <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] pb-32">
          <header class="border-b border-[#e5e0d8] bg-[#fcfbf9]/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
            <a href="/" class="text-xs font-sans text-[#706c64] hover:text-[#1a1917] px-3 py-1.5 rounded-lg border border-[#e5e0d8]">返回首頁</a>
            <span class="font-serif text-sm font-semibold truncate max-w-md hidden sm:inline-block">${escapeHtml(article.title)}</span>
          </header>
          <main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
            <header class="space-y-4 pb-8 border-b border-[#e5e0d8]">
              <div class="flex items-center space-x-2 text-xs font-sans text-[#b87333]">
                <span class="font-semibold tracking-wider">科學專題</span>
                <span>·</span>
                <span>${escapeHtml(article.formatBadgeText || '深度特輯')}</span>
              </div>
              <h1 class="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1a1917] leading-[1.2]">${escapeHtml(article.title)}</h1>
              <p class="font-serif text-lg sm:text-xl text-[#706c64] font-normal leading-relaxed">${escapeHtml(article.subtitle)}</p>
              <div class="flex flex-wrap items-center justify-between pt-4 text-xs text-[#a09c94] border-t border-[#e5e0d8]/60">
                <div class="flex items-center space-x-3">${authorsHtml}</div>
                <span>${escapeHtml(article.formatBadgeText || '正式發布')}</span>
              </div>
            </header>
            <article class="mt-8">
              ${sectionsHtml}
            </article>
            ${referencesHtml}
          </main>
        </div>
      `;

      publishedPrerenderCount++;
    } else {
      // 未發布文章：僅生成籌備中保護頁面，杜絕草稿洩漏
      pageTitle = `《${article.title}》（籌備中）| MIRARI 數位科學雜誌`;
      pageDesc = article.summary || '本篇章尚處於學術同行評審與編輯部撰寫籌備中，尚未公開發布。';
      ogType = 'website';

      preRenderedBody = `
        <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] flex flex-col justify-between">
          <header class="border-b border-[#e5e0d8] bg-[#fcfbf9]/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
            <a href="/" class="text-xs font-sans text-[#706c64] px-3 py-1.5 rounded-lg border border-[#e5e0d8]">返回 MIRARI 首頁</a>
            <span class="font-serif text-sm font-semibold">MIRARI · 編輯籌備室</span>
          </header>
          <main class="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
            <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <span>學術審訂與籌備中 · 尚未公開發布</span>
            </div>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold leading-tight">《${escapeHtml(article.title)}》</h1>
            <p class="font-serif text-base text-[#706c64]">${escapeHtml(article.subtitle)}</p>
            <div class="p-6 rounded-2xl bg-white border border-[#e5e0d8] text-left text-xs text-[#706c64] leading-relaxed">
              <strong class="text-[#1a1917] block mb-1">篇章籌備說明：</strong>
              本篇章目前處於選題研究與同行審查階段，尚未通過發布審核。為維護科學媒體的嚴謹標準，MIRARI 不開放未發布草案的全文公開閱讀。
            </div>
            <div class="pt-4">
              <a href="/" class="inline-block px-6 py-3 rounded-xl bg-[#1a1917] text-white text-xs font-medium">返回雜誌首頁</a>
            </div>
          </main>
          <footer class="border-t border-[#e5e0d8] py-6 text-center text-xs text-[#a09c94]">
            © 2026 MIRARI 數位科學雜誌
          </footer>
        </div>
      `;

      unpublishedNoticeCount++;
    }

    // JSON-LD 結構化資料
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': isPublished ? 'ScholarlyArticle' : 'WebPage',
      headline: article.title,
      description: pageDesc,
      url: canonicalUrl,
      datePublished: article.publishedDate || '2026-11-02',
      publisher: {
        '@type': 'Organization',
        name: 'MIRARI',
        url: canonicalOrigin,
      },
      ...(isPublished && article.authors
        ? {
            author: article.authors.map((a) => ({
              '@type': 'Person',
              name: a.name,
              jobTitle: a.role,
            })),
          }
        : {}),
    };

    // 替換與注入 Head Meta
    let articleHtml = baseHtml;

    // 清除既有 meta
    articleHtml = articleHtml.replace(
      /<title>.*?<\/title>/i,
      `<title>${escapeHtml(pageTitle)}</title>`
    );
    articleHtml = articleHtml.replace(/<meta\s+name="description"[^>]*>/i, '');
    articleHtml = articleHtml.replace(/<meta\s+name="robots"[^>]*>/i, '');

    // 注入完整 Meta Tags (Robots, Canonical, Description, Open Graph, Twitter, JSON-LD)
    const metaTags = `
    ${robotsMetaTag}
    <meta name="description" content="${escapeHtml(pageDesc)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="MIRARI" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDesc)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${ogType}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDesc)}" />
    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
    </script>
  </head>`;

    articleHtml = articleHtml.replace('</head>', `${metaTags}`);

    // 注入預渲染 Body 至 #root
    articleHtml = articleHtml.replace(
      '<div id="root"></div>',
      `<div id="root">${preRenderedBody}</div>`
    );

    // 寫入檔案
    fs.writeFileSync(path.join(articleDir, 'index.html'), articleHtml, 'utf8');
    fs.writeFileSync(path.join(DIST_DIR, 'articles', `${article.slug}.html`), articleHtml, 'utf8');
  }

  // 生成系列專題靜態預渲染頁面
  const seriesList = [
    {
      id: 'series-habitable-worlds',
      slug: 'habitable-worlds-thirty-years',
      title: '尋找第二個地球：系外行星巡天三十年記',
      subtitle: '從飛馬座 51b 到宜居帶岩石行星，人類在銀河系尋找生命搖籃的壯麗歷程',
      description: '自 1995 年首顆主序星系外行星發現至今，三十年間人類從懷疑到證實銀河系處處皆有行星。本系列從觀測幾何、大氣分析到生命印記，系統性回顧並展望人類走出太陽系的科學視野。',
      status: 'planning',
      totalPlannedArticles: 4,
    },
  ];

  for (const series of seriesList) {
    const seriesDir = path.join(DIST_DIR, 'series', series.slug);
    ensureDir(seriesDir);

    const seriesTitle = `《${series.title}》系列專題 | MIRARI 數位科學雜誌`;
    const seriesDesc = series.description;
    const seriesCanonical = `${canonicalOrigin}/series/${escapeHtml(series.slug)}`;

    let seriesHtml = baseHtml;
    seriesHtml = seriesHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(seriesTitle)}</title>`);
    seriesHtml = seriesHtml.replace(/<meta\s+name="description"[^>]*>/i, '');
    seriesHtml = seriesHtml.replace(/<meta\s+name="robots"[^>]*>/i, '');

    const seriesMeta = `
    ${robotsMetaTag}
    <meta name="description" content="${escapeHtml(seriesDesc)}" />
    <link rel="canonical" href="${seriesCanonical}" />
    <meta property="og:site_name" content="MIRARI" />
    <meta property="og:title" content="${escapeHtml(seriesTitle)}" />
    <meta property="og:description" content="${escapeHtml(seriesDesc)}" />
    <meta property="og:url" content="${seriesCanonical}" />
  </head>`;
    seriesHtml = seriesHtml.replace('</head>', `${seriesMeta}`);

    const seriesBody = `
      <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] pb-24">
        <header class="border-b border-[#e5e0d8] bg-[#fcfbf9]/90 px-8 py-3.5 flex items-center justify-between">
          <a href="/" class="text-xs px-3 py-1.5 border border-[#e5e0d8] rounded-lg">返回首頁</a>
          <span class="font-serif text-sm font-semibold">系列特輯 · ${escapeHtml(series.title)}</span>
        </header>
        <main class="max-w-4xl mx-auto px-6 pt-14 space-y-8">
          <div class="space-y-3 pb-8 border-b border-[#e5e0d8]">
            <span class="text-xs font-semibold text-[#b87333]">系列專題策劃預告</span>
            <h1 class="font-serif text-4xl font-bold">${escapeHtml(series.title)}</h1>
            <p class="font-serif text-xl text-[#706c64]">${escapeHtml(series.subtitle)}</p>
            <p class="text-sm text-[#706c64] leading-relaxed">${escapeHtml(series.description)}</p>
          </div>
        </main>
      </div>
    `;
    seriesHtml = seriesHtml.replace('<div id="root"></div>', `<div id="root">${seriesBody}</div>`);
    fs.writeFileSync(path.join(seriesDir, 'index.html'), seriesHtml, 'utf8');
  }

  // 生成 404.html (適用於 Vercel / 靜態伺服器)
  let notFoundHtml = baseHtml
    .replace(/<title>.*?<\/title>/i, '<title>404 · 篇章坐標未找到 | MIRARI</title>');

  notFoundHtml = notFoundHtml.replace(/<meta\s+name="robots"[^>]*>/i, '');
  notFoundHtml = notFoundHtml.replace(
    '</head>',
    `    ${robotsMetaTag}\n  </head>`
  );
  notFoundHtml = notFoundHtml.replace(
    '<div id="root"></div>',
    `<div id="root">
      <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] flex flex-col justify-between">
        <header class="border-b border-[#e5e0d8] px-8 py-3.5"><a href="/" class="text-xs px-3 py-1.5 border border-[#e5e0d8] rounded">返回首頁</a></header>
        <main class="max-w-xl mx-auto py-20 text-center space-y-4">
          <h1 class="font-serif text-3xl font-bold">404 · 篇章坐標未找到</h1>
          <p class="text-sm text-[#706c64]">您所探尋的科學篇章坐標不存在或已重新編目。</p>
          <a href="/" class="inline-block px-5 py-2.5 bg-[#1a1917] text-white text-xs rounded-xl">返回首頁</a>
        </main>
        <footer class="py-6 text-center text-xs text-[#a09c94]">© 2026 MIRARI</footer>
      </div>
    </div>`
  );
  fs.writeFileSync(path.join(DIST_DIR, '404.html'), notFoundHtml, 'utf8');

  console.log(`✓ 已生成 ${publishedPrerenderCount} 篇正式發布文章之靜態 SEO 預渲染 HTML (含 robots noindex 與集中 Canonical)`);
  console.log(`✓ 已生成 ${unpublishedNoticeCount} 篇未發布文章之安全審訂保護頁面`);
  console.log(`✓ 已生成 dist/404.html 標準錯誤頁`);
  console.log('================================================================');
  console.log('🎉 靜態預渲染與 SEO 管線執行成功！');
  console.log('================================================================\n');
}

generatePrerenderedHTML();
