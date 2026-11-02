import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ARTICLES } from '../../data/articles';
import { TOPICS } from '../../data/topics';
import type { Article, EditorialCategory } from '../../types';
import { useSEO } from '../seo/useSEO';

interface CategoryArticlesPageProps {
  category: EditorialCategory;
}

const BATCH_SIZE = 6;

export const CategoryArticlesPage: React.FC<CategoryArticlesPageProps> = ({ category }) => {
  const navigate = useNavigate();

  const isJournal = category === 'journal_interpretation';
  const categoryTitle = isJournal ? '期刊解讀' : '科學原理與思想實驗';
  const categoryTag = isJournal ? '學術研究追蹤' : '思想實驗與基石';
  const categoryDescription = isJournal
    ? '聚焦近期同儕審查學術論文的深度科學解讀，剖析研究核心問題、實驗方法、實證發現與邊界限制。'
    : '探索經典科學體系、第一性原理推演、數學模型與思想實驗，結合同步數值模擬驗證。';

  useSEO({
    title: `${categoryTitle} | MIRARI 數位科學雜誌`,
    description: categoryDescription,
  });

  // Filter and sort articles by publication date descending
  const allArticles = useMemo(() => {
    return ARTICLES.filter((a) => a.status === 'published' && a.editorialCategory === category).sort((a, b) => {
      const dateA = a.publishedDate || '';
      const dateB = b.publishedDate || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return a.id.localeCompare(b.id);
    });
  }, [category]);

  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [category]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (visibleCount >= allArticles.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allArticles.length));
        }
      },
      { rootMargin: '200px' }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [visibleCount, allArticles.length]);

  const visibleArticles = allArticles.slice(0, visibleCount);

  const getArticleTopicNames = (article: Article) => {
    return article.topicIds
      .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <main className="bg-mirari-paper text-mirari-ink min-h-[70vh]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
        {/* Category Header */}
        <header className="border-b border-mirari-line pb-8 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-sans font-semibold tracking-wider">
            <Link to="/" className="text-mirari-muted hover:text-mirari-ink transition">
              首頁
            </Link>
            <span className="text-mirari-dim">/</span>
            <span className={isJournal ? 'text-mirari-cobalt' : 'text-mirari-amber'}>{categoryTag}</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-mirari-ink">
            {categoryTitle}
          </h1>

          <p className="text-sm sm:text-base text-mirari-muted font-sans leading-relaxed max-w-2xl">
            {categoryDescription}
          </p>
        </header>

        {/* Content: Empty State or Vertical Article List */}
        {allArticles.length === 0 ? (
          <div className="py-16 sm:py-24 text-center space-y-4 rounded-2xl border border-dashed border-mirari-line bg-white/40 p-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-mirari-paper border border-mirari-line flex items-center justify-center text-mirari-dim">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="font-serif text-lg font-bold text-mirari-ink">目前暫無{categoryTitle}篇章</h2>
            <p className="text-xs sm:text-sm text-mirari-muted font-sans max-w-md mx-auto leading-relaxed">
              編輯部正在進行最新同儕審查文獻之深度查證與數值驗證，篇章將於通過自主編輯審核後即刻刊登。
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center text-xs font-medium text-mirari-ink hover:text-mirari-amber transition"
              >
                ← 返回雜誌首頁
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => navigate(`/articles/${article.slug}`)}
                className="group p-6 sm:p-8 rounded-2xl border border-mirari-line bg-white hover:border-mirari-border hover:shadow-md transition cursor-pointer space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-sans font-semibold ${
                        isJournal ? 'text-mirari-cobalt' : 'text-mirari-amber'
                      }`}
                    >
                      {isJournal
                        ? article.journalReference
                          ? `${article.journalReference.journal} · ${article.journalReference.year}`
                          : '期刊論文解讀'
                        : article.formatBadgeText}
                    </span>
                    <span className="text-mirari-dim">·</span>
                    <span className="text-mirari-muted font-sans">{getArticleTopicNames(article)}</span>
                  </div>
                  <time className="text-[11px] font-mono text-mirari-dim bg-mirari-paper px-2 py-0.5 rounded border border-mirari-line">
                    {article.publishedDate}
                  </time>
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-mirari-ink group-hover:text-mirari-amber transition leading-snug">
                    <Link
                      to={`/articles/${article.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {article.title}
                    </Link>
                  </h2>
                  <p className="font-serif text-sm sm:text-base text-mirari-muted leading-relaxed">
                    {article.subtitle}
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-mirari-muted/90 font-sans leading-relaxed">
                  {article.summary || article.leadParagraph}
                </p>

                <div className="pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs font-sans">
                  <span className="text-mirari-dim">
                    {article.formatBadgeText || '完整科學篇章與互動模擬'}
                  </span>
                  <span className="text-mirari-ink font-medium group-hover:text-mirari-amber transition flex items-center space-x-1">
                    <span>閱讀全文</span>
                    <span>→</span>
                  </span>
                </div>
              </article>
            ))}

            {/* Sentinel element for infinite scrolling */}
            {visibleCount < allArticles.length && (
              <div ref={sentinelRef} className="py-6 text-center text-xs text-mirari-dim font-sans">
                載入更多篇章中...
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
