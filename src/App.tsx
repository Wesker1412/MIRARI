import { useState, useCallback } from 'react';
import { HomePage } from './components/home/HomePage';
import { ArticleView } from './components/article/ArticleView';
import { GlobalMascotOverlay } from './components/mascot/GlobalMascotOverlay';
import { ARTICLES } from './data/articles';
import type { Article } from './types';
import type { EvidenceSearchResult } from './services/articleEvidenceService';

export function App() {
  const [currentView, setCurrentView] = useState<'home' | 'article'>('home');
  const [currentArticle, setCurrentArticle] = useState<Article>(ARTICLES[0]); // default to cover story
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);

  const handleSelectArticle = (article: Article) => {
    setCurrentArticle(article);
    setCurrentView('article');
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenArticleBySlug = (slug: string) => {
    const found = ARTICLES.find((a) => a.slug === slug);
    if (found) {
      handleSelectArticle(found);
    }
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreTopic = (_topicId: string) => {
    const elem = document.getElementById('explore-topics');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
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

    // Verify element actually exists in DOM before highlighting
    const elem = document.getElementById(primaryId);
    if (elem) {
      // Verify text presence with whitespace normalization
      const normContent = (elem.textContent || '').replace(/\s+/g, ' ').trim();
      const normQuote = result.evidence.exactQuote.replace(/\s+/g, ' ').trim();
      const textMatches = normContent.includes(normQuote.slice(0, 10));
      if (textMatches) {
        setActiveSentenceId(primaryId);
        setActiveSecondaryId(secondaryId);
        setEvidenceNote(result.evidence.contextNote || '支持回答之原文依據');

        // Center the exact sentence smoothly in viewport
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        console.warn('Text evidence validation failed: content mismatch');
      }
    }
  }, []);

  const handleClearHighlight = useCallback(() => {
    setActiveSentenceId(null);
    setActiveSecondaryId(null);
    setEvidenceNote(null);
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

      {/* ─── Page Views ──────────────────────────────────────────────── */}
      {currentView === 'home' ? (
        <HomePage
          onSelectArticle={handleSelectArticle}
          onExploreTopic={handleExploreTopic}
        />
      ) : (
        <ArticleView
          article={currentArticle}
          onBackToHome={handleBackToHome}
          onOpenArticleBySlug={handleOpenArticleBySlug}
          activeSentenceId={activeSentenceId}
          activeSecondaryId={activeSecondaryId}
          evidenceNote={evidenceNote}
          onClearHighlight={handleClearHighlight}
        />
      )}
    </div>
  );
}

export default App;
