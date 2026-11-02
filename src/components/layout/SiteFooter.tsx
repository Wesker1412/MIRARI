import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-mirari-line py-6 sm:py-8 bg-mirari-paper text-xs text-mirari-muted font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Brief Magazine Tagline */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-center md:text-left">
          <Link to="/" className="font-serif font-bold text-mirari-ink text-sm tracking-tight hover:text-mirari-amber transition">
            MIRARI
          </Link>
          <span className="text-mirari-line">·</span>
          <span className="text-mirari-muted">探索科學的互動數位雜誌</span>
        </div>

        {/* Navigation & Copyright in single unified layout */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-mirari-muted">
          <Link to="/" className="hover:text-mirari-ink transition">
            首頁
          </Link>
          <span className="text-mirari-line">·</span>
          <Link to="/journal" className="hover:text-mirari-ink transition">
            期刊解讀
          </Link>
          <span className="text-mirari-line">·</span>
          <Link to="/principles" className="hover:text-mirari-ink transition">
            科學原理
          </Link>
          <span className="text-mirari-line">·</span>
          <span className="text-mirari-dim">© 2026 MIRARI</span>
        </div>
      </div>
    </footer>
  );
};
