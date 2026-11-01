import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface SiteHeaderProps {
  articleTitle?: string;
  articleSlug?: string;
  hasActiveHighlight?: boolean;
  evidenceNote?: string | null;
  onClearHighlight?: () => void;
  isCopied?: boolean;
  onCopyLink?: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  articleTitle,
  hasActiveHighlight,
  evidenceNote,
  onClearHighlight,
  isCopied,
  onCopyLink,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isArticleView = location.pathname.startsWith('/articles/');
  const isHomeView = location.pathname === '/';

  const scrollToAnchor = (anchorId: string) => {
    if (isHomeView) {
      const elem = document.getElementById(anchorId);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${anchorId}`);
    }
  };

  return (
    <header className="border-b border-mirari-line bg-mirari-paper/95 sticky top-0 z-40 backdrop-blur-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3.5">
          {/* Left: Brand & Tagline */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-baseline space-x-3 group">
              <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-mirari-ink group-hover:text-mirari-amber transition">
                MIRARI
              </span>
              <span className="text-xs text-mirari-dim hidden sm:inline-block font-sans border-l border-mirari-line pl-3">
                探索科學的互動數位雜誌
              </span>
            </Link>

            {/* Context Breadcrumb on Article View */}
            {isArticleView && articleTitle && (
              <div className="hidden lg:flex items-center space-x-2 text-xs font-sans text-mirari-dim border-l border-mirari-line pl-4">
                <span>篇章</span>
                <span>/</span>
                <span className="font-serif font-medium text-mirari-ink truncate max-w-[260px]">
                  {articleTitle}
                </span>
              </div>
            )}
          </div>

          {/* Center/Right: Unified Navigation & Actions */}
          <div className="flex items-center space-x-3 sm:space-x-6 text-xs font-sans">
            {/* Standard Nav Anchors */}
            <nav className="hidden md:flex items-center space-x-5 text-mirari-muted font-medium">
              <button
                onClick={() => scrollToAnchor('cover-story')}
                className="hover:text-mirari-ink transition py-1"
              >
                封面故事
              </button>
              <button
                onClick={() => scrollToAnchor('editorial-picks')}
                className="hover:text-mirari-ink transition py-1"
              >
                編輯精選
              </button>
              <button
                onClick={() => scrollToAnchor('research-monitor')}
                className="hover:text-mirari-ink transition py-1"
              >
                研究追蹤
              </button>
              <button
                onClick={() => scrollToAnchor('classic-foundations')}
                className="hover:text-mirari-ink transition py-1"
              >
                思想實驗
              </button>
              <button
                onClick={() => scrollToAnchor('explore-topics')}
                className="hover:text-mirari-ink transition py-1"
              >
                科學主題
              </button>
            </nav>

            {/* Article Specific Actions */}
            {isArticleView ? (
              <div className="flex items-center space-x-2.5">
                {hasActiveHighlight && onClearHighlight && (
                  <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-sans animate-fade-in">
                    <span className="truncate max-w-[120px] sm:max-w-none">
                      已定位：{evidenceNote || '原文依據'}
                    </span>
                    <button
                      onClick={onClearHighlight}
                      className="hover:underline font-medium text-amber-950 ml-1"
                      title="清除標記"
                    >
                      清除
                    </button>
                  </div>
                )}

                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      isCopied
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                        : 'text-mirari-dim hover:text-mirari-ink border-mirari-line hover:border-mirari-border'
                    }`}
                    title="複製完整文章分享網址"
                  >
                    {isCopied ? '已複製文章網址' : '複製連結'}
                  </button>
                )}

                <Link
                  to="/"
                  className="px-3 py-1.5 rounded-lg border border-mirari-line hover:border-mirari-border text-mirari-muted hover:text-mirari-ink transition"
                >
                  回首頁
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-mirari-dim px-2.5 py-1 rounded-full bg-mirari-surfaceAlt border border-mirari-line hidden sm:inline-block">
                  自主科學媒體
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
