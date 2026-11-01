import { queryDataDrivenRecommendation } from './unifiedSearchService';
import type { AIRecommendation } from '../types';

/**
 * AI Recommendation Service (Data-Driven Unified Search)
 * 
 * 轉接至資料驅動的 unifiedSearchService，完全移除手動維護的 if/else 關鍵字分支。
 */
export function queryMockAIRecommendation(query: string): AIRecommendation {
  return queryDataDrivenRecommendation(query);
}

export { queryDataDrivenRecommendation };
