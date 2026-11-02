import React, { useState } from 'react';
import type { ArticleDocument } from '../../types';
import type { RankedCoverArticle } from '../../services/CoverRankingService';
import { CoverVisualCard } from './CoverVisualCard';
import { TOPICS } from '../../data/topics';

interface CoverStoryCarouselProps {
  rankedStories: RankedCoverArticle[];
  onSelectArticle: (article: ArticleDocument) => void;
}

export const CoverStoryCarousel: React.FC<CoverStoryCarouselProps> = ({
  rankedStories,
  onSelectArticle,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const total = rankedStories.length;

  if (total === 0) return null;

  const currentRanked = rankedStories[currentIndex] || rankedStories[0];
  const currentArticle = currentRanked.article;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const getArticleTopicNames = (article: ArticleDocument) => {
    return article.topicIds
      .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <section id="cover-story" className="border-b border-mirari-line py-10 sm:py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Carousel Header & Navigation Controls */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-mirari-line/60">
          <div className="flex items-center space-x-3">
            <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold">
              COVER STORIES
            </span>
            <span className="text-mirari-line">|</span>
            <span className="text-xs text-mirari-dim font-sans">
              由封面演算法客觀推薦之學術篇章
            </span>
          </div>

          {/* Prev/Next Controls + Page Indicator */}
          <div className="flex items-center space-x-3 text-xs font-sans">
            <span className="font-mono text-mirari-dim">
              {currentIndex + 1} / {total}
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handlePrev}
                aria-label="上一篇封面故事"
                className="w-8 h-8 rounded-full border border-mirari-line bg-white hover:border-mirari-border hover:bg-mirari-surfaceAlt flex items-center justify-center text-mirari-ink transition active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleNext}
                aria-label="下一篇封面故事"
                className="w-8 h-8 rounded-full border border-mirari-line bg-white hover:border-mirari-border hover:bg-mirari-surfaceAlt flex items-center justify-center text-mirari-ink transition active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Current Cover Spread Slide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center transition-opacity duration-300">
          {/* Left: Article Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold tracking-wider">
              <span>封面推薦 #{currentRanked.rank}</span>
              <span className="text-mirari-dim">·</span>
              <span className="text-mirari-muted">{getArticleTopicNames(currentArticle)}</span>
              {currentArticle.publishedDate && (
                <>
                  <span className="text-mirari-dim">·</span>
                  <span className="text-mirari-dim font-mono">{currentArticle.publishedDate}</span>
                </>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-mirari-ink leading-[1.15]">
              {currentArticle.title}
            </h1>

            <p className="font-serif text-base sm:text-xl text-mirari-muted leading-relaxed font-normal">
              {currentArticle.subtitle}
            </p>

            <p className="text-sm sm:text-base text-mirari-muted/90 leading-relaxed font-sans line-clamp-3">
              {currentArticle.leadParagraph || currentArticle.summary}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => onSelectArticle(currentArticle)}
                className="inline-flex items-center rounded-xl bg-mirari-ink px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-95 transition font-sans"
              >
                進入互動閱讀 →
              </button>

              <div className="text-xs text-mirari-dim font-sans">
                {currentArticle.formatBadgeText || '包含即時數值模擬實驗'}
              </div>
            </div>
          </div>

          {/* Right: Tailored Scientific Visual Card */}
          <div className="lg:col-span-5 relative">
            <CoverVisualCard
              article={currentArticle}
              onClick={() => onSelectArticle(currentArticle)}
            />

            {/* Mascot Hero Greeting Anchor */}
            <div
              id="mirari-hero-anchor"
              className="absolute -bottom-8 -right-4 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none"
            />
          </div>
        </div>

        {/* Carousel Slide Indicators (Dots / Pills) */}
        <div className="mt-10 flex items-center justify-center space-x-2">
          {rankedStories.map((item, idx) => (
            <button
              key={item.article.id}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`切換至封面 ${idx + 1}`}
              className={`h-1.5 transition-all rounded-full ${
                idx === currentIndex
                  ? 'w-8 bg-mirari-ink'
                  : 'w-2 bg-mirari-line hover:bg-mirari-border'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
