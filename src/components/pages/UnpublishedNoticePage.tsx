import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article } from '../../types';
import { TOPICS } from '../../data/topics';
import { useSEO } from '../seo/useSEO';

interface UnpublishedNoticePageProps {
  article: Article;
}

export const UnpublishedNoticePage: React.FC<UnpublishedNoticePageProps> = ({ article }) => {
  const navigate = useNavigate();

  useSEO({
    title: `《${article.title}》（籌備中）`,
    description: article.summary || '本篇章尚處於同行評審或編輯部撰寫籌備中，尚未公開發布。',
  });

  const topicNames = article.topicIds
    .map((id) => TOPICS.find((t) => t.id === id)?.nameZh)
    .filter(Boolean)
    .join(' · ');

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
        <span className="font-serif text-sm font-semibold text-mirari-ink truncate max-w-xs hidden sm:inline-block">
          MIRARI · 編輯籌備室
        </span>
      </header>

      {/* Main notice */}
      <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-sans text-amber-800">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>學術審訂與籌備中 · 尚未公開發布</span>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-sans text-mirari-amber font-semibold uppercase tracking-wider">
            {topicNames} · {article.formatBadgeText}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-mirari-ink leading-tight">
            《{article.title}》
          </h1>
          <p className="font-serif text-base sm:text-lg text-mirari-muted leading-relaxed">
            {article.subtitle}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-mirari-line text-left space-y-3 font-sans text-xs text-mirari-muted leading-relaxed shadow-sm">
          <div className="flex items-center justify-between border-b border-mirari-line/60 pb-2">
            <span className="font-semibold text-mirari-ink text-sm font-serif">篇章籌備說明</span>
            <span className="text-[11px] text-mirari-dim">未發布保護機制已生效</span>
          </div>
          <p>
            本篇章目前處於選題研究、同行審議或互動數據實驗的建構階段，尚未通過發布審核。為維護科學媒體的嚴謹標準，MIRARI 不開放未發布草案的全文公開閱讀。
          </p>
          {article.journalReference && (
            <div className="pt-2 text-mirari-dim font-mono text-[11px]">
              預計參考來源：{article.journalReference.journal} ({article.journalReference.year})
            </div>
          )}
        </div>

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
            閱讀本期已發布封面故事《當星光暗了一點》
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-mirari-line py-6 text-center text-xs text-mirari-dim font-sans">
        © 2026 MIRARI 數位科學雜誌 · 嚴謹可驗證的科學內容標準
      </footer>
    </div>
  );
};
