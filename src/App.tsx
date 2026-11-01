import { useState, useCallback, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
  useNavigate,
  matchPath,
} from 'react-router-dom';
import { HomePage } from './components/home/HomePage';
import { ArticlePage } from './components/pages/ArticlePage';
import { SeriesPage } from './components/pages/SeriesPage';
import { NotFoundPage } from './components/pages/NotFoundPage';
import { GlobalMascotOverlay } from './components/mascot/GlobalMascotOverlay';
import { ARTICLES, getArticleBySlug } from './data/articles';
import type { Article } from './types';
import type { EvidenceSearchResult } from './services/articleEvidenceService';

// Automatically scroll smoothly to top on route changes (unless anchored with a hash)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname]);
  return null;
}

// Persistent Layout: Houses the single Three.js Mascot across all routes
function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Text highlight state for article reading & mascot evidence locating
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);

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

  const handleOpenArticleBySlug = (slug: string) => {
    navigate(`/articles/${slug}`);
  };

  const handleClearHighlight = useCallback(() => {
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
  }, []);

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

    // Verify element actually exists in DOM before highlighting
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
      } else {
        console.warn('Text evidence validation failed: content mismatch');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-mirari-paper font-sans selection:bg-mirari-amber/20 selection:text-mirari-ink relative">
      {/* ─── Persistent Single MIRARI Mascot Controller across all pages ── */}
      <GlobalMascotOverlay
        currentView={currentView}
        currentArticle={currentArticle}
        onSelectArticle={handleSelectArticle}
        onEvidenceFound={handleEvidenceFound}
        onClearHighlight={handleClearHighlight}
        hasActiveHighlight={!!activeSentenceId}
      />

      {/* ─── Router Outlet with Shared Context ────────────────────────── */}
      <Outlet
        context={{
          activeSentenceId,
          activeSecondaryId,
          evidenceNote,
          handleClearHighlight,
          handleOpenArticleBySlug,
          handleSelectArticle,
        }}
      />
    </div>
  );
}

function HomeRouteWrapper() {
  const navigate = useNavigate();
  return (
    <HomePage
      onSelectArticle={(article) => navigate(`/articles/${article.slug}`)}
      onSelectSeries={(series) => navigate(`/series/${series.slug}`)}
      onExploreTopic={(_topicId) => {
        const elem = document.getElementById('explore-topics');
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }}
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRouteWrapper />} />
          <Route path="/articles/:slug" element={<ArticlePage />} />
          <Route path="/series/:slug" element={<SeriesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
