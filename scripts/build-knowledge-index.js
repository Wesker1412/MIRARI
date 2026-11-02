import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArticleDocument, sha256 } from './lib/articleParser.js';
import { tokenizeCJK } from './lib/cjkTokenizer.js';
import { LocalDeterministicProvider } from './lib/localEmbedding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CONTENT_DIR = path.join(ROOT_DIR, 'content', 'articles');
const GENERATED_DIR = path.join(ROOT_DIR, 'src', 'data', 'generated');
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
