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

  const publishedArticles = articles.filter((a) => a.status === 'published');
  let publishedPrerenderCount = 0;

  for (const article of publishedArticles) {
    const articleDir = path.join(DIST_DIR, 'articles', article.slug);
    ensureDir(articleDir);

    const pageTitle = `${article.title} | MIRARI 數位科學雜誌`;
    const pageDesc = article.summary || article.leadParagraph || '';
    const ogType = 'article';
    const canonicalUrl = `${canonicalOrigin}/articles/${article.slug}`;

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

    const preRenderedBody = `
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

    // JSON-LD 結構化資料
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: article.title,
      description: pageDesc,
      url: canonicalUrl,
      datePublished: article.publishedDate || '2026-11-02',
      publisher: {
        '@type': 'Organization',
        name: 'MIRARI',
        url: canonicalOrigin,
      },
      ...(article.authors
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
    publishedPrerenderCount++;
  }

  // 生成分類頁靜態預渲染 (/journal 與 /principles)
  const categoryRoutes = [
    {
      path: 'journal',
      title: '期刊解讀 | MIRARI 數位科學雜誌',
      description: '追蹤最新科學發現、重要研究成果、研發技術突破與重要科學事件，兼具時效性、科學價值與嚴謹核實。',
      category: 'journal_interpretation',
      categoryTitle: '期刊解讀',
      categoryTag: '最新科學動態與研究突破',
    },
    {
      path: 'principles',
      title: '科學原理與思想實驗 | MIRARI 數位科學雜誌',
      description: '收錄一般科普、經典科學知識、科學現象、數學原理、理論解釋及思想實驗，專注於增進科學理解。',
      category: 'scientific_principles',
      categoryTitle: '科學原理與思想實驗',
      categoryTag: '思想實驗與基石',
    },
  ];

  for (const cat of categoryRoutes) {
    const catDir = path.join(DIST_DIR, cat.path);
    ensureDir(catDir);

    const catArticles = publishedArticles.filter((a) => a.editorialCategory === cat.category);
    const canonicalUrl = `${canonicalOrigin}/${cat.path}`;

    let catArticlesHtml = '';
    if (catArticles.length === 0) {
      catArticlesHtml = `
        <div class="py-16 text-center space-y-3">
          <h2 class="font-serif text-lg font-bold">目前暫無${cat.categoryTitle}篇章</h2>
          <p class="text-xs text-[#706c64]">編輯部正在進行最新同儕審查文獻之深度查證與數值驗證，篇章將於通過自主編輯審核後即刻刊登。</p>
          <a href="/" class="inline-block mt-4 text-xs font-medium text-[#1a1917] underline">返回首頁</a>
        </div>
      `;
    } else {
      catArticlesHtml = catArticles
        .map(
          (a) => `
        <article class="p-6 mb-6 rounded-2xl border border-[#e5e0d8] bg-white">
          <div class="text-xs text-[#b87333] mb-2">${escapeHtml(a.formatBadgeText || '')} · ${escapeHtml(a.publishedDate || '')}</div>
          <h2 class="font-serif text-xl font-bold mb-2"><a href="/articles/${a.slug}" class="hover:underline">${escapeHtml(a.title)}</a></h2>
          <p class="font-serif text-sm text-[#706c64] mb-3">${escapeHtml(a.subtitle)}</p>
          <p class="text-xs text-[#706c64]">${escapeHtml(a.summary)}</p>
        </article>
      `
        )
        .join('\n');
    }

    const catBody = `
      <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] pb-32">
        <header class="border-b border-[#e5e0d8] bg-[#fcfbf9]/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <a href="/" class="text-xs font-sans text-[#706c64] hover:text-[#1a1917] px-3 py-1.5 rounded-lg border border-[#e5e0d8]">返回首頁</a>
          <span class="font-serif text-sm font-semibold">${escapeHtml(cat.categoryTitle)}</span>
        </header>
        <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <header class="border-b border-[#e5e0d8] pb-8 mb-10 space-y-2">
            <span class="text-xs font-semibold text-[#b87333]">${escapeHtml(cat.categoryTag)}</span>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold">${escapeHtml(cat.categoryTitle)}</h1>
            <p class="text-sm text-[#706c64]">${escapeHtml(cat.description)}</p>
          </header>
          <section>
            ${catArticlesHtml}
          </section>
        </main>
      </div>
    `;

    let catHtml = baseHtml;
    catHtml = catHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(cat.title)}</title>`);
    catHtml = catHtml.replace(/<meta\s+name="description"[^>]*>/i, '');
    catHtml = catHtml.replace(/<meta\s+name="robots"[^>]*>/i, '');

    const catMetaTags = `
    ${robotsMetaTag}
    <meta name="description" content="${escapeHtml(cat.description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="MIRARI" />
    <meta property="og:title" content="${escapeHtml(cat.title)}" />
    <meta property="og:description" content="${escapeHtml(cat.description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
  </head>`;

    catHtml = catHtml.replace('</head>', `${catMetaTags}`);
    catHtml = catHtml.replace('<div id="root"></div>', `<div id="root">${catBody}</div>`);

    fs.writeFileSync(path.join(catDir, 'index.html'), catHtml, 'utf8');
    fs.writeFileSync(path.join(DIST_DIR, `${cat.path}.html`), catHtml, 'utf8');
  }

  // 生成探索頁靜態預渲染 (/explore)
  const exploreDir = path.join(DIST_DIR, 'explore');
  ensureDir(exploreDir);
  const exploreCanonicalUrl = `${canonicalOrigin}/explore`;
  const exploreTitle = '探索 MIRARI | 數位科學雜誌';
  const exploreDesc = '探索科學主題、經典原理與前沿研究，由 MIRARI 吉祥物引導您在深度論述與互動數值實驗中進行主題探索與精準語義檢索。';

  const exploreBody = `
    <div class="min-h-screen bg-[#fcfbf9] text-[#1a1917] pb-32">
      <header class="border-b border-[#e5e0d8] bg-[#fcfbf9]/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <a href="/" class="text-xs font-sans text-[#706c64] hover:text-[#1a1917] px-3 py-1.5 rounded-lg border border-[#e5e0d8]">返回首頁</a>
        <span class="font-serif text-sm font-semibold">探索 MIRARI</span>
      </header>
      <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <header class="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span class="text-xs uppercase tracking-wider text-[#b87333] font-sans font-semibold block">主題與知識檢索</span>
          <h1 class="font-serif text-3xl sm:text-4xl font-bold">探索 MIRARI</h1>
          <p class="text-sm sm:text-base text-[#706c64] font-sans leading-relaxed">
            輸入感興趣的科學概念、現象或原理，MIRARI 將引導您探索站內的深度論述與互動數值實驗。
          </p>
        </header>
      </main>
    </div>
  `;

  let exploreHtml = baseHtml;
  exploreHtml = exploreHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(exploreTitle)}</title>`);
  exploreHtml = exploreHtml.replace(/<meta\s+name="description"[^>]*>/i, '');
  exploreHtml = exploreHtml.replace(/<meta\s+name="robots"[^>]*>/i, '');

  const exploreMetaTags = `
    ${robotsMetaTag}
    <meta name="description" content="${escapeHtml(exploreDesc)}" />
    <link rel="canonical" href="${escapeHtml(exploreCanonicalUrl)}" />
    <meta property="og:site_name" content="MIRARI" />
    <meta property="og:title" content="${escapeHtml(exploreTitle)}" />
    <meta property="og:description" content="${escapeHtml(exploreDesc)}" />
    <meta property="og:url" content="${escapeHtml(exploreCanonicalUrl)}" />
    <meta property="og:type" content="website" />
  </head>`;

  exploreHtml = exploreHtml.replace('</head>', `${exploreMetaTags}`);
  exploreHtml = exploreHtml.replace('<div id="root"></div>', `<div id="root">${exploreBody}</div>`);

  fs.writeFileSync(path.join(exploreDir, 'index.html'), exploreHtml, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'explore.html'), exploreHtml, 'utf8');

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
  console.log(`✓ 已生成 /journal、/principles 與 /explore 頁靜態預渲染 HTML`);
  console.log(`✓ 已生成 dist/404.html 標準錯誤頁`);
  console.log('================================================================');
  console.log('🎉 靜態預渲染與 SEO 管線執行成功！');
  console.log('================================================================\n');
}

generatePrerenderedHTML();
