import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { HomePage } from './components/home/HomePage';
import { ArticlePage } from './components/pages/ArticlePage';
import { SeriesPage } from './components/pages/SeriesPage';
import { NotFoundPage } from './components/pages/NotFoundPage';
import { SiteLayout } from './components/layout/SiteLayout';

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

function HomeRouteWrapper() {
  const navigate = useNavigate();
  return (
    <HomePage
      onSelectArticle={(article) => navigate(`/articles/${article.slug}`)}
      onExploreTopic={(_topicId) => {
        const elem = document.getElementById('explore-mirari');
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
        <Route element={<SiteLayout />}>
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
