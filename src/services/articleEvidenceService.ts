import evidenceIndexRaw from '../data/generated/evidence-index.json';
import type { SentenceEvidence, EvidenceSearchResult, ArticleKnowledgePoint } from '../types';
import { getArticleKnowledgeConfig } from '../data/articleKnowledgeBase';

export type { EvidenceSearchResult };

const EVIDENCE_INDEX: Record<string, SentenceEvidence[]> = evidenceIndexRaw as Record<
  string,
  SentenceEvidence[]
>;

// Stopwords for questions
const QUESTION_STOPWORDS = new Set([
  '什麼', '為什麼', '如何', '為何', '怎麼', '怎樣', '是否', '有沒有', '多少',
  '的', '了', '是', '在', '有', '和', '與', '或', '被', '會', '讓', '嗎', '呢',
  '請', '問', '請問', '告訴我', '想知道', '可以', '能夠',
]);

/**
 * 取得指定篇章的核心提問提示 / 知識點
 */
export function getArticleKnowledgePoints(articleIdOrSlug: string): ArticleKnowledgePoint[] {
  const cfg = getArticleKnowledgeConfig(articleIdOrSlug);
  return cfg ? cfg.knowledgePoints : [];
}

/**
 * 繁體中文自然語言分詞處理
 */
function tokenizeQuery(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[\r\n\t]+/g, ' ').trim();
  const rawTokens = normalized.match(/[\u4e00-\u9fa5]+|[a-z0-9_.]+/gi) || [];
  const tokens: string[] = [];

  for (const raw of rawTokens) {
    if (/^[a-z0-9_.]+$/.test(raw)) {
      if (raw.length >= 2 && !QUESTION_STOPWORDS.has(raw)) {
        tokens.push(raw);
      }
    } else {
      const len = raw.length;
      for (let i = 0; i < len; i++) {
        if (!QUESTION_STOPWORDS.has(raw[i])) tokens.push(raw[i]);
      }
      for (let i = 0; i < len - 1; i++) {
        const bigram = raw.slice(i, i + 2);
        if (!QUESTION_STOPWORDS.has(bigram)) tokens.push(bigram);
      }
      for (let i = 0; i < len - 2; i++) {
        tokens.push(raw.slice(i, i + 3));
      }
    }
  }

  return tokens;
}

/**
 * 文章隨文陪讀檢索：文章知識點 → 白話解釋 → 原文錨點
 * 
 * 1. 嚴格限定於當前文章 ID，絕不跨篇或使用預設文章。
 * 2. 匹配已驗證的核心知識點，提供簡短、自然的白話解釋。
 * 3. 移除原文直接摘錄與虛構信心百分比。
 * 4. 無可靠知識點對應時，誠實告知讀者，杜絕假問答拼湊。
 */
export function searchArticleEvidence(
  query: string,
  articleIdOrSlug?: string
): EvidenceSearchResult {
  if (!articleIdOrSlug) {
    return {
      query,
      answer: '請在具體科學篇章內進行隨文提問。',
      confidence: 0,
      evidence: null,
      matchedKnowledgePoint: null,
    };
  }

  const config = getArticleKnowledgeConfig(articleIdOrSlug);
  if (!config) {
    return {
      query,
      answer: '未找到當前篇章的知識庫索引。',
      confidence: 0,
      evidence: null,
      matchedKnowledgePoint: null,
    };
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      query,
      answer: '請提出關於本文內容的具體科學問題。',
      confidence: 0,
      evidence: null,
      matchedKnowledgePoint: null,
    };
  }

  const queryTokens = tokenizeQuery(trimmedQuery);
  const normalizedQuery = trimmedQuery.toLowerCase();

  // 評分匹配知識點
  let bestKP: ArticleKnowledgePoint | null = null;
  let highestScore = 0;

  for (const kp of config.knowledgePoints) {
    let score = 0;

    // 1. 完整推薦問題匹配 (點擊提示問題或完全一致)
    if (normalizedQuery === kp.suggestedQuestion.toLowerCase()) {
      score += 100;
    } else if (
      kp.suggestedQuestion.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(kp.suggestedQuestion.toLowerCase())
    ) {
      score += 60;
    }

    // 2. 標籤精確命中
    if (normalizedQuery.includes(kp.label.toLowerCase())) {
      score += 35;
    }

    // 3. 關鍵字觸發詞比對
    for (const kw of kp.keywords) {
      const lkw = kw.toLowerCase();
      if (normalizedQuery.includes(lkw)) {
        score += 20;
      }
    }

    // 4. Token 重疊比對
    for (const token of queryTokens) {
      if (token.length >= 2) {
        if (kp.suggestedQuestion.includes(token)) score += 3;
        if (kp.label.includes(token)) score += 4;
        for (const kw of kp.keywords) {
          if (kw.includes(token)) score += 3;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestKP = kp;
    }
  }

  // 門檻：必須至少命中關鍵特徵詞或核心概念
  if (!bestKP || highestScore < 15) {
    return {
      query,
      answer: '本文目前的已驗證知識點暫無法為這個問題提供可靠且具原文依據的解釋。建議您可以參考提問提示，或查閱本文相關章節。',
      confidence: 0,
      evidence: null,
      matchedKnowledgePoint: null,
    };
  }

  // 取得目標原文錨點句子（若未設定或找不到對應句子，嚴格維持 null，禁止降級至文章第一句）
  const articleSentences = EVIDENCE_INDEX[config.articleId] || [];
  let targetSentence: SentenceEvidence | null = null;

  if (bestKP.anchorSentenceId) {
    targetSentence = articleSentences.find((s) => s.sentenceId === bestKP.anchorSentenceId) || null;
  }

  return {
    query,
    answer: bestKP.plainExplanation,
    confidence: 1.0,
    evidence: targetSentence,
    matchedKnowledgePoint: bestKP,
  };
}
