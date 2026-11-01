import React, { useState } from 'react';
import { Search, Sparkles, ArrowRight, Compass } from 'lucide-react';
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
    '推薦可以動手操作的物理與天文文章',
    '我想了解黑洞與時空曲率',
    '有沒有很不可思議的心理學現象？',
    '最近有哪些值得注意的科學發現？',
  ];

  const handleExecuteSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setQuery(searchQuery);

    setTimeout(() => {
      const rec = queryMockAIRecommendation(searchQuery);
      setResult(rec);
      setIsSearching(false);
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecuteSearch(query);
  };

  return (
    <div className="relative my-8 rounded-3xl border border-mirari-border/80 bg-gradient-to-b from-mirari-card/70 via-mirari-surface/90 to-mirari-bg/95 p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-md">
      {/* Decorative ambient lights */}
      <div className="absolute top-0 right-1/4 -z-10 h-32 w-64 rounded-full bg-mirari-cyan/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -z-10 h-32 w-64 rounded-full bg-mirari-amber/10 blur-3xl pointer-events-none" />

      {/* Title & Editorial Framing */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
        <div className="inline-flex items-center space-x-2 rounded-full border border-mirari-amber/30 bg-mirari-amber/10 px-3.5 py-1 text-xs font-mono text-mirari-amber">
          <Compass className="w-3.5 h-3.5" />
          <span>NATURAL LANGUAGE EXPLORER · 自然語言策展導覽</span>
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
          今天，你想探索什麼？
        </h2>
        <p className="text-sm text-mirari-muted leading-relaxed">
          以自然語言寫下你的好奇。MIRARI 導覽精靈將依據科學概念與物理維度，為你引路至最適合親自探索的深度篇章。
        </p>
      </div>

      {/* Natural Language Input Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="relative flex items-center rounded-2xl border border-mirari-borderLight/80 bg-mirari-bg/90 p-2 shadow-inner focus-within:border-mirari-cyan focus-within:ring-2 focus-within:ring-mirari-cyan/20 transition duration-300">
          <Search className="w-5 h-5 text-mirari-muted ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：推薦可以動手操作的天文文章、我想了解黑洞..."
            className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-white placeholder-mirari-dim focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="shrink-0 flex items-center space-x-2 rounded-xl bg-gradient-to-r from-mirari-amber to-amber-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-mirari-bg shadow-lg hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isSearching ? '尋思中...' : '探索'}</span>
            <Sparkles className="w-4 h-4 text-mirari-bg" />
          </button>
        </div>
      </form>

      {/* Suggested Quick Exploration Chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto text-xs">
        <span className="text-mirari-dim font-mono text-[11px] mr-1">試試詢問：</span>
        {sampleQueries.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleExecuteSearch(item)}
            className="rounded-full border border-mirari-border bg-mirari-surface/70 px-3 py-1 text-mirari-muted hover:border-mirari-cyan/50 hover:text-white transition"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Results Drawer / Recommendation Cards */}
      {result && (
        <div className="mt-8 pt-8 border-t border-mirari-border/70 max-w-4xl mx-auto space-y-6 animate-fade-in">
          {/* Curator Reply Card */}
          <div className="rounded-2xl border border-mirari-cyan/30 bg-mirari-cyan/5 p-4 sm:p-5 flex items-start space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-mirari-cyan/20 border border-mirari-cyan/40 flex items-center justify-center shrink-0 text-mirari-cyan text-sm">
              ✨
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-sm font-bold text-white">MIRARI 導覽精靈回應</span>
                <span className="font-mono text-[10px] text-mirari-cyan bg-mirari-cyan/15 px-2 py-0.5 rounded">
                  CONTEXTUAL RECOMMENDATION
                </span>
              </div>
              <p className="text-xs sm:text-sm text-mirari-text leading-relaxed">
                {result.curatorReply}
              </p>
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.suggestedTags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono text-mirari-muted bg-mirari-surface border border-mirari-border px-2 py-0.5 rounded"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Recommended Article Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.recommendedArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="group relative rounded-2xl border border-mirari-border bg-mirari-surface/80 p-5 hover:border-mirari-amber/60 hover:bg-mirari-card/90 transition duration-300 cursor-pointer flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] text-mirari-amber font-semibold uppercase">
                      {article.category === 'cover'
                        ? '★ 本期封面'
                        : article.category === 'research'
                        ? '最新研究解讀'
                        : article.category === 'classic'
                        ? '經典科普'
                        : '系列專題'}
                    </span>
                    {article.isInteractive && (
                      <span className="rounded-full bg-mirari-cyan/20 px-2 py-0.5 text-[10px] font-mono text-mirari-cyan border border-mirari-cyan/30">
                        可親自操作
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-bold text-white group-hover:text-mirari-amber transition line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-xs text-mirari-muted line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-mirari-border/50 flex items-center justify-between text-xs text-mirari-dim group-hover:text-mirari-text transition">
                  <span className="font-mono">{article.publishedDate}</span>
                  <div className="flex items-center space-x-1 text-mirari-cyan font-mono font-medium">
                    <span>進入閱讀</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
