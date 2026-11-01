import type { ArticleDocument } from '../types';
import articlesManifestRaw from './generated/articles-manifest.json';

/**
 * MIRARI 全站文章清單
 * 由自動發布與知識索引管線 (scripts/build-knowledge-index.js) 自 content/articles/*.mdx 編譯生成。
 * 支援完整正文結構、原文句子索引、引用來源及互動元件註冊。
 */
export const ARTICLES: ArticleDocument[] = articlesManifestRaw as unknown as ArticleDocument[];

export function getArticleById(id: string): ArticleDocument | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export function getArticleBySlug(slug: string): ArticleDocument | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
