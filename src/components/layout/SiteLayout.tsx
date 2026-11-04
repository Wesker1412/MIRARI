import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { GlobalMascotOverlay } from '../mascot/GlobalMascotOverlay';
import { SITE_CONFIG } from '../../config/site';
import { getArticleBySlug } from '../../data/articles';
import type { Article } from '../../types';
import type { EvidenceSearchResult } from '../../services/articleEvidenceService';

export const SiteLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Highlight state for article reading & mascot evidence locating
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(null);

  // Sharing copy feedback state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Clear highlight on route change if leaving or switching article view
  useEffect(() => {
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
  }, [location.pathname]);

  // Determine view mode for Mascot (home vs article vs explore)
  const isHome = location.pathname === '/';
  const isExplore = location.pathname === '/explore';
  const isArticle = location.pathname.startsWith('/articles/');
  const currentView: 'home' | 'article' | 'explore' = isHome
    ? 'home'
    : isExplore
    ? 'explore'
    : isArticle
    ? 'article'
    : 'home';

  // Find active article if on /articles/:slug
  const articleMatch = matchPath('/articles/:slug', location.pathname);
  const currentArticle = articleMatch?.params.slug
    ? getArticleBySlug(articleMatch.params.slug)
    : undefined;

  const handleSelectArticle = (article: Article) => {
    navigate(`/articles/${article.slug}`);
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
  };

  const handleClearHighlight = useCallback(() => {
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
  }, []);

  const handleCopyLink = useCallback(() => {
    const slug = articleMatch?.params.slug || currentArticle?.slug || '';
    if (!slug) return;
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/articles/${slug}`
        : `${SITE_CONFIG.canonicalOrigin}/articles/${slug}`;

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(fullUrl)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopy(fullUrl);
        });
    } else {
      fallbackCopy(fullUrl);
    }
  }, [articleMatch, currentArticle]);

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Copy fallback failed:', err);
    }
    document.body.removeChild(textArea);
  };

  // Frontend Exact Text Verification & Scrolling
  const handleEvidenceFound = useCallback((result: EvidenceSearchResult) => {
    if (!result.evidence) {
      setActiveSentenceId(null);
      setActiveSecondaryId(null);
      return;
    }

    const primaryId = result.evidence.sentenceId;
    const secondaryId = result.secondaryEvidence?.sentenceId || null;

    const elem = document.getElementById(primaryId);
    if (elem) {
      const normContent = (elem.textContent || '').replace(/[*$`#_\\]/g, '').replace(/\s+/g, ' ').trim();
      const normQuote = result.evidence.exactQuote.replace(/[*$`#_\\]/g, '').replace(/\s+/g, ' ').trim();
      const textMatches =
        elem.id === primaryId ||
        normContent.includes(normQuote.slice(0, 8)) ||
        normQuote.includes(normContent.slice(0, 8));
      if (textMatches) {
        setActiveSentenceId(primaryId);
        setActiveSecondaryId(secondaryId);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        elem.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-mirari-paper font-sans selection:bg-mirari-amber/20 selection:text-mirari-ink relative flex flex-col justify-between">
      {/* ─── Persistent Single MIRARI Mascot Controller across all pages ── */}
      <GlobalMascotOverlay
        currentView={currentView}
        currentArticle={currentArticle}
        onSelectArticle={handleSelectArticle}
        onEvidenceFound={handleEvidenceFound}
        onClearHighlight={handleClearHighlight}
        activeSentenceId={activeSentenceId}
      />

      {/* ─── Unified Site Header ────────────────────────────────────── */}
      <SiteHeader
        articleTitle={isArticle && currentArticle ? currentArticle.title : undefined}
        articleSlug={isArticle && currentArticle ? currentArticle.slug : undefined}
        editorialCategory={isArticle && currentArticle ? currentArticle.editorialCategory : undefined}
        isCopied={isCopied}
        onCopyLink={isArticle && currentArticle ? handleCopyLink : undefined}
      />

      {/* ─── Page Content Outlet ─────────────────────────────────────── */}
      <div className="flex-1">
        <Outlet
          context={{
            activeSentenceId,
            activeSecondaryId,
            handleClearHighlight,
            isCopied,
            handleCopyLink,
          }}
        />
      </div>

      {/* ─── Unified Site Footer ────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
};
