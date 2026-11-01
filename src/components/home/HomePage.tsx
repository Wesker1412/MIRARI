import React, { useState } from 'react';
import type { Article, Series } from '../../types';
import { TOPICS, getTopicArticleCount } from '../../data/topics';
import { ARTICLES } from '../../data/articles';
import { EDITORIAL_SERIES } from '../../data/series';
import { useSEO } from '../seo/useSEO';

interface HomePageProps {
  onSelectArticle: (article: Article) => void;
  onExploreTopic?: (topicId: string) => void;
  onSelectSeries?: (series: Series) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectArticle,
  onExploreTopic,
  onSelectSeries,
}) => {
  useSEO(); // Reset to default home SEO when mounting home view
  const [selectedTopicId, setSelectedTopicId] = useState<string | 'all'>('all');
  const [prepArticleModal, setPrepArticleModal] = useState<Article | null>(null);

  // ─── Editorial Curation Rules (嚴謹區分封面、編輯精選與系列特輯) ─────────
  // 1. 封面文章：編輯指定的單篇正式發布文章 (isEditorialCover)，最多一篇；無設定時取最新已發布文章
  const designatedCover = ARTICLES.find((a) => a.isEditorialCover && a.status === 'published');
  const latestPublished = ARTICLES.find((a) => a.status === 'published');
  const coverArticle = designatedCover || latestPublished || ARTICLES[0];
  const isExplicitEditorialCover = !!designatedCover;

  // 2. 編輯精選：由編輯指定的高品質文章集合 (isEditorialPick)，可同時有多篇
  const editorialPicks = ARTICLES.filter((a) => a.isEditorialPick);

  // 3. 系列特輯：由獨立 Series 資料與文章關聯管理
  const primarySeries = EDITORIAL_SERIES[0];
  const seriesArticles = primarySeries ? ARTICLES.filter((a) => a.seriesId === primarySeries.id) : [];
  const seriesPublishedCount = seriesArticles.filter((a) => a.status === 'published').length;
  // 判斷系列是否達到正式發布展示條件（非單純籌備中，且具備至少 2 篇正式發布文章）
  const isSeriesReady = primarySeries && primarySeries.status !== 'planning' && seriesPublishedCount >= 2;
  const seriesArticle = seriesArticles.find((a) => a.status === 'published') || seriesArticles[0] || ARTICLES[0];

  const researchArticles = ARTICLES.filter((a) => a.isResearchHighlight);
  const classicArticles = ARTICLES.filter((a) => a.isClassicFoundation);

  const handleArticleClick = (article: Article) => {
    if (article.status === 'published') {
      onSelectArticle(article);
    } else {
      setPrepArticleModal(article);
    }
  };

  // Filtered articles dynamically by topic
  const filteredArticles =
    selectedTopicId === 'all'
      ? ARTICLES
      : ARTICLES.filter((a) => a.topicIds.includes(selectedTopicId));

  const currentSelectedTopic =
    selectedTopicId === 'all' ? null : TOPICS.find((t) => t.id === selectedTopicId);

  // Active topics to display
  const activeTopics = TOPICS.filter((t) => t.isActive);

  // Get topic names for an article
  const getArticleTopicNames = (article: Article) => {
    return article.topicIds
      .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div className="bg-mirari-paper text-mirari-ink">
      {/* ─── Cover Feature Spread (Hero Magazine Cover) ────────────── */}
      <section id="cover-story" className="border-b border-mirari-line py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: Headline Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold tracking-wider">
                <span>{isExplicitEditorialCover ? '本期封面故事' : '最新發布篇章'}</span>
                <span className="text-mirari-dim">·</span>
                <span className="text-mirari-muted">{getArticleTopicNames(coverArticle)}</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-mirari-ink leading-[1.15]">
                {coverArticle.title}
              </h1>

              <p className="font-serif text-lg sm:text-xl text-mirari-muted leading-relaxed font-normal">
                {coverArticle.subtitle}
              </p>

              <p className="text-sm sm:text-base text-mirari-muted/90 leading-relaxed font-sans line-clamp-3">
                {coverArticle.leadParagraph}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectArticle(coverArticle)}
                  className="inline-flex items-center rounded-xl bg-mirari-ink px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-95 transition font-sans"
                >
                  進入互動閱讀
                </button>

                <div className="text-xs text-mirari-dim font-sans">
                  包含恆星空間投影與即時光度模擬
                </div>
              </div>
            </div>

            {/* Right: Graphic Astronomical Spread + Mascot Hero View */}
            <div className="lg:col-span-5 relative">
              <div
                onClick={() => onSelectArticle(coverArticle)}
                className="group relative rounded-3xl bg-mirari-space p-6 sm:p-8 cursor-pointer shadow-xl overflow-hidden border border-mirari-spaceBorder transition-all duration-300 hover:border-mirari-amber/40"
              >
                {/* Visual Starfield Header */}
                <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
                  <span>TRANSIT OBSERVATION</span>
                  <span className="text-amber-400">ΔF / F₀ = (Rp/R*)²</span>
                </div>

                {/* Graphic Transit Visual */}
                <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-mirari-spacePlate to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                  {/* Star */}
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-100 shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center justify-center relative">
                    {/* Planet shadow passing */}
                    <div className="w-6 h-6 rounded-full bg-black border border-sky-400/80 absolute -left-2 shadow-md" />
                  </div>
                  {/* Transit line */}
                  <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-sky-400/30" />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>點選直接體驗幾何光度實驗</span>
                  <span className="text-white group-hover:text-amber-400 font-medium transition">
                    開始探索
                  </span>
                </div>
              </div>

              {/* Anchor placeholder for the persistent global MIRARI mascot */}
              <div
                id="mirari-hero-anchor"
                className="absolute -bottom-8 -right-4 w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Editorial Picks (編輯精選 - 由編輯指定之高品質篇章集合) ─────── */}
      <section id="editorial-picks" className="py-12 border-b border-mirari-line bg-mirari-surfaceAlt/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                EDITORIAL PICKS
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                編輯精選
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              由編輯部審選之深度科普與思想實驗（可同時收錄多篇）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {editorialPicks.map((article) => (
              <article
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-amber">
                      編輯精選 · {article.formatBadgeText}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded border ${
                      article.status === 'published'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-mirari-dim bg-mirari-paper border-mirari-line'
                    }`}>
                      {article.status === 'published' ? '正式發布' : '籌備中'}
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
                    {article.status === 'published' ? '開始閱讀' : '查看選題'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Research Monitor (最新研究追蹤) ───────────────────────── */}
      <section id="research-monitor" className="py-12 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-cobalt font-sans font-semibold block">
                學術研究追蹤
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                近期期刊解讀
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              由編輯部整理之學術文獻深度摘要（專題籌備中）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {researchArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-cobalt">
                      {article.journalReference?.journal} · {article.journalReference?.year}
                    </span>
                    <span className="text-[11px] text-mirari-dim bg-mirari-paper px-2 py-0.5 rounded border border-mirari-line">
                      企劃中
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

      {/* ─── Classic Foundations (經典科普與思想實驗) ──────────────── */}
      <section id="classic-foundations" className="py-12 border-t border-mirari-line bg-mirari-surfaceAlt/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                思想實驗與基石
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                經典物理與科學本質
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
                onClick={() => handleArticleClick(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <span className="text-xs font-sans text-mirari-amber font-medium block">
                    {article.formatBadgeText}
                  </span>

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

      {/* ─── Dynamic Science Topics (動態科學主題 - 自由成長分類) ──────── */}
      <section id="explore-topics" className="py-14 border-t border-mirari-line">
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

            {selectedTopicId !== 'all' && (
              <button
                onClick={() => setSelectedTopicId('all')}
                className="text-xs font-sans text-mirari-ink hover:text-mirari-amber border border-mirari-line px-3 py-1.5 rounded-lg bg-white transition"
              >
                顯示全部主題
              </button>
            )}
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
                      {counts.total === 0
                        ? '即將收錄'
                        : counts.published > 0
                        ? `${counts.published} 篇發布 · ${counts.inPreparation} 篇籌備`
                        : `${counts.inPreparation} 篇籌備中`}
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
                    onClick={() => handleArticleClick(art)}
                    className="p-4 rounded-xl border border-mirari-line hover:border-mirari-border transition cursor-pointer bg-mirari-paper flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5 text-[11px]">
                        <span className="text-mirari-amber font-medium">
                          {art.formatBadgeText}
                        </span>
                        <span className="text-mirari-dim">
                          {art.status === 'published' ? '可閱讀' : '籌備中'}
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
                      <span className="text-mirari-ink font-medium">查看</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Curated Series (系列專題 - 嚴謹展示規則：未達正式條件不以已完成特輯展示) ──── */}
      {primarySeries && (
        <section id="curated-series" className="py-12 border-t border-mirari-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-mirari-line bg-white p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2 text-xs font-sans">
                  <span className={`uppercase tracking-wider font-semibold ${isSeriesReady ? 'text-mirari-amber' : 'text-mirari-dim'}`}>
                    {isSeriesReady ? '系列特輯' : '系列專題策劃預告'}
                  </span>
                  <span className="text-mirari-dim">·</span>
                  <span className="text-mirari-dim">
                    {isSeriesReady
                      ? `已收錄 ${seriesPublishedCount} 篇正式篇章`
                      : `編輯部規劃中（預計收錄 ${primarySeries.totalPlannedArticles || 4} 篇）`}
                  </span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-mirari-ink">
                  {primarySeries.title}
                </h3>
                <p className="text-sm text-mirari-muted leading-relaxed font-sans">
                  {primarySeries.description}
                </p>
              </div>
              <button
                onClick={() => {
                  if (onSelectSeries && primarySeries) {
                    onSelectSeries(primarySeries);
                  } else {
                    handleArticleClick(seriesArticle);
                  }
                }}
                className="shrink-0 px-5 py-2.5 rounded-xl border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt text-xs font-sans font-medium text-mirari-ink transition"
              >
                {isSeriesReady ? '探索系列文章' : '查看策劃大綱'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── In Preparation Article Modal ───────────────────────────── */}
      {prepArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mirari-ink/30 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-mirari-border shadow-2xl p-6 sm:p-8 space-y-4">
            <button
              onClick={() => setPrepArticleModal(null)}
              className="absolute top-5 right-5 px-2.5 py-1 rounded-lg text-xs font-sans text-mirari-dim hover:text-mirari-ink hover:bg-mirari-surfaceAlt transition"
            >
              關閉
            </button>

            <div className="text-xs font-mono text-mirari-amber font-semibold uppercase tracking-wider">
              選題籌備中
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-bold text-mirari-ink">
              {prepArticleModal.title}
            </h3>

            <p className="font-serif text-sm text-mirari-muted leading-relaxed">
              {prepArticleModal.subtitle}
            </p>

            <div className="p-4 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-muted space-y-2 leading-relaxed">
              <strong className="text-mirari-ink block">選題規劃概要：</strong>
              <p>{prepArticleModal.leadParagraph}</p>
              {prepArticleModal.journalReference && (
                <p className="text-mirari-dim font-mono pt-1">
                  參考文獻來源：{prepArticleModal.journalReference.journal} ({prepArticleModal.journalReference.year})
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setPrepArticleModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-sans text-mirari-muted hover:text-mirari-ink transition"
              >
                關閉
              </button>
              <button
                onClick={() => {
                  setPrepArticleModal(null);
                  onSelectArticle(coverArticle);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-mirari-ink text-white text-xs font-sans font-medium hover:bg-black transition"
              >
                閱讀封面故事《{coverArticle.title}》
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
