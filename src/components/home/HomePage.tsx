import React, { useState, useMemo } from 'react';
import type { Article } from '../../types';
import { TOPICS, getTopicArticleCount } from '../../data/topics';
import { ARTICLES } from '../../data/articles';
import { useSEO } from '../seo/useSEO';
import { CoverRankingService } from '../../services/CoverRankingService';
import { CoverStoryCarousel } from './CoverStoryCarousel';

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

  // ─── 板塊一：封面故事候選與排序 (CoverRankingService) ──────────────
  const rankedStories = useMemo(() => {
    return CoverRankingService.rankCoverStories(ARTICLES);
  }, []);

  // ─── 板塊二：期刊解讀 (Journal Research Briefs) ─────────────────
  // 呈現具有同儕審查學術文獻基礎的正式發布科學文章，依發布時間由新到舊排序
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

  // ─── 板塊三：科學原理與思想實驗 (Scientific Principles) ─────────
  // 涵蓋數學、物理、生物物理、資訊熱力學及思想實驗等基礎科學突破
  const principleArticles = useMemo(() => {
    return ARTICLES
      .filter((a) => a.status === 'published' && (a.isClassicFoundation || a.format === 'interactive_simulation'))
      .sort((a, b) => {
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return a.id.localeCompare(b.id);
      });
  }, []);

  // ─── 板塊四：活躍科學主題（僅列出目前有已發布文章之主題） ─────────
  const activeTopicsWithPublished = useMemo(() => {
    return TOPICS
      .filter((t) => t.isActive)
      .map((topic) => ({
        topic,
        count: getTopicArticleCount(topic.id, ARTICLES),
      }))
      .filter(({ count }) => count.published > 0);
  }, []);

  // Filtered articles when clicking a topic filter
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

  // Guided exploration questions tailored to published articles
  const guidedQuestions = [
    {
      topic: '非線性動力學',
      prompt: '想看看雙擺如何展現渾沌？',
      subtext: '確定性系統中的不可預測性與李雅普諾夫指數',
    },
    {
      topic: '神經生物物理',
      prompt: '好奇動作電位怎麼跨越細胞膜？',
      subtext: '霍奇金與赫胥黎的四條非線性微分方程與動態閾值',
    },
    {
      topic: '資訊熱力學',
      prompt: '聊聊麥克斯韋妖如何把資訊變成能量？',
      subtext: '微觀幽靈悖論與蘭道爾原理的資訊抹除代價',
    },
    {
      topic: '天文物理學',
      prompt: '系外行星如何利用凌日法量測半徑？',
      subtext: '微弱星光變暗幾何與克卜勒太空望遠鏡觀測技術',
    },
  ];

  const handleTriggerQuery = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('mirari:explore-query', { detail: { query: prompt } }));
  };

  const handleSummonMascot = () => {
    window.dispatchEvent(new CustomEvent('mirari:summon-mascot'));
  };

  return (
    <div className="bg-mirari-paper text-mirari-ink">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          板塊一：封面故事 (Cover Story Carousel)
          水平輪播，每一篇已發布篇章皆為平等的封面候選，具備動態視覺呈現
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <CoverStoryCarousel
        rankedStories={rankedStories}
        onSelectArticle={onSelectArticle}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          板塊二：期刊解讀 (Journal Research Briefs)
          呈現經過 MIRARI 深入解析、具有同儕審查學術文獻基礎的科學文章
          依 MIRARI 發布時間由新到舊排序
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="journal-research" className="py-14 sm:py-18 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-cobalt font-sans font-semibold block">
                PEER-REVIEWED LITERATURE
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                期刊解讀
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              以同儕審查學術文獻為基礎的深度科學剖析（共 {researchArticles.length} 篇正式篇章）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8">
            {researchArticles.map((article) => {
              const journalInfo = article.journalReference;
              return (
                <article
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className="group rounded-2xl border border-mirari-line bg-white p-6 sm:p-7 flex flex-col justify-between hover:border-mirari-border hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  <div className="space-y-4">
                    {/* Header: Journal Reference Badge & Published Date */}
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                          {journalInfo?.journal || '學術同儕審查期刊'} · {journalInfo?.year || '文獻'}
                        </span>
                        {journalInfo?.doi && (
                          <span className="text-[11px] font-mono text-mirari-dim hidden sm:inline">
                            DOI: {journalInfo.doi}
                          </span>
                        )}
                      </div>
                      <time className="text-[11px] font-mono text-mirari-dim">
                        MIRARI 發布：{article.publishedDate}
                      </time>
                    </div>

                    {/* Topics */}
                    <div className="text-xs font-sans text-mirari-amber font-medium">
                      {getArticleTopicNames(article)}
                    </div>

                    {/* Title */}
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-mirari-ink group-hover:text-mirari-amber transition leading-snug">
                      {article.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="font-serif text-xs sm:text-sm text-mirari-dim italic line-clamp-2">
                      {article.subtitle}
                    </p>

                    {/* Summary */}
                    <p className="text-xs sm:text-sm text-mirari-muted line-clamp-3 leading-relaxed font-sans">
                      {article.summary}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-mirari-line/60 flex items-center justify-between text-xs font-sans">
                    <span className="text-mirari-dim">
                      {article.formatBadgeText}
                    </span>
                    <span className="inline-flex items-center font-semibold text-mirari-ink group-hover:text-mirari-amber transition">
                      進入論文深度解讀 →
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          板塊三：科學原理與思想實驗 (Scientific Principles & Thought Experiments)
          收錄數學、物理、生物物理、資訊熱力學及思想實驗等基礎科學突破
          依 MIRARI 發布時間由新到舊排序
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="principles-experiments" className="py-14 sm:py-18 border-t border-mirari-line bg-mirari-surfaceAlt/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                FIRST PRINCIPLES & PARADOXES
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                科學原理與思想實驗
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              拆解宇宙第一性原理、思維悖論與即時數值模擬實驗（共 {principleArticles.length} 篇正式篇章）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {principleArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-semibold text-mirari-amber px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                      {article.formatBadgeText}
                    </span>
                    <time className="text-[11px] font-mono text-mirari-dim">
                      {article.publishedDate}
                    </time>
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  <div className="p-3 rounded-xl bg-mirari-paper border border-mirari-line text-xs font-serif text-mirari-muted italic leading-relaxed line-clamp-2">
                    「{article.subtitle}」
                  </div>

                  <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed font-sans">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs font-sans">
                  <span className="text-mirari-dim">
                    {getArticleTopicNames(article)}
                  </span>
                  <span className="text-mirari-ink font-semibold group-hover:text-mirari-amber transition">
                    啟動數值實驗 →
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          板塊四：與 MIRARI 一起探索 (Explore with MIRARI)
          動態知識網絡、吉祥物核心就位工作台與智慧問答引導
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="explore-mirari" className="py-16 sm:py-20 border-t border-mirari-line relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
              SECTION 04 · INTERACTIVE WORKBENCH
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-mirari-ink">
              與 MIRARI 一起探索
            </h2>
            <p className="text-sm text-mirari-muted leading-relaxed font-sans">
              向全站常駐的 MIRARI 提出任何科學好奇，或點選活躍的科學主題與啟發式問題，展開互動實驗探索。
            </p>
          </div>

          {/* Workbench Stage Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 4 Cols: Dedicated Mascot Anchor Stage & Status Notice */}
            <div className="lg:col-span-4 rounded-3xl bg-mirari-paper border border-mirari-border p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 relative min-h-[280px]">
              {/* Mascot Stage Anchor for Global Mascot Controller */}
              <div
                id="explore-mirari-anchor"
                className="w-32 h-36 flex items-center justify-center relative"
              >
                {/* Visual pulse glow indicating the companion workbench landing zone */}
                <div className="absolute inset-0 rounded-full bg-mirari-amber/10 blur-xl animate-pulse" />
              </div>

              <div className="space-y-1">
                <h4 className="font-serif text-base font-bold text-mirari-ink">
                  MIRARI 星種精靈
                </h4>
                <p className="text-xs text-mirari-dim font-sans">
                  全站持續運行的科學伴讀夥伴
                </p>
              </div>

              {/* Notice & Summon Action if user has dragged mascot elsewhere */}
              <div className="pt-2 w-full">
                <button
                  type="button"
                  onClick={handleSummonMascot}
                  className="w-full text-xs font-sans font-medium text-mirari-muted hover:text-mirari-ink bg-white border border-mirari-line hover:border-mirari-border px-3 py-2 rounded-xl transition shadow-sm"
                >
                  呼喚 MIRARI 展開即時對話
                </button>
              </div>
            </div>

            {/* Right 8 Cols: Guided Inquiry Chips & Active Science Topics */}
            <div className="lg:col-span-8 space-y-8">
              {/* Guided Curiosity Questions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-semibold text-mirari-ink tracking-wider uppercase">
                    啟發式問題引導（點選直接向 MIRARI 發問）
                  </span>
                  <span className="text-[11px] text-mirari-dim font-sans">
                    依真實已發布篇章智能解索
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {guidedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTriggerQuery(q.prompt)}
                      className="group p-3.5 text-left rounded-2xl border border-mirari-line hover:border-mirari-amber/60 bg-mirari-paper/60 hover:bg-white transition-all duration-200 shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-mirari-amber uppercase tracking-wider">
                          {q.topic}
                        </span>
                        <span className="text-xs text-mirari-dim group-hover:text-mirari-amber transition">
                          提問 →
                        </span>
                      </div>
                      <div className="font-serif text-sm font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-1">
                        {q.prompt}
                      </div>
                      <div className="text-[11px] text-mirari-dim font-sans mt-1 line-clamp-1">
                        {q.subtext}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Topics with Published Articles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-semibold text-mirari-ink tracking-wider uppercase">
                    活躍科學主題體系（已收錄正式篇章）
                  </span>
                  {selectedTopicId !== 'all' && (
                    <button
                      onClick={() => setSelectedTopicId('all')}
                      className="text-xs text-mirari-amber hover:underline font-sans"
                    >
                      顯示全部主題
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeTopicsWithPublished.map(({ topic, count }, idx) => {
                    const isSelected = selectedTopicId === topic.id;
                    return (
                      <div
                        key={topic.id}
                        onClick={() => {
                          const next = isSelected ? 'all' : topic.id;
                          setSelectedTopicId(next);
                          if (onExploreTopic) onExploreTopic(topic.id);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'border-mirari-amber bg-white shadow-md ring-1 ring-mirari-amber/20'
                            : 'border-mirari-line bg-mirari-paper hover:bg-white hover:border-mirari-border hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold text-mirari-dim">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] font-mono text-mirari-dim uppercase tracking-wider">
                              {topic.nameEn}
                            </span>
                          </div>

                          <h4 className="font-serif text-base font-bold text-mirari-ink group-hover:text-mirari-amber transition">
                            {topic.nameZh}
                          </h4>

                          <p className="mt-1 text-xs text-mirari-muted line-clamp-2 leading-relaxed font-sans">
                            {topic.tagline}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-mirari-line/60 text-[11px] font-sans text-mirari-dim flex items-center justify-between">
                          <span className="text-mirari-amber font-medium">
                            {count.published} 篇發布
                          </span>
                          <span
                            className={`font-medium transition ${
                              isSelected
                                ? 'text-mirari-amber'
                                : 'text-mirari-ink group-hover:text-mirari-amber'
                            }`}
                          >
                            {isSelected ? '已選取' : '篩選篇章'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Filtered articles display */}
                {selectedTopicId !== 'all' && currentSelectedTopic && (
                  <div className="mt-6 p-5 rounded-2xl bg-mirari-paper border border-mirari-line space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-mirari-line">
                      <h4 className="font-serif text-sm font-bold text-mirari-ink">
                        【{currentSelectedTopic.nameZh}】主題收錄篇章（共 {filteredArticles.length} 篇）
                      </h4>
                      <button
                        onClick={() => setSelectedTopicId('all')}
                        className="text-xs text-mirari-dim hover:text-mirari-ink underline font-sans"
                      >
                        清除主題篩選
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredArticles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => onSelectArticle(art)}
                          className="p-3.5 rounded-xl border border-mirari-line hover:border-mirari-border transition cursor-pointer bg-white flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1 text-[11px]">
                              <span className="text-mirari-amber font-medium">
                                {art.formatBadgeText}
                              </span>
                              <span className="text-mirari-dim font-mono">
                                {art.publishedDate}
                              </span>
                            </div>
                            <h5 className="font-serif text-sm font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-1">
                              {art.title}
                            </h5>
                            <p className="mt-1 text-xs text-mirari-muted line-clamp-2">
                              {art.summary}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-mirari-line/60 flex items-center justify-between text-[11px] text-mirari-dim">
                            <span>{getArticleTopicNames(art)}</span>
                            <span className="text-mirari-ink font-semibold group-hover:text-mirari-amber transition">
                              開始閱讀 →
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
