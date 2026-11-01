import { type EmbeddingProvider, getEnvVar } from './types';

/**
 * GeminiEmbeddingProvider
 * 
 * 正式環境整合 Google Gemini Embedding API (text-embedding-004)。
 * API Key 僅能存放在伺服器環境或 CI Secrets (GEMINI_API_KEY)，嚴禁打包進瀏覽器前端。
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly modelVersion = 'text-embedding-004';
  readonly dimension = 768;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getEnvVar('GEMINI_API_KEY');
    if (!this.apiKey) {
      console.warn('[GeminiEmbeddingProvider] No GEMINI_API_KEY found in environment');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('[GeminiEmbeddingProvider] GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelVersion}:embedContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.modelVersion}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[GeminiEmbeddingProvider] API request failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.embedding.values;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('[GeminiEmbeddingProvider] GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelVersion}:batchEmbedContents?key=${this.apiKey}`;
    const requests = texts.map((text) => ({
      model: `models/${this.modelVersion}`,
      content: { parts: [{ text }] },
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[GeminiEmbeddingProvider] Batch API request failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }
}
