export interface EmbeddingProvider {
  readonly name: string;
  readonly modelVersion: string;
  readonly dimension: number;

  /**
   * Generate vector embedding for a single text chunk
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generate vector embeddings for a batch of text chunks
   */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface ChunkEmbeddingRecord {
  chunkId: string;
  articleId: string;
  sectionId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  charStart: number;
  charEnd: number;
  vector: number[];
  modelVersion: string;
  createdAt: string;
}

export function getEnvVar(key: string): string {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env) {
      return (globalThis as unknown as { process: { env: Record<string, string> } }).process.env[key] || '';
    }
  } catch {
    // Ignore in browser
  }
  return '';
}
