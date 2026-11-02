import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { GlobalMascotOverlay } from '../mascot/GlobalMascotOverlay';
import { SITE_CONFIG } from '../../config/site';
import { ARTICLES, getArticleBySlug } from '../../data/articles';
import type { Article } from '../../types';
import type { EvidenceSearchResult } from '../../services/articleEvidenceService';

export const SiteLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Highlight state for article reading & mascot evidence locating
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);

  // Sharing copy feedback state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Clear highlight on route change if leaving article view
  useEffect(() => {
    if (!location.pathname.startsWith('/articles/')) {
      setActiveSentenceId(null);
      setActiveSecondaryId(null);
      setEvidenceNote(null);
    }
  }, [location.pathname]);

  // Determine view mode for Mascot (home vs article/other)
  const isHome = location.pathname === '/';
  const currentView: 'home' | 'article' = isHome ? 'home' : 'article';

  // Find active article if on /articles/:slug
  const articleMatch = matchPath('/articles/:slug', location.pathname);
  const currentArticle = articleMatch?.params.slug
    ? getArticleBySlug(articleMatch.params.slug) || ARTICLES[0]
    : ARTICLES[0];

  const handleSelectArticle = (article: Article) => {
    navigate(`/articles/${article.slug}`);
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
  };

  const handleClearHighlight = useCallback(() => {
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
  }, []);

  const handleCopyLink = useCallback(() => {
    const slug = articleMatch?.params.slug || currentArticle.slug;
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
      setEvidenceNote(null);
      return;
    }

    const primaryId = result.evidence.sentenceId;
    const secondaryId = result.secondaryEvidence?.sentenceId || null;

    const elem = document.getElementById(primaryId);
    if (elem) {
      const normContent = (elem.textContent || '').replace(/\s+/g, ' ').trim();
      const normQuote = result.evidence.exactQuote.replace(/\s+/g, ' ').trim();
      const textMatches = normContent.includes(normQuote.slice(0, 10));
      if (textMatches) {
        setActiveSentenceId(primaryId);
        setActiveSecondaryId(secondaryId);
        setEvidenceNote(result.evidence.contextNote || '支持回答之原文依據');
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        hasActiveHighlight={!!activeSentenceId}
      />

      {/* ─── Unified Site Header ────────────────────────────────────── */}
      <SiteHeader
        articleTitle={location.pathname.startsWith('/articles/') ? currentArticle.title : undefined}
        articleSlug={location.pathname.startsWith('/articles/') ? currentArticle.slug : undefined}
        hasActiveHighlight={!!activeSentenceId}
        evidenceNote={evidenceNote}
        onClearHighlight={handleClearHighlight}
        isCopied={isCopied}
        onCopyLink={location.pathname.startsWith('/articles/') ? handleCopyLink : undefined}
      />

      {/* ─── Page Content Outlet ─────────────────────────────────────── */}
      <div className="flex-1">
        <Outlet
          context={{
            activeSentenceId,
            activeSecondaryId,
            evidenceNote,
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
