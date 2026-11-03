import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-mirari-line bg-mirari-paper text-mirari-muted font-sans text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Magazine Positioning */}
          <div className="lg:col-span-5 space-y-3">
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
              MIRARI 是一份探索自然法則與當代科學前沿的互動式數位科學雜誌。透過深入淺出的學術解讀、白話比喻與隨文動態數值實驗，陪伴每位讀者親手驗證科學現象的底層機制。
            </p>
          </div>

          {/* Editorial Principles & Numerical Simulation Limits */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 lg:pt-0">
            <div className="space-y-2 border-l border-mirari-line/60 pl-4 sm:pl-5">
              <h4 className="font-serif text-xs font-semibold text-mirari-ink tracking-wider">
                編輯原則 · 原始研究與證據
              </h4>
              <p className="text-[11px] leading-relaxed text-mirari-muted">
                本刊內容嚴格奠基於經同儕審查的學術期刊、學會預印本及經典科學理論。內文清楚區分已確立科學事實、實驗觀察與待驗證假說，杜絕誇大斷言，堅持可查證的原文依據與邏輯脈絡。
              </p>
            </div>

            <div className="space-y-2 border-l border-mirari-line/60 pl-4 sm:pl-5">
              <h4 className="font-serif text-xs font-semibold text-mirari-ink tracking-wider">
                互動模擬 · 教學性質與邊界限制
              </h4>
              <p className="text-[11px] leading-relaxed text-mirari-muted">
                文章內嵌之互動實驗與動態視覺化旨在建立直覺認知與現象展示。模型計算採用離散化數值解法與必要之物理簡化，存在截斷誤差與理想化邊界限制，不作為工程設計或精確科研計算之依據。
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Editorial Note */}
        <div className="mt-8 pt-6 border-t border-mirari-line flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-mirari-dim font-mono">
          <div>© 2026 MIRARI</div>
          <div className="text-center sm:text-right">
            <span>發布時區：Asia/Taipei · 靜態預渲染交付</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
