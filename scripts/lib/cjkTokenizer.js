/**
 * Traditional Chinese & Scientific Terminology Tokenizer
 * 
 * 繁體中文與科學名詞雙向分詞器。
 * 結合正則切詞、符號排除與二元文法 (Bigram) 抽取，提供強健且跨環境一致的檢索特徵。
 */

// 科學停用字
const STOPWORDS = new Set([
  '的', '了', '和', '是', '就', '也', '在', '而', '及', '與', '或', '一個',
  '我們', '這', '那', '有', '著', '其', '至', '從', '於', '被', '讓', '以',
  '可', '但', '若', '對', '將', '會', '又', '更', '此', '為', '所', '由',
]);

export function tokenizeCJK(text) {
  if (!text) return [];

  const normalized = text.toLowerCase().replace(/[\r\n\t]+/g, ' ');
  // Match English words, numbers, and Chinese character runs
  const rawTokens = normalized.match(/[\u4e00-\u9fa5]+|[a-z0-9_.]+/gi) || [];
  const tokens = [];

  for (const raw of rawTokens) {
    if (/^[a-z0-9_.]+$/.test(raw)) {
      if (raw.length >= 2 && !STOPWORDS.has(raw)) {
        tokens.push(raw);
      }
    } else {
      // CJK Character Run
      const len = raw.length;
      // Single characters
      for (let i = 0; i < len; i++) {
        const char = raw[i];
        if (!STOPWORDS.has(char)) {
          tokens.push(char);
        }
      }
      // Bigrams (for phrase matching like '凌日', '黑洞', '光度')
      for (let i = 0; i < len - 1; i++) {
        const bigram = raw.slice(i, i + 2);
        if (!STOPWORDS.has(bigram)) {
          tokens.push(bigram);
        }
      }
      // Trigrams for longer technical phrases like '光度線', '外行星'
      for (let i = 0; i < len - 2; i++) {
        const trigram = raw.slice(i, i + 3);
        tokens.push(trigram);
      }
    }
  }

  return tokens;
}

/**
 * Compute Term Frequency Map
 */
export function getTermFrequency(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  return tf;
}

/**
 * Token Overlap & BM25-style similarity score
 */
export function scoreQueryAgainstDoc(queryTokens, docTokens, docLength = 100, avgDocLength = 100) {
  if (!queryTokens.length || !docTokens.length) return 0;

  const docTf = getTermFrequency(docTokens);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const q of queryTokens) {
    const f = docTf[q] || 0;
    if (f > 0) {
      // Higher weight for multi-character terms (bigrams/trigrams)
      const termWeight = q.length >= 2 ? (q.length >= 3 ? 3.0 : 2.0) : 0.8;
      const num = f * (k1 + 1);
      const denom = f + k1 * (1 - b + b * (docLength / avgDocLength));
      score += termWeight * (num / denom);
    }
  }

  return score;
}
