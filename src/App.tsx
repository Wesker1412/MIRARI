import { useState } from 'react';
import { HomePage } from './components/home/HomePage';
import { ArticleView } from './components/article/ArticleView';
import { ARTICLES } from './data/articles';
import type { Article, DomainId } from './types';

export function App() {
  const [currentView, setCurrentView] = useState<'home' | 'article'>('home');
  const [currentArticle, setCurrentArticle] = useState<Article>(ARTICLES[0]); // default to cover story

  const handleSelectArticle = (article: Article) => {
    setCurrentArticle(article);
    setCurrentView('article');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreDomain = (_domainId: DomainId) => {
    // Smooth scroll down to domain section
    const elem = document.getElementById('science-domains');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-mirari-paper font-sans selection:bg-mirari-amber/20 selection:text-mirari-ink">
      {currentView === 'home' ? (
        <HomePage
          onSelectArticle={handleSelectArticle}
          onExploreDomain={handleExploreDomain}
        />
      ) : (
        <ArticleView
          article={currentArticle}
          onBackToHome={handleBackToHome}
          onOpenArticleBySlug={handleOpenArticleBySlug}
        />
      )}
    </div>
  );
}

export default App;
