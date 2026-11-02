import type { ArticleKnowledgeConfig } from '../types';
import generatedKnowledgePoints from './generated/knowledge-points.json';

/**
 * MIRARI 文章核心知識點庫 (Article Knowledge Base)
 * 輕量資料結構：文章知識點 → 白話解釋 → 原文錨點。
 * 供文章隨文陪讀提問、提問提示生成與原文定位使用。
 * 由 content/knowledge-points/<slug>.json 在 build 階段編譯產出。
 * 讀者提問時完全由本機確定性檢索匹配，零外部 LLM 推論費用。
 */
export const ARTICLE_KNOWLEDGE_BASE: ArticleKnowledgeConfig[] =
  generatedKnowledgePoints as ArticleKnowledgeConfig[];

/**
 * 依據 articleId 或 slug 取得該篇章的知識庫設定
 */
export function getArticleKnowledgeConfig(articleIdOrSlug: string): ArticleKnowledgeConfig | undefined {
  if (!articleIdOrSlug) return undefined;
  return ARTICLE_KNOWLEDGE_BASE.find(
    (cfg) => cfg.articleId === articleIdOrSlug || cfg.slug === articleIdOrSlug
  );
}
