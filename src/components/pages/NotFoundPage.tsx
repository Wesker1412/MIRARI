import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../seo/useSEO';

interface NotFoundPageProps {
  title?: string;
  message?: string;
  slug?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = '404 · 篇章坐標未找到',
  message,
  slug,
}) => {
  const navigate = useNavigate();

  useSEO({
    title: '404 篇章未找到',
    description: '您所探尋的科學篇章或網址坐標不存在或已重新編目。',
  });

  return (
    <div className="min-h-screen bg-mirari-paper text-mirari-ink flex flex-col justify-between">
      {/* Header bar */}
      <header className="border-b border-mirari-line bg-mirari-paper/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-sans text-mirari-muted hover:text-mirari-ink transition px-3 py-1.5 rounded-lg border border-mirari-line hover:border-mirari-border"
        >
          返回 MIRARI 首頁
        </button>
        <span className="font-serif text-sm font-semibold text-mirari-ink">
          MIRARI · 科學篇章導覽
        </span>
      </header>

      {/* Main 404 content */}
      <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-mirari-surfaceAlt border border-mirari-line text-xs font-mono text-mirari-muted">
          <span>HTTP 404</span>
          <span>·</span>
          <span>COORDINATE NOT FOUND</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-mirari-ink">
          {title}
        </h1>

        <p className="text-sm sm:text-base text-mirari-muted font-sans leading-relaxed">
          {message ||
            (slug
              ? `您所尋找的文章網址坐標「${slug}」目前不存在，可能尚未收錄、路徑已重構或已完成學術歸檔。`
              : '您所輸入的網址在 MIRARI 數位科學雜誌的知識索引中不存在。')}
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 font-sans text-xs">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-mirari-ink text-white font-medium hover:bg-black transition shadow-sm"
          >
            返回雜誌首頁
          </button>
          <button
            onClick={() => navigate('/articles/when-starlight-dims')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-mirari-line bg-white text-mirari-ink hover:border-mirari-border hover:bg-mirari-surfaceAlt transition"
          >
            探索本期封面故事《當星光暗了一點》
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-mirari-line py-6 text-center text-xs text-mirari-dim font-sans">
        © 2026 MIRARI 數位科學雜誌 · 探索可驗證的科學世界
      </footer>
    </div>
  );
};
