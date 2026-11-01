import type { EmbeddingProvider } from './types';

/**
 * LocalDeterministicProvider
 * 
 * 本地開發與離線 CI 專用之確定性向量提供者。
 * 當尚未配置 Supabase / Gemini API Key 時使用，基於繁體中文 CJK n-gram 與
 * 確定性特徵投影產生固定維度向量（128 維）。
 * 
 * 嚴格註記：此為本地測試管線，絕不偽裝為外部真實 LLM API 產生的語意向量。
 */
export class LocalDeterministicProvider implements EmbeddingProvider {
  readonly name = 'local-deterministic';
  readonly modelVersion = 'cjk-ngram-v1.0';
  readonly dimension = 128;

  async generateEmbedding(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimension).fill(0);
    const cleaned = text.trim().toLowerCase();
    if (!cleaned) return vector;

    // Character unigrams and bigrams
    for (let i = 0; i < cleaned.length; i++) {
      const code = cleaned.charCodeAt(i);
      const idx1 = code % this.dimension;
      vector[idx1] += 1.0;

      if (i < cleaned.length - 1) {
        const bigramCode = (code << 5) - code + cleaned.charCodeAt(i + 1);
        const idx2 = Math.abs(bigramCode) % this.dimension;
        vector[idx2] += 1.5;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}
