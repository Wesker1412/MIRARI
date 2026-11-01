import { type EmbeddingProvider, getEnvVar } from './types';

/**
 * OpenAIEmbeddingProvider
 * 
 * 正式環境整合 OpenAI Embeddings API (text-embedding-3-small)。
 * API Key 僅能存放在伺服器環境或 CI Secrets (OPENAI_API_KEY)，嚴禁打包進瀏覽器前端。
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly modelVersion = 'text-embedding-3-small';
  readonly dimension = 1536;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getEnvVar('OPENAI_API_KEY');
    if (!this.apiKey) {
      console.warn('[OpenAIEmbeddingProvider] No OPENAI_API_KEY found in environment');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('[OpenAIEmbeddingProvider] OPENAI_API_KEY is not configured');
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelVersion,
        input: text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[OpenAIEmbeddingProvider] API request failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('[OpenAIEmbeddingProvider] OPENAI_API_KEY is not configured');
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelVersion,
        input: texts,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[OpenAIEmbeddingProvider] Batch API request failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }
}
