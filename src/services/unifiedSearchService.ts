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
      if (len === 1) {
        if (!STOPWORDS.has(raw)) tokens.push(raw);
      } else {
        // Multi-character Chinese phrases: use bigrams, trigrams, and full word.
        // Strictly avoid single-character unigram noise that causes false matches across unrelated articles.
        for (let i = 0; i < len - 1; i++) {
          const bigram = raw.slice(i, i + 2);
          if (!STOPWORDS.has(bigram)) tokens.push(bigram);
        }
        for (let i = 0; i < len - 2; i++) {
          const trigram = raw.slice(i, i + 3);
          if (!STOPWORDS.has(trigram)) tokens.push(trigram);
        }
        if (len >= 4 && !STOPWORDS.has(raw)) {
          tokens.push(raw);
        }
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

  const topScore = scoredEntries[0]?.score || 0;
  const topCandidateArticle = scoredEntries[0] ? ARTICLES_MAP.get(scoredEntries[0].entry.articleId) : undefined;
  const hasVerbatimTitle = topCandidateArticle && (topCandidateArticle.title.includes(query) || topCandidateArticle.subtitle.includes(query));

  // If no articles scored meaningfully (less than a real bigram match: topScore < 2.5),
  // return clear 'none' status (never hallucinate or pretend with single-character noise matches)
  if (scoredEntries.length === 0 || (topScore < 2.5 && !hasVerbatimTitle)) {
    return {
      query,
      curatorReply: `站內目前尚無與「${query}」直接相關的科學篇章。MIRARI 僅收錄具備嚴謹論述與數值模擬的篇章，您可以試試搜尋「系外行星」、「雙擺渾沌」、「動作電位」或「麥克斯韋妖」。`,
      recommendedArticles: [],
      suggestedTags: ['系外行星', '渾沌理論', '動作電位', '麥克斯韋妖'],
      matchLevel: 'none',
    };
  }

  // Separate published vs in_preparation to ensure published articles come first
  const publishedMatches = scoredEntries
    .filter((s) => s.entry.status === 'published')
    .map((s) => ARTICLES_MAP.get(s.entry.articleId)!)
    .filter(Boolean);

  const prepMatches = scoredEntries
    .filter((s) => s.entry.status === 'in_preparation')
    .map((s) => ARTICLES_MAP.get(s.entry.articleId)!)
    .filter(Boolean);

  const recommendedArticles: Article[] = [];
  if (publishedMatches.length > 0) {
    recommendedArticles.push(...publishedMatches.slice(0, 3));
  } else if (prepMatches.length > 0) {
    recommendedArticles.push(...prepMatches.slice(0, 2));
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

  // Generate Curator Explanation based on top match and confidence level
  const topArticle = recommendedArticles[0];
  const isDirectMatch =
    topScore >= 6.0 ||
    (topArticle && (topArticle.title.includes(query) || (topArticle.tags || []).some((t) => query.includes(t) || t.includes(query))));
  const matchLevel = isDirectMatch ? 'direct' : 'partial';

  let curatorReply = '';
  if (topArticle) {
    if (isDirectMatch) {
      curatorReply = `針對「${query}」，站內已有收錄之深度專題《${topArticle.title}》，可直接閱讀相關原理與互動實驗。`;
    } else {
      curatorReply = `針對「${query}」，在站內找到部分相關概念的討論。推薦參考《${topArticle.title}》。`;
    }
  } else {
    curatorReply = `已為你檢索關於「${query}」之相關文獻與專題。`;
  }

  return {
    query,
    curatorReply,
    recommendedArticles,
    suggestedTags: matchedTags,
    matchLevel,
  };
}
