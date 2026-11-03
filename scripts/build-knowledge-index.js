import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArticleDocument } from './lib/articleParser.js';
import { tokenizeCJK } from './lib/cjkTokenizer.js';
import { LocalDeterministicProvider } from './lib/localEmbedding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CONTENT_DIR = path.join(ROOT_DIR, 'content', 'articles');
const KP_DIR = path.join(ROOT_DIR, 'content', 'knowledge-points');
const GENERATED_DIR = path.join(ROOT_DIR, 'src', 'data', 'generated');
const API_DATA_DIR = path.join(ROOT_DIR, 'api', '_lib', 'data');
const CACHE_DIR = path.join(ROOT_DIR, '.mirari-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'index-cache.json');
const LOG_FILE = path.join(CACHE_DIR, 'sync-log.json');

async function runPipeline() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('🚀 MIRARI 自動文章發布與知識索引建置管線');
  console.log('================================================================');

  // Ensure directories exist
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
  if (!fs.existsSync(KP_DIR)) {
    fs.mkdirSync(KP_DIR, { recursive: true });
  }
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Load existing cache if present
  let cache = { chunks: {}, articles: {}, version: 1 };
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      console.warn('⚠️ 讀取現有快取失敗，將重新建立快取。');
    }
  }

  // Initialize Embedding Provider (Local deterministic for offline reproducibility)
  const embeddingProvider = new LocalDeterministicProvider();
  console.log(`📡 語意向量提供者: ${embeddingProvider.name} (${embeddingProvider.modelVersion}, ${embeddingProvider.dimension} 維)`);

  const articleFiles = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  console.log(`📚 發現 ${articleFiles.length} 篇 Markdown/MDX 正式文章本體`);

  const todayTaipei = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  function isArticlePublished(doc, refDateStr = todayTaipei) {
    if (!doc || doc.status !== 'published') return false;
    if (!doc.publishedDate) return false;
    return doc.publishedDate <= refDateStr;
  }

  const compiledArticles = [];
  const evidenceIndexByArticle = {};
  const searchIndexList = [];

  let totalSentences = 0;
  let totalChunks = 0;
  let reusedChunksCount = 0;
  let newlyEmbeddedChunksCount = 0;

  for (const fileName of articleFiles) {
    const filePath = path.join(CONTENT_DIR, fileName);
    const rawContent = fs.readFileSync(filePath, 'utf8');

    console.log(`\n📄 解析文章: ${fileName}`);
    const { document, sentences, chunks } = parseArticleDocument(rawContent, fileName);

    console.log(`   · 標題: 《${document.title}》 (v${document.version}, ${document.status})`);
    console.log(`   · 結構: ${document.sections.length} 個章節, ${sentences.length} 句原文, ${chunks.length} 個檢索區塊`);
    console.log(`   · 參考來源: ${document.references.length} 篇實證論文`);

    const isPub = isArticlePublished(document);
    if (!isPub) {
      console.log(`   🔒 尚未到期未發布篇章 (${document.publishedDate || '無發布日期'} > ${todayTaipei})：正文與檢索索引隔離`);
      // 隔離正文內容，確保公開資產 (JS bundle / articles-manifest.json) 絕不洩漏未公開正文
      compiledArticles.push({
        ...document,
        sections: [],
      });
      // 未發布篇章不納入公開 evidenceIndex 與 searchIndex
    } else {
      totalSentences += sentences.length;
      totalChunks += chunks.length;

      // Incremental Chunk Processing
      const processedChunks = [];
      for (const chunk of chunks) {
        const cached = cache.chunks[chunk.contentHash];
        if (cached && cached.modelVersion === embeddingProvider.modelVersion) {
          // Reuse cached embedding
          reusedChunksCount++;
          processedChunks.push({
            ...chunk,
            vector: cached.vector,
            reused: true,
          });
        } else {
          // Generate new embedding
          newlyEmbeddedChunksCount++;
          const vector = await embeddingProvider.generateEmbedding(chunk.contextContent);
          cache.chunks[chunk.contentHash] = {
            chunkId: chunk.id,
            contentHash: chunk.contentHash,
            vector,
            modelVersion: embeddingProvider.modelVersion,
            updatedAt: new Date().toISOString(),
          };
          processedChunks.push({
            ...chunk,
            vector,
            reused: false,
          });
        }
      }

      // Attach processed chunks and metadata
      compiledArticles.push(document);
      evidenceIndexByArticle[document.id] = sentences;

      // Build Search Index Entry
      const combinedSearchText = [
        document.title,
        document.subtitle,
        document.summary,
        document.leadParagraph,
        ...(document.tags || []),
        ...sentences.map((s) => s.exactQuote),
      ].join(' ');

      const tokens = Array.from(new Set(tokenizeCJK(combinedSearchText)));

      searchIndexList.push({
        articleId: document.id,
        slug: document.slug,
        title: document.title,
        subtitle: document.subtitle,
        summary: document.summary,
        status: document.status,
        publishedDate: document.publishedDate,
        topicIds: document.topicIds || [],
        tags: document.tags || [],
        editorialCategory: document.editorialCategory,
        format: document.format,
        formatBadgeText: document.formatBadgeText,
        isEditorialCover: !!document.isEditorialCover,
        isEditorialPick: !!document.isEditorialPick,
        isResearchHighlight: !!document.isResearchHighlight,
        isClassicFoundation: !!document.isClassicFoundation,
        tokens,
        contentHash: document.contentHash,
        totalSentences: sentences.length,
      });
    }
  }

  // Save Generated Files
  console.log('\n💾 寫入編譯產出物:');
  const articlesOutPath = path.join(GENERATED_DIR, 'articles-manifest.json');
  fs.writeFileSync(articlesOutPath, JSON.stringify(compiledArticles, null, 2), 'utf8');
  console.log(`   ✓ ${articlesOutPath} (${compiledArticles.length} 篇文章)`);

  const evidenceOutPath = path.join(GENERATED_DIR, 'evidence-index.json');
  fs.writeFileSync(evidenceOutPath, JSON.stringify(evidenceIndexByArticle, null, 2), 'utf8');
  console.log(`   ✓ ${evidenceOutPath} (${totalSentences} 句原文定位索引)`);

  const searchOutPath = path.join(GENERATED_DIR, 'search-index.json');
  fs.writeFileSync(searchOutPath, JSON.stringify(searchIndexList, null, 2), 'utf8');
  console.log(`   ✓ ${searchOutPath} (${searchIndexList.length} 筆搜尋索引)`);

  // Compile Knowledge Points Manifest from content/knowledge-points/*.json
  const kpFiles = fs.existsSync(KP_DIR)
    ? fs.readdirSync(KP_DIR).filter((f) => f.endsWith('.json'))
    : [];
  const compiledKnowledgeBase = [];
  let totalKnowledgePoints = 0;

  for (const kpFile of kpFiles) {
    const rawKp = JSON.parse(fs.readFileSync(path.join(KP_DIR, kpFile), 'utf8'));
    const targetArticle = compiledArticles.find(
      (a) => a.id === rawKp.articleId || a.slug === rawKp.slug
    );
    if (!targetArticle || !isArticlePublished(targetArticle)) {
      console.log(`   🔒 排除未公開篇章之知識庫: ${rawKp.articleId || kpFile}`);
      continue;
    }

    const articleSentences = evidenceIndexByArticle[rawKp.articleId] || [];
    const sentenceIds = new Set(articleSentences.map((s) => s.sentenceId));

    for (const kpItem of rawKp.knowledgePoints || []) {
      totalKnowledgePoints++;
      if (kpItem.anchorSentenceId && !sentenceIds.has(kpItem.anchorSentenceId)) {
        console.warn(
          `   ⚠️ 警告：知識點「${kpItem.label}」之 anchorSentenceId (${kpItem.anchorSentenceId}) 未在 ${rawKp.articleId} 中匹配到句子！`
        );
      }
    }
    compiledKnowledgeBase.push(rawKp);
  }

  const kpOutPath = path.join(GENERATED_DIR, 'knowledge-points.json');
  fs.writeFileSync(kpOutPath, JSON.stringify(compiledKnowledgeBase, null, 2), 'utf8');
  console.log(`   ✓ ${kpOutPath} (${compiledKnowledgeBase.length} 篇知識庫, 共 ${totalKnowledgePoints} 個知識點)`);

  // Sync to API Data Directory for Serverless Functions
  if (!fs.existsSync(API_DATA_DIR)) {
    fs.mkdirSync(API_DATA_DIR, { recursive: true });
  }
  fs.copyFileSync(articlesOutPath, path.join(API_DATA_DIR, 'articles-manifest.json'));
  fs.copyFileSync(evidenceOutPath, path.join(API_DATA_DIR, 'evidence-index.json'));
  fs.copyFileSync(searchOutPath, path.join(API_DATA_DIR, 'search-index.json'));
  fs.copyFileSync(kpOutPath, path.join(API_DATA_DIR, 'knowledge-points.json'));
  console.log(`   ✓ 同步資料至 ${API_DATA_DIR} (供 Vercel Serverless Functions 讀取)`);

  // Write Cache & Sync Log
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  const syncLog = {
    timestamp: new Date().toISOString(),
    status: 'success',
    totalArticles: compiledArticles.length,
    totalSentences,
    totalChunks,
    reusedChunksCount,
    newlyEmbeddedChunksCount,
    durationMs: Date.now() - startTime,
    modelVersion: embeddingProvider.modelVersion,
  };
  fs.writeFileSync(LOG_FILE, JSON.stringify(syncLog, null, 2), 'utf8');

  console.log('\n================================================================');
  console.log(`🎉 索引建置成功！耗時: ${(Date.now() - startTime)} ms`);
  console.log(`   · 區塊總數: ${totalChunks}`);
  console.log(`   · 重用快取向量: ${reusedChunksCount}`);
  console.log(`   · 新增/重新計算向量: ${newlyEmbeddedChunksCount}`);
  console.log('================================================================\n');
}

runPipeline().catch((err) => {
  console.error('❌ 索引建置失敗:', err);
  process.exit(1);
});
