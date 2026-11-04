import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-mirari-line bg-mirari-paper text-mirari-muted font-sans text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="max-w-xl space-y-3">
          <div className="flex items-baseline gap-3">
            <Link
              to="/"
              className="font-serif font-bold text-mirari-ink text-lg tracking-wider hover:text-mirari-amber transition"
            >
              MIRARI
            </Link>
            <span className="text-[11px] font-mono tracking-widest text-mirari-dim uppercase">
              Digital Science Magazine
            </span>
          </div>
          <p className="font-serif text-sm font-medium text-mirari-ink tracking-wide">
            「讓科學不只被閱讀，也能親手探索。」
          </p>
          <p className="text-xs leading-relaxed text-mirari-muted pt-1">
            MIRARI 是一份探索自然法則與當代科學前沿的互動數位雜誌，結合研究解讀與可操作的科學實驗。閱讀時，可以向伴讀夥伴 MIRARI 提問，請它解釋觀念、帶你回到文章中的原文依據。想延伸探索，也可以從一個問題或關鍵字出發，請 MIRARI 引導你找到相關篇章。
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-mirari-line text-[11px] text-mirari-dim font-mono">
          © 2026 MIRARI
        </div>
      </div>
    </footer>
  );
};
