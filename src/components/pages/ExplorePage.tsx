import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTICLES } from '../../data/articles';
import { TOPICS, getTopicArticleCount } from '../../data/topics';
import { queryDataDrivenRecommendation, queryAISearch } from '../../services/unifiedSearchService';
import type { Article, AIRecommendation } from '../../types';
import { useSEO } from '../seo/useSEO';

const SAMPLE_QUERIES = [
  '系外行星凌日',
  '雙擺渾沌',
  '神經元動作電位',
  '麥克斯韋妖與資訊熱力學',
];

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();

  useSEO({
    title: '探索',
    description: '探索站內涵蓋天體物理、渾沌理論、神經電生理與資訊熱力學的科學主題，或直接檢索相關的深度論述與互動數值實驗。',
  });

  // Search state
  const [query, setQuery] = useState<string>('');
  const [activeSearchResult, setActiveSearchResult] = useState<AIRecommendation | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Topic filter state
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Filter topics: ONLY show topics that have at least 1 published article
  const publishedTopics = useMemo(() => {
    return TOPICS.filter((t) => getTopicArticleCount(t.id, ARTICLES).published > 0);
  }, []);

  // Filter articles based on selected topic
  const topicArticles = useMemo(() => {
    if (!selectedTopicId) return [];
    return ARTICLES.filter(
      (a) => a.status === 'published' && a.topicIds.includes(selectedTopicId)
    ).sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));
  }, [selectedTopicId]);

  const selectedTopic = useMemo(() => {
    return TOPICS.find((t) => t.id === selectedTopicId) || null;
  }, [selectedTopicId]);

  // Execute search (Phase 4 AI RAG Search with server-side Gate)
  const handleExecuteSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setActiveSearchResult(null);
      return;
    }
    setIsSearching(true);
    setQuery(trimmed);
    try {
      const result = await queryAISearch(trimmed);
      setActiveSearchResult(result);
    } catch {
      setActiveSearchResult(queryDataDrivenRecommendation(trimmed));
    } finally {
      setIsSearching(false);
    }
  };

  const getArticleTopicNames = (article: Article) => {
    return article.topicIds
      .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <main className="bg-mirari-paper text-mirari-ink min-h-[75vh] pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
        {/* ─── 1. Header with MIRARI Companion Anchor & Search ───────── */}
        <header className="max-w-3xl mx-auto text-center space-y-6">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
              知識探索與檢索
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-mirari-ink">
              探索 MIRARI
            </h1>
            <p className="text-sm sm:text-base text-mirari-muted font-sans leading-relaxed max-w-xl mx-auto">
              輸入您好奇的科學現象、概念或疑問，MIRARI 將為您檢索站內已完成查證的深度篇章與數值模擬。
            </p>
          </div>

          {/* Anchor placeholder for the persistent global MIRARI mascot */}
          <div className="flex justify-center pt-1 pb-2">
            <div
              id="explore-page-mascot-anchor"
              className="w-28 h-32 pointer-events-none select-none"
            />
          </div>

          {/* Search Input Box */}
          <div className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteSearch(query);
              }}
              className="relative flex items-center rounded-2xl border-2 border-mirari-line bg-white shadow-sm focus-within:border-mirari-ink focus-within:ring-2 focus-within:ring-mirari-ink/10 transition p-1.5"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="輸入科學現象、關鍵字或問題（如：雙擺、系外行星、動作電位...）"
                className="w-full bg-transparent px-4 py-2.5 text-sm text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setActiveSearchResult(null);
                  }}
                  className="px-2 text-xs text-mirari-dim hover:text-mirari-ink mr-1 font-sans"
                >
                  清除
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || isSearching}
                className="shrink-0 rounded-xl bg-mirari-ink px-5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-black transition disabled:opacity-40 font-sans"
              >
                {isSearching ? '搜尋中' : '探索文章'}
              </button>
            </form>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-sans">
              <span className="text-mirari-dim">熱門探索：</span>
              {SAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleExecuteSearch(q)}
                  className="px-2.5 py-1 rounded-lg border border-mirari-line bg-white hover:bg-mirari-surfaceAlt text-mirari-muted hover:text-mirari-ink transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ─── 2. Search Results Panel (Explicit distinction of 3 match tiers) ─── */}
        {activeSearchResult && (
          <section className="max-w-3xl mx-auto rounded-2xl border border-mirari-line bg-white p-6 sm:p-8 space-y-6 animate-fade-in shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-mirari-line">
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-sm text-mirari-ink">
                  「{activeSearchResult.query}」檢索結果
                </span>
                {activeSearchResult.matchLevel === 'direct' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    已有文章可直接閱讀
                  </span>
                )}
                {activeSearchResult.matchLevel === 'partial' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    找到部分相關內容
                  </span>
                )}
                {activeSearchResult.matchLevel === 'none' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    站內尚無相關文章
                  </span>
                )}
              </div>

              <button
                onClick={() => setActiveSearchResult(null)}
                className="text-xs text-mirari-dim hover:text-mirari-ink font-sans underline"
              >
                收起結果
              </button>
            </div>

            <p className="text-sm font-sans text-mirari-muted leading-relaxed">
              {activeSearchResult.curatorReply}
            </p>

            {activeSearchResult.recommendedArticles.length > 0 && (
              <div className="space-y-4 pt-2">
                <span className="text-xs font-semibold text-mirari-ink font-sans block">
                  推薦閱讀篇章：
                </span>
                <div className="grid grid-cols-1 gap-4">
                  {activeSearchResult.recommendedArticles.map((article) => (
                    <article
                      key={article.id}
                      onClick={() => navigate(`/articles/${article.slug}`)}
                      className="group p-5 rounded-xl border border-mirari-line hover:border-mirari-border hover:shadow-sm bg-mirari-paper/50 transition cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-mirari-amber font-sans font-medium">
                          {article.formatBadgeText} · {getArticleTopicNames(article)}
                        </span>
                        <span className="text-[11px] font-mono text-mirari-dim">
                          {article.publishedDate}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition">
                        {article.title}
                      </h3>
                      <p className="text-xs text-mirari-muted line-clamp-2 leading-relaxed font-sans">
                        {article.summary}
                      </p>
                      <div className="pt-2 flex justify-end text-xs text-mirari-ink font-medium group-hover:text-mirari-amber">
                        進入互動實驗閱讀 →
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── 3. Topic Exploration Grid (Only topics with published articles) ─── */}
        <section className="space-y-8">
          <div className="flex flex-wrap items-baseline justify-between pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                知識網絡
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                科學主題探索
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              目前收錄 {publishedTopics.length} 個已發布篇章之核心學科方向
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {publishedTopics.map((topic, idx) => {
              const count = getTopicArticleCount(topic.id, ARTICLES).published;
              const isSelected = selectedTopicId === topic.id;

              return (
                <div
                  key={topic.id}
                  onClick={() => {
                    setSelectedTopicId(isSelected ? null : topic.id);
                  }}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? 'border-mirari-amber bg-white shadow-md ring-2 ring-mirari-amber/20'
                      : 'border-mirari-line bg-white hover:border-mirari-border hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-mirari-dim">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[10px] text-mirari-dim uppercase tracking-wider">
                        {topic.nameEn}
                      </span>
                    </div>

                    <h3 className="font-serif text-xl font-bold text-mirari-ink group-hover:text-mirari-amber transition">
                      {topic.nameZh}
                    </h3>

                    <p className="text-xs text-mirari-muted leading-relaxed font-sans line-clamp-2">
                      {topic.tagline}
                    </p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs font-sans text-mirari-dim">
                    <span>{count} 篇已收錄</span>
                    <span
                      className={`font-medium transition ${
                        isSelected ? 'text-mirari-amber' : 'text-mirari-ink group-hover:text-mirari-amber'
                      }`}
                    >
                      {isSelected ? '已選取' : '檢視收錄篇章 →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── 4. Filtered Articles by Selected Topic ───────────────── */}
          {selectedTopicId && selectedTopic && (
            <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-white border border-mirari-line space-y-6 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-mirari-line/60">
                <div className="space-y-1">
                  <span className="text-xs font-sans text-mirari-amber font-semibold block">
                    主題收錄篇章
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-mirari-ink">
                    【{selectedTopic.nameZh}】（共 {topicArticles.length} 篇）
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTopicId(null)}
                  className="text-xs text-mirari-dim hover:text-mirari-ink font-sans underline"
                >
                  關閉主題列表
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {topicArticles.map((article) => (
                  <article
                    key={article.id}
                    onClick={() => navigate(`/articles/${article.slug}`)}
                    className="p-5 rounded-xl border border-mirari-line hover:border-mirari-border hover:shadow-sm bg-mirari-paper transition cursor-pointer flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-mirari-amber font-medium font-sans">
                          {article.formatBadgeText}
                        </span>
                        <span className="text-[11px] font-mono text-mirari-dim">
                          {article.publishedDate}
                        </span>
                      </div>
                      <h4 className="font-serif text-base font-bold text-mirari-ink line-clamp-2">
                        {article.title}
                      </h4>
                      <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed font-sans">
                        {article.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim font-sans">
                      <span>{getArticleTopicNames(article)}</span>
                      <span className="text-mirari-ink font-medium hover:text-mirari-amber">
                        開始閱讀 →
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
