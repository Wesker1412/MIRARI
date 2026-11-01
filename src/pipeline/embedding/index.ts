import { type EmbeddingProvider, getEnvVar } from './types';
import { LocalDeterministicProvider } from './LocalDeterministicProvider';
import { GeminiEmbeddingProvider } from './GeminiEmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';

export * from './types';
export * from './LocalDeterministicProvider';
export * from './GeminiEmbeddingProvider';
export * from './OpenAIEmbeddingProvider';

/**
 * 智慧取得可用的 EmbeddingProvider
 * 優先序：
 * 1. 若環境有 GEMINI_API_KEY，且未指定或指定 gemini -> GeminiEmbeddingProvider
 * 2. 若環境有 OPENAI_API_KEY，且未指定或指定 openai -> OpenAIEmbeddingProvider
 * 3. 否則安全降級為 LocalDeterministicProvider，提供完整可離線驗證的管線
 */
export function getEmbeddingProvider(preferred?: 'gemini' | 'openai' | 'local'): EmbeddingProvider {
  const hasGemini = !!getEnvVar('GEMINI_API_KEY');
  const hasOpenAI = !!getEnvVar('OPENAI_API_KEY');

  if (preferred === 'gemini' && hasGemini) {
    return new GeminiEmbeddingProvider();
  }
  if (preferred === 'openai' && hasOpenAI) {
    return new OpenAIEmbeddingProvider();
  }

  if (!preferred || preferred === 'gemini') {
    if (hasGemini) return new GeminiEmbeddingProvider();
    if (hasOpenAI) return new OpenAIEmbeddingProvider();
  }

  // Fallback to local
  return new LocalDeterministicProvider();
}
