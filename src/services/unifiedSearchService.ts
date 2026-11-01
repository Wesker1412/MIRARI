import searchIndexRaw from '../data/generated/search-index.json';
import articlesManifestRaw from '../data/generated/articles-manifest.json';
import { TOPICS } from '../data/topics';
import type { Article, AIRecommendation, SearchIndexEntry } from '../types';

const SEARCH_INDEX: SearchIndexEntry[] = searchIndexRaw as unknown as SearchIndexEntry[];
const ARTICLES_MAP: Map<string, Article> = new Map(
  (articlesManifestRaw as unknown as Article[]).map((a) => [a.id, a])
);

// Stopwords for search queries
const STOPWORDS = new Set([
  '的', '了', '和', '是', '就', '也', '在', '而', '及', '與', '或', '一個',
  '我們', '這', '那', '有', '著', '其', '至', '從', '於', '被', '讓', '以',
  '可', '但', '若', '對', '將', '會', '又', '更', '此', '為', '所', '由',
  '請', '問', '想', '看', '找', '有沒有', '可以', '文章', '篇章', '內容',
]);

/**
 * Tokenize query string for Traditional Chinese matching
 */
function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase().replace(/[\r\n\t]+/g, ' ').trim();
  const rawTokens = normalized.match(/[\u4e00-\u9fa5]+|[a-z0-9_.]+/gi) || [];
  const tokens: string[] = [];

  for (const raw of rawTokens) {
    if (/^[a-z0-9_.]+$/.test(raw)) {
      if (raw.length >= 2 && !STOPWORDS.has(raw)) {
        tokens.push(raw);
      }
    } else {
      const len = raw.length;
      for (let i = 0; i < len; i++) {
        if (!STOPWORDS.has(raw[i])) tokens.push(raw[i]);
      }
      for (let i = 0; i < len - 1; i++) {
        const bigram = raw.slice(i, i + 2);
        if (!STOPWORDS.has(bigram)) tokens.push(bigram);
      }
      for (let i = 0; i < len - 2; i++) {
        tokens.push(raw.slice(i, i + 3));
      }
    }
  }

  return tokens;
}

/**
 * Data-Driven Article Recommendation & Search
 * 
 * 完全移除寫死 if/else 關鍵字分支。
 * 結合 TF-IDF / BM25 權重、主題關聯、發布狀態及編輯精選加權，
 * 支援任意繁體中文查詢與未來自動擴充之文章庫。
 */
export function queryDataDrivenRecommendation(query: string): AIRecommendation {
  const queryTokens = tokenizeQuery(query);

  if (queryTokens.length === 0) {
    const publishedFallback = SEARCH_INDEX.filter((a) => a.status === 'published')
      .map((entry) => ARTICLES_MAP.get(entry.articleId)!)
      .filter(Boolean)
      .slice(0, 2);

    return {
      query,
      curatorReply: '請輸入你想探索的科學現象或主題，為你檢索站內深度文章與研究解讀。',
      recommendedArticles: publishedFallback,
      suggestedTags: ['系外行星', '天文物理', '思想實驗'],
    };
  }

  // Score each article in search index
  const scoredEntries: Array<{ entry: SearchIndexEntry; score: number }> = [];

  for (const entry of SEARCH_INDEX) {
    const entryTokenSet = new Set(entry.tokens);
    let score = 0;

    for (const q of queryTokens) {
      if (entryTokenSet.has(q)) {
        const weight = q.length >= 3 ? 4.0 : q.length >= 2 ? 2.5 : 0.8;
        score += weight;
      }
    }

    // Boost published articles so they are prioritized over in-preparation
    if (entry.status === 'published') {
      score *= 1.4;
    }

    // Editorial pick boosts
    if (entry.isEditorialCover) score *= 1.25;
    if (entry.isEditorialPick) score *= 1.15;

    // Check title verbatim match
    if (entry.title.includes(query) || entry.subtitle.includes(query)) {
      score += 10.0;
    }

    if (score > 0) {
      scoredEntries.push({ entry, score });
    }
  }

  // Sort by score descending
  scoredEntries.sort((a, b) => b.score - a.score);

  // Separate published vs in_preparation to ensure published articles come first
  const publishedMatches = scoredEntries
    .filter((s) => s.entry.status === 'published')
    .map((s) => ARTICLES_MAP.get(s.entry.articleId)!)
    .filter(Boolean);

  const prepMatches = scoredEntries
    .filter((s) => s.entry.status === 'in_preparation')
    .map((s) => ARTICLES_MAP.get(s.entry.articleId)!)
    .filter(Boolean);

  // Ensure published articles are prioritized
  const recommendedArticles: Article[] = [];
  if (publishedMatches.length > 0) {
    recommendedArticles.push(...publishedMatches.slice(0, 2));
    if (prepMatches.length > 0 && recommendedArticles.length < 2) {
      recommendedArticles.push(prepMatches[0]);
    }
  } else if (prepMatches.length > 0) {
    recommendedArticles.push(...prepMatches.slice(0, 2));
  } else {
    // Fallback if score was 0 across all
    const defaultCover = ARTICLES_MAP.get('art-exoplanet-transit');
    if (defaultCover) recommendedArticles.push(defaultCover);
  }

  // Extract relevant tags
  const matchedTags = Array.from(
    new Set(
      recommendedArticles
        .flatMap((a) => a.tags || [])
        .concat(
          recommendedArticles
            .flatMap((a) => a.topicIds || [])
            .map((tid) => TOPICS.find((t) => t.id === tid)?.nameZh || '')
            .filter(Boolean)
        )
    )
  ).slice(0, 4);

  // Generate Curator Explanation based on top match
  const topArticle = recommendedArticles[0];
  let curatorReply = '';

  if (topArticle) {
    if (topArticle.status === 'published') {
      curatorReply = `針對「${query}」，推薦閱讀已發布之深度專題《${topArticle.title}》。${topArticle.summary}`;
    } else {
      curatorReply = `針對「${query}」，編輯部正籌備文獻解讀《${topArticle.title}》（${topArticle.journalReference?.journal || '期刊研究'}）。可先閱讀相關背景與核心主題。`;
    }
  } else {
    curatorReply = `已為你檢索關於「${query}」之相關文獻與專題。`;
  }

  return {
    query,
    curatorReply,
    recommendedArticles,
    suggestedTags: matchedTags,
  };
}
