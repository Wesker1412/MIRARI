import React from 'react';
import type { Article, ArticleDocument } from '../../types';
import { TOPICS } from '../../data/topics';
import { ArticleRenderer } from './ArticleRenderer';
import { useSEO } from '../seo/useSEO';
import { SITE_CONFIG } from '../../config/site';

interface ArticleViewProps {
  article: Article;
  onBackToHome?: () => void;
  onOpenArticleBySlug?: (slug: string) => void;
  activeSentenceId: string | null;
  activeSecondaryId: string | null;
  evidenceNote?: string | null;
  onClearHighlight?: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  activeSentenceId,
  activeSecondaryId,
}) => {
  // Sync SEO metadata with article details
  useSEO({
    title: article.title,
    description: article.summary || article.leadParagraph,
    canonicalUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/articles/${article.slug}`
        : `${SITE_CONFIG.canonicalOrigin}/articles/${article.slug}`,
    ogType: 'article',
    publishedTime: article.publishedDate,
  });

  const getHighlightClass = (id: string) => {
    if (activeSentenceId === id) {
      return 'exact-text-highlight';
    }
    if (activeSecondaryId === id) {
      return 'exact-text-highlight-secondary';
    }
    return '';
  };

  const doc = article as ArticleDocument;

  return (
    <div className="bg-mirari-paper text-mirari-ink pb-32">
      {/* ─── Article Reading Spine ─────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        {/* Header */}
        <header className="space-y-4 pb-8 border-b border-mirari-line">
          <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber">
            <span className="font-semibold tracking-wider">
              {article.topicIds
                .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
                .filter(Boolean)
                .join(' · ') || '科學專題'}
            </span>
            <span className="text-mirari-dim">·</span>
            <span className="text-mirari-dim">{article.formatBadgeText}</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-mirari-ink leading-[1.2]">
            {article.title}
          </h1>

          <p className="font-serif text-lg sm:text-xl text-mirari-muted font-normal leading-relaxed">
            {article.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-between pt-4 text-xs text-mirari-dim border-t border-mirari-line/60 gap-3">
            <div className="flex items-center space-x-3">
              {doc.authors && doc.authors.length > 0 ? (
                doc.authors.map((a, idx) => (
                  <React.Fragment key={idx}>
                    <span>{a.role}／{a.name}</span>
                    {idx < doc.authors.length - 1 && <span>·</span>}
                  </React.Fragment>
                ))
              ) : (
                <span>文／MIRARI 科學組</span>
              )}
              {article.publishedDate && (
                <>
                  <span>·</span>
                  <span>發布於 {article.publishedDate}</span>
                </>
              )}
            </div>
            <span>{article.formatBadgeText}</span>
          </div>
        </header>

        {/* Dynamic Article Renderer (從 MDX/正文結構自動渲染) */}
        <ArticleRenderer
          document={doc}
          getHighlightClass={getHighlightClass}
        />
      </main>
    </div>
  );
};
