/**
 * LocalDeterministicProvider (Node.js script version)
 */
export class LocalDeterministicProvider {
  constructor() {
    this.name = 'local-deterministic';
    this.modelVersion = 'cjk-ngram-v1.0';
    this.dimension = 128;
  }

  async generateEmbedding(text) {
    const vector = new Array(this.dimension).fill(0);
    const cleaned = text.trim().toLowerCase();
    if (!cleaned) return vector;

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

  async generateBatchEmbeddings(texts) {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}
