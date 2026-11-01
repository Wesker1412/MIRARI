import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EDITORIAL_SERIES } from '../../data/series';
import { ARTICLES } from '../../data/articles';
import { NotFoundPage } from './NotFoundPage';
import { useSEO } from '../seo/useSEO';

export const SeriesPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const series = EDITORIAL_SERIES.find((s) => s.slug === slug);

  useSEO({
    title: series ? `《${series.title}》系列專題` : '系列專題',
    description: series?.description || 'MIRARI 深度科學系列專題。',
  });

  if (!series) {
    return (
      <NotFoundPage
        title="404 · 系列專題未找到"
        message={`您所探尋的系列專題「${slug || ''}」目前不存在。`}
        slug={slug}
      />
    );
  }

  // Articles belonging to this series
  const seriesArticles = ARTICLES.filter(
    (a) => a.seriesId === series.id || a.id === series.featuredArticleId
  );

  const isPlanning = series.status === 'planning';
  const publishedCount = seriesArticles.filter((a) => a.status === 'published').length;

  return (
    <div className="min-h-screen bg-mirari-paper text-mirari-ink pb-24">
      {/* Editorial Nav */}
      <header className="sticky top-0 z-30 border-b border-mirari-line bg-mirari-paper/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-sans text-mirari-muted hover:text-mirari-ink transition px-3 py-1.5 rounded-lg border border-mirari-line hover:border-mirari-border"
        >
          返回 MIRARI 首頁
        </button>
        <span className="font-serif text-sm font-semibold text-mirari-ink">
          系列特輯 · {series.title}
        </span>
      </header>

      {/* Series Masthead */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 space-y-10">
        <div className="space-y-4 pb-8 border-b border-mirari-line">
          <div className="flex items-center space-x-2 text-xs font-sans">
            <span className="uppercase tracking-wider font-semibold text-mirari-amber">
              {isPlanning ? '系列專題策劃預告' : 'EDITORIAL SERIES'}
            </span>
            <span className="text-mirari-dim">·</span>
            <span className="text-mirari-dim">
              {isPlanning
                ? `編輯部規劃中（預計收錄 ${series.totalPlannedArticles || 4} 篇）`
                : `已發布 ${publishedCount} 篇`}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-mirari-ink leading-tight">
            {series.title}
          </h1>

          <p className="font-serif text-lg sm:text-xl text-mirari-muted leading-relaxed font-normal">
            {series.subtitle}
          </p>

          <p className="text-sm sm:text-base text-mirari-muted/90 leading-relaxed font-sans pt-2">
            {series.description}
          </p>
        </div>

        {/* Series Articles Breakdown */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-mirari-line">
            <h2 className="font-serif text-xl font-bold text-mirari-ink">
              收錄篇章篇目
            </h2>
            <span className="text-xs font-sans text-mirari-dim">
              {seriesArticles.length > 0 ? `共 ${seriesArticles.length} 篇關聯篇章` : '篇目編纂中'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {seriesArticles.map((article) => {
              const isPublished = article.status === 'published';
              return (
                <div
                  key={article.id}
                  onClick={() => {
                    if (isPublished) {
                      navigate(`/articles/${article.slug}`);
                    }
                  }}
                  className={`p-6 rounded-2xl border transition ${
                    isPublished
                      ? 'border-mirari-line hover:border-mirari-border bg-white cursor-pointer hover:shadow-md'
                      : 'border-mirari-line/70 bg-mirari-paper cursor-default opacity-85'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between text-xs font-sans mb-2 gap-2">
                    <span className="text-mirari-amber font-medium">
                      {article.formatBadgeText}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] border ${
                        isPublished
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-mirari-dim bg-mirari-paper border-mirari-line'
                      }`}
                    >
                      {isPublished ? '正式發布' : '籌備中'}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mb-2">
                    {article.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-mirari-muted font-sans leading-relaxed mb-4">
                    {article.summary}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-mirari-line/60 text-xs font-sans">
                    <span className="text-mirari-dim">
                      {article.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
                    </span>
                    <span
                      className={`font-medium ${
                        isPublished ? 'text-mirari-ink hover:text-mirari-amber' : 'text-mirari-dim'
                      }`}
                    >
                      {isPublished ? '進入閱讀 →' : '策劃中 · 尚未公開'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
