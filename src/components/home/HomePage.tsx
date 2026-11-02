import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../types';
import { TOPICS } from '../../data/topics';
import { ARTICLES } from '../../data/articles';
import { useSEO } from '../seo/useSEO';
import { CoverRankingService } from '../../services/CoverRankingService';
import { CoverVisualCard } from './CoverVisualCard';

interface HomePageProps {
  onSelectArticle: (article: Article) => void;
  onExploreTopic?: (topicId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectArticle,
}) => {
  useSEO(); // Reset to default home SEO when mounting home view

  // ─── 板塊一：封面故事（CoverRankingService 排序，最多五篇自動輪播） ───
  const rankedStories = useMemo(() => CoverRankingService.rankCoverStories(ARTICLES), []);
  const totalCovers = Math.min(rankedStories.length, 5);
  const [coverIndex, setCoverIndex] = useState<number>(0);
  const [isCoverPaused, setIsCoverPaused] = useState<boolean>(false);
  const coverSectionRef = useRef<HTMLElement>(null);

  const currentCover = rankedStories[coverIndex]?.article || rankedStories[0]?.article || ARTICLES[0];

  // 檢查 prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // 7 秒自動輪播計時器（滑鼠懸停、頁面隱藏、鍵盤互動或減弱動態偏好時暫停）
  useEffect(() => {
    if (totalCovers <= 1 || prefersReducedMotion) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (!isCoverPaused && !document.hidden) {
          setCoverIndex((prev) => (prev + 1) % totalCovers);
        }
      }, 7000);
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
      } else {
        startTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [totalCovers, isCoverPaused, prefersReducedMotion]);

  // ─── 板塊二：期刊解讀（依發布時間由新到舊排序，目前 0 篇） ───────────
  const journalArticles = useMemo(() => {
    return ARTICLES
      .filter((a) => a.status === 'published' && a.editorialCategory === 'journal_interpretation')
      .sort((a, b) => {
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.id.localeCompare(b.id);
      });
  }, []);

  // ─── 板塊三：科學原理與思想實驗（依發布時間由新到舊排序） ───────────
  const principlesArticles = useMemo(() => {
    return ARTICLES
      .filter((a) => a.status === 'published' && a.editorialCategory === 'scientific_principles')
      .sort((a, b) => {
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.id.localeCompare(b.id);
      });
  }, []);

  // Helper to get topic names for an article
  const getArticleTopicNames = (article: Article) => {
    return article.topicIds
      .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div className="bg-mirari-paper text-mirari-ink">
      {/* ─── 板塊一：封面故事 (Hero Magazine Cover Spread) ─────────── */}
      <section
        id="cover-story"
        ref={coverSectionRef}
        onMouseEnter={() => setIsCoverPaused(true)}
        onMouseLeave={() => setIsCoverPaused(false)}
        onFocus={() => setIsCoverPaused(true)}
        onBlur={() => setIsCoverPaused(false)}
        className="border-b border-mirari-line py-10 sm:py-16 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: Headline Narrative (Fixed Height Container to prevent jump) */}
            <div className="lg:col-span-7 flex flex-col justify-between min-h-[340px] sm:min-h-[380px] space-y-4">
              <div className="space-y-3">
                {/* Topic tags row */}
                <div className="h-5 flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold tracking-wider">
                  <span>封面故事</span>
                  <span className="text-mirari-dim">·</span>
                  <span className="text-mirari-muted">{getArticleTopicNames(currentCover)}</span>
                </div>

                {/* Title (Consistent height allocation) */}
                <div className="min-h-[4.5rem] sm:min-h-[5.5rem] lg:min-h-[6.5rem] flex items-center">
                  <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-mirari-ink leading-[1.18] line-clamp-2">
                    {currentCover.title}
                  </h1>
                </div>

                {/* Subtitle (Consistent height allocation) */}
                <div className="min-h-[3rem] sm:min-h-[3.5rem] flex items-center">
                  <p className="font-serif text-base sm:text-lg text-mirari-muted leading-relaxed font-normal line-clamp-2">
                    {currentCover.subtitle}
                  </p>
                </div>

                {/* Lead Paragraph / Summary (Consistent height allocation) */}
                <div className="min-h-[4rem] sm:min-h-[4.5rem] flex items-center">
                  <p className="text-xs sm:text-sm text-mirari-muted/90 leading-relaxed font-sans line-clamp-3">
                    {currentCover.leadParagraph || currentCover.summary}
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectArticle(currentCover)}
                  className="inline-flex items-center rounded-xl bg-mirari-ink px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-95 transition font-sans"
                >
                  進入互動閱讀
                </button>

                <div className="text-xs text-mirari-dim font-sans">
                  {currentCover.formatBadgeText || '包含即時數值與視覺模擬實驗'}
                </div>
              </div>
            </div>

            {/* Right: Graphic Spread + Mascot Hero View (Fixed Height Container) */}
            <div className="lg:col-span-5 relative">
              <CoverVisualCard
                article={currentCover}
                onClick={() => onSelectArticle(currentCover)}
              />

              {/* Anchor placeholder for the persistent global MIRARI mascot */}
              <div
                id="mirari-hero-anchor"
                className="absolute -bottom-8 -right-4 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none"
              />
            </div>
          </div>

          {/* Dots Indicator below Cover Spread */}
          {totalCovers > 1 && (
            <div className="mt-8 sm:mt-12 flex items-center justify-center space-x-2">
              {rankedStories.slice(0, totalCovers).map((story, idx) => {
                const isActive = idx === coverIndex;
                return (
                  <button
                    key={story.article.id}
                    onClick={() => {
                      setCoverIndex(idx);
                      setIsCoverPaused(true);
                      setTimeout(() => setIsCoverPaused(false), 8000);
                    }}
                    aria-label={`切換至封面篇章 ${idx + 1}：${story.article.title}`}
                    aria-current={isActive ? 'true' : 'false'}
                    className={`transition-all duration-300 rounded-full h-2.5 focus:outline-none focus:ring-2 focus:ring-mirari-amber/50 ${
                      isActive
                        ? 'w-8 bg-mirari-ink'
                        : 'w-2.5 bg-mirari-line hover:bg-mirari-dim'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── 板塊二：期刊解讀 (目前 0 篇時自動隱藏，有文章時自動呈現) ─── */}
      {journalArticles.length > 0 && (
        <section id="journal-research" className="py-12 border-t border-mirari-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
              <div>
                <span className="text-xs uppercase tracking-wider text-mirari-cobalt font-sans font-semibold block">
                  最新科學動態與研究突破
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                  期刊解讀
                </h2>
              </div>
              <span className="text-xs text-mirari-dim font-sans">
                最新科學發現、重要研究成果、技術研發突破與重大科學事件
              </span>
            </div>

            {/* Horizontal Scrollable Row (Scroll-snap) */}
            <div className="flex space-x-6 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory focus:outline-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
              {journalArticles.slice(0, 9).map((article) => (
                <article
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectArticle(article);
                    }
                  }}
                  className="snap-start shrink-0 w-[300px] sm:w-[340px] md:w-[360px] rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-mirari-cobalt/50 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-sans font-medium text-mirari-cobalt">
                        {article.journalReference
                          ? `${article.journalReference.journal} · ${article.journalReference.year}`
                          : '期刊論文解讀'}
                      </span>
                      <span className="text-[11px] text-mirari-dim font-mono bg-mirari-paper px-2 py-0.5 rounded border border-mirari-line">
                        {article.publishedDate}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2 leading-snug">
                      {article.title}
                    </h3>

                    <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim font-sans">
                    <span>{getArticleTopicNames(article)}</span>
                    <span className="text-mirari-ink font-medium group-hover:text-mirari-amber transition">
                      查看詳情
                    </span>
                  </div>
                </article>
              ))}

              {/* 10th Card: Explore More if > 9 articles */}
              {journalArticles.length > 9 && (
                <Link
                  to="/journal"
                  className="snap-start shrink-0 w-[240px] sm:w-[280px] rounded-2xl border-2 border-dashed border-mirari-line bg-white/60 hover:bg-white hover:border-mirari-cobalt/60 p-6 flex flex-col items-center justify-center text-center group transition cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-mirari-paper border border-mirari-line flex items-center justify-center text-mirari-dim group-hover:text-mirari-cobalt group-hover:scale-110 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                  <h4 className="mt-4 font-serif text-base font-bold text-mirari-ink group-hover:text-mirari-cobalt transition">
                    探索更多期刊解讀
                  </h4>
                  <p className="mt-1 text-xs text-mirari-muted font-sans">
                    瀏覽全部 {journalArticles.length} 篇收錄文章
                  </p>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── 板塊三：科學原理與思想實驗 (橫向滑動卡片列) ─────────────── */}
      <section id="principles-experiments" className="py-12 border-t border-mirari-line bg-mirari-surfaceAlt/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                思想實驗與基石
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                科學原理與思想實驗
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              具有長期探索價值的科學核心課題
            </span>
          </div>

          {/* Horizontal Scrollable Row (Scroll-snap, Touch Swipe & Keyboard Support) */}
          <div className="flex space-x-6 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory focus:outline-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
            {principlesArticles.slice(0, 9).map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectArticle(article);
                  }
                }}
                className="snap-start shrink-0 w-[300px] sm:w-[340px] md:w-[360px] rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-mirari-amber/50 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-amber">
                      {article.formatBadgeText}
                    </span>
                    <span className="text-[11px] text-mirari-dim font-mono bg-mirari-paper px-2 py-0.5 rounded border border-mirari-line">
                      {article.publishedDate}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim font-sans">
                  <span>{getArticleTopicNames(article)}</span>
                  <span className="text-mirari-ink font-medium group-hover:text-mirari-amber transition">
                    查看詳情
                  </span>
                </div>
              </article>
            ))}

            {/* 10th Card: Explore More if > 9 articles */}
            {principlesArticles.length > 9 && (
              <Link
                to="/principles"
                className="snap-start shrink-0 w-[240px] sm:w-[280px] rounded-2xl border-2 border-dashed border-mirari-line bg-white/60 hover:bg-white hover:border-mirari-amber/60 p-6 flex flex-col items-center justify-center text-center group transition cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-mirari-paper border border-mirari-line flex items-center justify-center text-mirari-dim group-hover:text-mirari-amber group-hover:scale-110 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <h4 className="mt-4 font-serif text-base font-bold text-mirari-ink group-hover:text-mirari-amber transition">
                  探索更多科學原理
                </h4>
                <p className="mt-1 text-xs text-mirari-muted font-sans">
                  瀏覽全部 {principlesArticles.length} 篇收錄文章
                </p>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─── 板塊四：與 MIRARI 一起探索 (簡潔專注的探索體驗) ───────────── */}
      <section id="explore-mirari" className="py-16 sm:py-24 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
              知識探索
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-mirari-ink">
              與 MIRARI 一起探索
            </h2>
            <p className="text-sm sm:text-base text-mirari-muted font-sans leading-relaxed">
              輸入感興趣的科學概念、現象或原理，MIRARI 將引導您探索站內的深度論述與互動數值實驗。
            </p>
            {/* Anchor placeholder for the persistent global MIRARI mascot */}
            <div className="pt-2 flex justify-center">
              <div id="explore-mirari-anchor" className="w-16 h-16 pointer-events-none select-none" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
