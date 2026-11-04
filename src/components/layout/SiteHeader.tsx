import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { EditorialCategory } from '../../types';

interface SiteHeaderProps {
  articleTitle?: string;
  articleSlug?: string;
  editorialCategory?: EditorialCategory;
  isCopied?: boolean;
  onCopyLink?: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  articleTitle,
  editorialCategory,
  isCopied,
  onCopyLink,
}) => {
  const location = useLocation();
  const isArticleView = location.pathname.startsWith('/articles/');

  return (
    <header className="border-b border-mirari-line bg-mirari-paper/95 sticky top-0 z-40 backdrop-blur-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3.5 gap-2 sm:gap-4">
          {/* Left: Brand & Tagline / Breadcrumbs (Aligned on the exact same vertical center line) */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 shrink">
            <Link
              to="/"
              className="font-serif text-xl sm:text-3xl font-bold tracking-tight text-mirari-ink hover:text-mirari-amber transition shrink-0 leading-none"
              title="返回首頁"
            >
              MIRARI
            </Link>

            {isArticleView && articleTitle ? (
              <nav
                aria-label="文章導覽麵包屑"
                className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs leading-5 font-sans text-mirari-dim min-w-0"
              >
                <span className="text-mirari-line select-none shrink-0">/</span>
                <Link
                  to={editorialCategory === 'journal_interpretation' ? '/journal' : '/principles'}
                  className="hover:text-mirari-ink transition shrink-0"
                >
                  {editorialCategory === 'journal_interpretation' ? '研究動態' : '科普探索'}
                </Link>
                <span className="hidden sm:inline text-mirari-line select-none shrink-0">/</span>
                <span className="hidden sm:block min-w-0 font-serif font-medium text-mirari-ink truncate sm:max-w-[160px] md:max-w-[260px]">
                  {articleTitle}
                </span>
              </nav>
            ) : (
              <span className="text-xs text-mirari-dim hidden sm:flex items-center font-sans border-l border-mirari-line pl-3 shrink-0 h-5 leading-none">
                探索科學的互動數位雜誌
              </span>
            )}
          </div>

          {/* Right: Three Navigation Entrances + Article Specific Actions */}
          <div className="flex items-center space-x-2 sm:space-x-6 text-[11px] sm:text-xs font-sans shrink-0">
            {/* Article share button */}
            {isArticleView && (
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    className={`px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs transition ${
                      isCopied
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                        : 'text-mirari-dim hover:text-mirari-ink border-mirari-line hover:border-mirari-border'
                    }`}
                    title="複製完整文章分享網址"
                  >
                    {isCopied ? '已複製' : '分享'}
                  </button>
                )}
              </div>
            )}

            {/* Three Page Navigation Entrances (Active state + Mobile accessible) */}
            <nav className="flex items-center space-x-1.5 sm:space-x-5 font-medium text-[11px] sm:text-xs">
              <NavLink
                to="/journal"
                className={({ isActive }) =>
                  `transition py-1 whitespace-nowrap ${
                    isActive
                      ? 'text-mirari-ink font-semibold border-b-2 border-mirari-ink'
                      : 'text-mirari-muted hover:text-mirari-ink'
                  }`
                }
              >
                研究動態
              </NavLink>

              <NavLink
                to="/principles"
                className={({ isActive }) =>
                  `transition py-1 whitespace-nowrap ${
                    isActive
                      ? 'text-mirari-ink font-semibold border-b-2 border-mirari-ink'
                      : 'text-mirari-muted hover:text-mirari-ink'
                  }`
                }
              >
                科普探索
              </NavLink>

              <NavLink
                to="/explore"
                className={({ isActive }) =>
                  `transition py-1 whitespace-nowrap ${
                    isActive
                      ? 'text-mirari-ink font-semibold border-b-2 border-mirari-ink'
                      : 'text-mirari-muted hover:text-mirari-ink'
                  }`
                }
              >
                探索 MIRARI
              </NavLink>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
