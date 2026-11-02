import { queryDataDrivenRecommendation, queryAISearch } from './unifiedSearchService';
import type { AIRecommendation } from '../types';

/**
 * AI Recommendation Service (Phase 4 Unified RAG Search)
 * 轉接至資料驅動與伺服器端 RAG 服務。
 */
export function queryMockAIRecommendation(query: string): AIRecommendation {
  return queryDataDrivenRecommendation(query);
}

export { queryDataDrivenRecommendation, queryAISearch };
