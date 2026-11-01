import React, { useState } from 'react';
import { queryMockAIRecommendation } from '../../services/aiRecommendationService';
import type { AIRecommendation, Article } from '../../types';

interface AIExplorerProps {
  onSelectArticle: (article: Article) => void;
}

export const AIExplorer: React.FC<AIExplorerProps> = ({ onSelectArticle }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AIRecommendation | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const sampleQueries = [
    '可以親手操作的天文物理文章',
    '黑洞與早期宇宙的秘密',
    '大腦如何感知時間？',
    '近期關注的科學研究',
  ];

  const handleExecuteSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setQuery(searchQuery);

    setTimeout(() => {
      const rec = queryMockAIRecommendation(searchQuery);
      setResult(rec);
      setIsSearching(false);
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecuteSearch(query);
  };

  return (
    <div className="my-12 rounded-3xl border border-mirari-line bg-white p-6 sm:p-10 shadow-sm">
      {/* Title & Editorial Framing */}
      <div className="max-w-2xl mx-auto text-center space-y-2 mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink tracking-tight">
          想探索哪一個科學現象？
        </h2>
        <p className="text-sm text-mirari-muted leading-relaxed font-sans">
          輸入你想了解的主題，搜尋站內深度篇章與研究追蹤。
        </p>
      </div>

      {/* Natural Language Input Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="relative flex items-center rounded-2xl border border-mirari-border bg-mirari-paper p-1.5 focus-within:border-mirari-ink transition duration-200">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：可以親手操作的天文文章、黑洞、大腦時間感..."
            className="w-full bg-transparent px-4 py-2 text-sm text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
          />
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="shrink-0 rounded-xl bg-mirari-ink px-5 py-2 text-xs font-medium text-white hover:bg-black active:scale-95 transition disabled:opacity-40 font-sans"
          >
            {isSearching ? '尋找中...' : '搜尋'}
          </button>
        </div>
      </form>

      {/* Quick Exploration Chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto text-xs">
        <span className="text-mirari-dim font-sans text-[11px] mr-1">熱門好奇：</span>
        {sampleQueries.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleExecuteSearch(item)}
            className="rounded-full border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt px-3 py-1 text-mirari-muted hover:text-mirari-ink transition"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Results Drawer */}
      {result && (
        <div className="mt-8 pt-6 border-t border-mirari-line max-w-3xl mx-auto space-y-5 animate-fade-in">
          {/* Curator Note */}
          <div className="p-4 rounded-xl bg-mirari-paper border border-mirari-line space-y-1.5">
            <p className="text-xs sm:text-sm text-mirari-ink leading-relaxed">
              {result.curatorReply}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {result.suggestedTags.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-sans text-mirari-dim bg-white border border-mirari-line px-2 py-0.5 rounded"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Recommended Article Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.recommendedArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group rounded-2xl border border-mirari-line bg-white hover:border-mirari-border p-5 transition cursor-pointer flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-sans text-mirari-amber font-medium">
                      {article.topicBadge}
                    </span>
                    {article.status === 'in_preparation' ? (
                      <span className="text-[10px] text-mirari-dim bg-mirari-surfaceAlt px-2 py-0.5 rounded border border-mirari-line">
                        企劃中
                      </span>
                    ) : (
                      <span className="text-[10px] text-mirari-cobalt bg-sky-50 px-2 py-0.5 rounded border border-sky-150 font-medium">
                        可互動閱讀
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-base font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-mirari-muted line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim font-sans">
                  <span>{article.status === 'published' ? '正式發布' : '選題籌備'}</span>
                  <span className="text-mirari-ink font-medium hover:text-mirari-amber transition">
                    {article.status === 'published' ? '閱讀全文' : '查看概要'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
