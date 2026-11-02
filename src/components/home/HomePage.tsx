import React, { useState, useMemo } from 'react';
import type { Article } from '../../types';
import { TOPICS, getTopicArticleCount } from '../../data/topics';
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
  onExploreTopic,
}) => {
  useSEO(); // Reset to default home SEO when mounting home view
  const [selectedTopicId, setSelectedTopicId] = useState<string | 'all'>('all');

  // ─── 板塊一：封面故事（CoverRankingService 排序，支援最多五篇輪播） ───
  const rankedStories = useMemo(() => CoverRankingService.rankCoverStories(ARTICLES), []);
  const [coverIndex, setCoverIndex] = useState<number>(0);
  const totalCovers = rankedStories.length;
  const currentCover = rankedStories[coverIndex]?.article || rankedStories[0]?.article || ARTICLES[0];

  // ─── 板塊二：期刊解讀（依發布時間由新到舊排序） ────────────────────
  const researchArticles = useMemo(() => {
    return ARTICLES
      .filter((a) => a.status === 'published' && (a.isResearchHighlight || a.journalReference))
      .sort((a, b) => {
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.id.localeCompare(b.id);
      });
  }, []);

  // ─── 板塊三：科學原理與思想實驗（依發布時間由新到舊排序） ───────────
  const classicArticles = useMemo(() => {
    return ARTICLES
      .filter((a) => a.status === 'published' && (a.isClassicFoundation || a.format === 'interactive_simulation'))
      .sort((a, b) => {
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.id.localeCompare(b.id);
      });
  }, []);

  // ─── 板塊四：動態科學主題 ──────────────────────────────────────────
  const activeTopics = TOPICS.filter((t) => t.isActive);

  const filteredArticles = useMemo(() => {
    if (selectedTopicId === 'all') return [];
    return ARTICLES.filter((a) => a.status === 'published' && a.topicIds.includes(selectedTopicId));
  }, [selectedTopicId]);

  const currentSelectedTopic =
    selectedTopicId === 'all' ? null : TOPICS.find((t) => t.id === selectedTopicId);

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
      <section id="cover-story" className="border-b border-mirari-line py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: Headline Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold tracking-wider">
                <span>封面故事</span>
                <span className="text-mirari-dim">·</span>
                <span className="text-mirari-muted">{getArticleTopicNames(currentCover)}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-mirari-ink leading-[1.15]">
                {currentCover.title}
              </h1>

              <p className="font-serif text-lg sm:text-xl text-mirari-muted leading-relaxed font-normal">
                {currentCover.subtitle}
              </p>

              <p className="text-sm sm:text-base text-mirari-muted/90 leading-relaxed font-sans line-clamp-3">
                {currentCover.leadParagraph || currentCover.summary}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectArticle(currentCover)}
                  className="inline-flex items-center rounded-xl bg-mirari-ink px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-95 transition font-sans"
                >
                  進入互動閱讀
                </button>

                {totalCovers > 1 && (
                  <div className="flex items-center space-x-1 border border-mirari-line rounded-xl px-2 py-1.5 bg-white shadow-xs">
                    <button
                      onClick={() => setCoverIndex((prev) => (prev > 0 ? prev - 1 : totalCovers - 1))}
                      aria-label="上一篇封面"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-mirari-dim hover:text-mirari-ink hover:bg-mirari-paper transition active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="font-mono text-xs text-mirari-dim px-2 select-none">
                      {coverIndex + 1} / {totalCovers}
                    </span>
                    <button
                      onClick={() => setCoverIndex((prev) => (prev < totalCovers - 1 ? prev + 1 : 0))}
                      aria-label="下一篇封面"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-mirari-dim hover:text-mirari-ink hover:bg-mirari-paper transition active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="text-xs text-mirari-dim font-sans">
                  {currentCover.formatBadgeText || '包含即時數值與視覺模擬實驗'}
                </div>
              </div>
            </div>

            {/* Right: Graphic Spread + Mascot Hero View */}
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
        </div>
      </section>

      {/* ─── 板塊二：期刊解讀 (Research Monitor) ───────────────────── */}
      <section id="journal-research" className="py-12 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-cobalt font-sans font-semibold block">
                學術研究追蹤
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                期刊解讀
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              以同儕審查學術文獻為基礎的深度科學剖析
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {researchArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-cobalt">
                      {article.journalReference?.journal} · {article.journalReference?.year}
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
          </div>
        </div>
      </section>

      {/* ─── 板塊三：科學原理與思想實驗 (Principles & Experiments) ──── */}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {classicArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-amber">
                      {article.formatBadgeText}
                    </span>
                    <span className="text-[11px] text-mirari-dim font-mono">
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
          </div>
        </div>
      </section>

      {/* ─── 板塊四：探索科學主題 (與 MIRARI 一起探索) ──────────────── */}
      <section id="explore-mirari" className="py-14 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between mb-10 gap-4">
            <div className="max-w-xl space-y-2">
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                動態知識體系
              </span>
              <h2 className="font-serif text-3xl font-bold text-mirari-ink">
                探索科學主題
              </h2>
              <p className="text-xs sm:text-sm text-mirari-muted font-sans">
                涵蓋從深空天體、微觀量子至神經認知的動態知識網絡，隨編輯部研究進展持續增長。
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {selectedTopicId !== 'all' && (
                <button
                  onClick={() => setSelectedTopicId('all')}
                  className="text-xs font-sans text-mirari-ink hover:text-mirari-amber border border-mirari-line px-3 py-1.5 rounded-lg bg-white transition"
                >
                  顯示全部主題
                </button>
              )}
              {/* Mascot anchor for exploration section */}
              <div id="explore-mirari-anchor" className="w-10 h-10 pointer-events-none select-none" />
            </div>
          </div>

          {/* Dynamic Topic Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTopics.map((topic, idx) => {
              const counts = getTopicArticleCount(topic.id, ARTICLES);
              const isSelected = selectedTopicId === topic.id;

              return (
                <div
                  key={topic.id}
                  onClick={() => {
                    setSelectedTopicId(isSelected ? 'all' : topic.id);
                    if (onExploreTopic) onExploreTopic(topic.id);
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? 'border-mirari-amber bg-white shadow-md ring-1 ring-mirari-amber/20'
                      : 'border-mirari-line bg-white hover:border-mirari-border hover:shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-mono font-bold text-mirari-dim">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-mono text-mirari-dim uppercase tracking-wider">
                        {topic.nameEn}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition">
                      {topic.nameZh}
                    </h3>

                    <p className="mt-2 text-xs text-mirari-muted line-clamp-2 leading-relaxed font-sans">
                      {topic.tagline}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-mirari-line/60 text-[11px] font-sans text-mirari-dim flex items-center justify-between">
                    <span>
                      {counts.published > 0
                        ? `${counts.published} 篇發布`
                        : '即將收錄'}
                    </span>
                    <span
                      className={`font-medium transition ${
                        isSelected
                          ? 'text-mirari-amber'
                          : 'text-mirari-ink group-hover:text-mirari-amber'
                      }`}
                    >
                      {isSelected ? '已選取' : '檢視主題'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filtered view if a specific topic is selected */}
          {selectedTopicId !== 'all' && currentSelectedTopic && (
            <div className="mt-8 p-6 rounded-2xl bg-white border border-mirari-line space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-mirari-line/60">
                <div className="space-y-0.5">
                  <span className="text-xs font-sans text-mirari-amber font-semibold block">
                    主題篩選結果
                  </span>
                  <h4 className="font-serif text-lg font-bold text-mirari-ink">
                    【{currentSelectedTopic.nameZh}】收錄篇章（共 {filteredArticles.length} 篇）
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedTopicId('all')}
                  className="text-xs text-mirari-dim hover:text-mirari-ink underline font-sans"
                >
                  清除篩選
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => onSelectArticle(art)}
                    className="p-4 rounded-xl border border-mirari-line hover:border-mirari-border transition cursor-pointer bg-mirari-paper flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-[11px]">
                        <span className="text-mirari-amber font-medium">
                          {art.formatBadgeText}
                        </span>
                        <span className="text-mirari-dim font-mono">
                          {art.publishedDate}
                        </span>
                      </div>
                      <h5 className="font-serif text-sm font-bold text-mirari-ink line-clamp-1">
                        {art.title}
                      </h5>
                      <p className="mt-1 text-xs text-mirari-muted line-clamp-2">
                        {art.summary}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-mirari-line/60 flex items-center justify-between text-[11px] text-mirari-dim">
                      <span>{getArticleTopicNames(art)}</span>
                      <span className="text-mirari-ink font-medium">開始閱讀</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
