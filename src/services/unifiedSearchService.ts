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

const PROMPT_INJECTION_PATTERNS = [
  /(ignore|disregard|forget|bypass|override)\s+(previous|above|all|system|prior)\s+(instructions|prompt|rules|constraints)/i,
  /(忽略|無視|覆蓋|跳過|忘記|取消)\s*(先前|以上|所有|原本|系統|前面)?\s*(指令|指示|規則|提示|限制|設定)/,
  /(you are now|system prompt|jailbreak|dan mode|developer mode|unrestricted mode)/i,
  /(現在開始你是|角色扮演|解鎖限制|解除限制|不受任何限制)/,
  /(輸出.*(系統提示詞|api key|環境變數|密碼|密鑰|token))/i,
  /(reveal|leak|print|display)\s+(system\s+prompt|api\s*key|secret|env|token)/i,
];

const OFF_TOPIC_INTENT_PATTERNS = [
  /^(請|幫我|能否)?(寫|編寫|提供|生成)?.*(程式碼|代碼|python|javascript|typescript|c\+\+|java|html|css|sql|script|leetcode|function|class)/i,
  /(寫一首詩|講個笑話|寫篇散文|寫一篇小說|作一首詞|幫我寫信|幫我寫文案)/,
  /(今天天氣|明天的天氣|氣象預報|星座運勢|算命|塔羅牌|推薦餐廳|美食推薦|旅遊景點|電影推薦|推薦電影)/,
  /^(你好|哈囉|hi|hello|hey|你是誰|你叫什麼名字|你可以做什麼|陪我聊天|好無聊)\??$/i,
];

export function isAdversarialOrOffTopic(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  for (const pattern of PROMPT_INJECTION_PATTERNS) if (pattern.test(trimmed)) return true;
  for (const pattern of OFF_TOPIC_INTENT_PATTERNS) if (pattern.test(trimmed)) return true;
  return false;
}

/**
 * Data-Driven Article Recommendation & Search
 * 
 * 完全移除寫死 if/else 關鍵字分支。
 * 結合 TF-IDF / BM25 權重、主題關聯、發布狀態及編輯精選加權，
 * 支援任意繁體中文查詢與未來自動擴充之文章庫。
 */
export function queryDataDrivenRecommendation(query: string): AIRecommendation {
  if (isAdversarialOrOffTopic(query)) {
    return {
      query,
      curatorReply: 'MIRARI 目前尚未收錄足以回答這個問題的科學內容。你可以嘗試換個關鍵字，或探索站內其他科學文章。',
      recommendedArticles: [],
      suggestedTags: [],
      matchLevel: 'none',
    };
  }

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
      matchLevel: 'none',
    };
  }

  // Score each article in search index
  const scoredEntries: Array<{ entry: SearchIndexEntry; score: number; matchedTokensCount: number }> = [];

  for (const entry of SEARCH_INDEX) {
    const entryTokenSet = new Set(entry.tokens);
    let score = 0;
    let matchedTokensCount = 0;

    for (const q of queryTokens) {
      if (entryTokenSet.has(q)) {
        matchedTokensCount++;
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
    const coreQuery = query.replace(/[\s\p{P}]+/gu, '');
    if (entry.title === query || (coreQuery.length >= 4 && entry.title.includes(query))) {
      score += 12.0;
      matchedTokensCount = queryTokens.length;
    }

    if (score > 0) {
      scoredEntries.push({ entry, score, matchedTokensCount });
    }
  }

  // Sort by score descending
  scoredEntries.sort((a, b) => b.score - a.score);

  const topScore = scoredEntries[0]?.score || 0;
  const topCandidateArticle = scoredEntries[0] ? ARTICLES_MAP.get(scoredEntries[0].entry.articleId) : undefined;
  const coreQuery = query.replace(/[\s\p{P}]+/gu, '');
  const hasVerbatimTitle = topCandidateArticle && (topCandidateArticle.title === query || (coreQuery.length >= 4 && topCandidateArticle.title.includes(query)));
  const hasTagHit = topCandidateArticle && (topCandidateArticle.tags || []).some(
    (t: string) => t.length >= 2 && (query === t || (query.length >= 3 && query.includes(t)))
  );
  const matchedTokenRatio = queryTokens.length > 0 ? (scoredEntries[0]?.matchedTokensCount || 0) / queryTokens.length : 0;

  // 嚴格相關性閘門：杜絕偶然重疊與短詞誤判
  const passesGate =
    hasVerbatimTitle ||
    hasTagHit ||
    (topScore >= 18.0 && matchedTokenRatio >= 0.22);

  if (!passesGate || scoredEntries.length === 0) {
    return {
      query,
      curatorReply: 'MIRARI 目前尚未收錄足以回答這個問題的科學內容。你可以嘗試換個關鍵字，或探索站內其他科學文章。',
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

/**
 * Phase 4: 全站 AI 科學搜尋 (Server-side RAG + 相關性硬性閘門)
 * 呼叫 /api/search 端點，支援自然語言提問、相關性嚴格驗證與免費 LLM 推薦導讀。
 * 當網路中斷或服務端異常時，自動安全降級至本機確定性檢索。
 */
export async function queryAISearch(query: string): Promise<AIRecommendation> {
  const trimmed = query.trim();
  if (!trimmed) {
    return queryDataDrivenRecommendation(query);
  }

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed }),
    });

    if (!res.ok) {
      console.warn(`[Search Service] /api/search 回應非 200 (${res.status})，降級至本機檢索`);
      return queryDataDrivenRecommendation(trimmed);
    }

    const data = await res.json();
    return {
      query: data.query || trimmed,
      curatorReply: data.curatorReply,
      recommendedArticles: data.recommendedArticles || [],
      suggestedTags: data.suggestedTags || [],
      matchLevel: data.matchLevel || 'none',
    };
  } catch (err) {
    console.warn('[Search Service] /api/search 網路異常，啟動安全降級:', err);
    return queryDataDrivenRecommendation(trimmed);
  }
}
