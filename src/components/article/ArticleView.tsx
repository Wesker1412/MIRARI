import React, { useState } from 'react';
import type { Article, ArticleDocument } from '../../types';
import { TOPICS } from '../../data/topics';
import { ArticleRenderer } from './ArticleRenderer';
import { useSEO } from '../seo/useSEO';

interface ArticleViewProps {
  article: Article;
  onBackToHome: () => void;
  onOpenArticleBySlug: (slug: string) => void;
  activeSentenceId: string | null;
  activeSecondaryId: string | null;
  evidenceNote: string | null;
  onClearHighlight: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  onBackToHome,
  activeSentenceId,
  activeSecondaryId,
  evidenceNote,
  onClearHighlight,
}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Sync SEO metadata with article details
  useSEO({
    title: article.title,
    description: article.summary || article.leadParagraph,
    canonicalUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/articles/${article.slug}`
        : `https://mirari.science/articles/${article.slug}`,
    ogType: 'article',
    publishedTime: article.publishedDate,
  });

  const handleCopyLink = () => {
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/articles/${article.slug}`
        : `https://mirari.science/articles/${article.slug}`;

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(fullUrl)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopy(fullUrl);
        });
    } else {
      fallbackCopy(fullUrl);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
    document.body.removeChild(textArea);
  };

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
    <div className="min-h-screen bg-mirari-paper text-mirari-ink pb-32">
      {/* ─── Top Editorial Nav ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-mirari-line bg-mirari-paper/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToHome}
            className="text-xs font-sans text-mirari-muted hover:text-mirari-ink transition px-3 py-1.5 rounded-lg border border-mirari-line hover:border-mirari-border"
          >
            返回首頁
          </button>
          <div className="h-4 w-[1px] bg-mirari-line hidden sm:block" />
          <span className="font-serif text-sm font-semibold text-mirari-ink truncate max-w-[240px] sm:max-w-md hidden sm:inline-block">
            {article.title}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Active Highlight Dismiss Button in Top Bar */}
          {activeSentenceId && (
            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1 rounded-lg text-xs font-sans animate-fade-in">
              <span>已定位：{evidenceNote || '原文句子'}</span>
              <button
                onClick={onClearHighlight}
                className="hover:underline font-medium text-amber-950 ml-1"
                title="清除標記"
              >
                清除
              </button>
            </div>
          )}

          <button
            onClick={handleCopyLink}
            className={`px-3 py-1.5 text-xs font-sans rounded-lg border transition ${
              isCopied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                : 'text-mirari-dim hover:text-mirari-ink border-mirari-line hover:border-mirari-border'
            }`}
            title="複製完整文章分享網址"
          >
            {isCopied ? '已複製文章網址' : '複製連結'}
          </button>
        </div>
      </header>

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
                <>
                  <span>文／MIRARI 科學組</span>
                  <span>·</span>
                  <span>審訂／系外行星研究員</span>
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
