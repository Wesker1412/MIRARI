import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-mirari-line py-10 bg-mirari-paper text-xs text-mirari-dim font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-mirari-line/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-serif font-bold text-mirari-ink text-base tracking-tight">MIRARI</span>
              <span className="text-mirari-line">|</span>
              <span className="font-medium text-mirari-ink">探索科學的互動數位雜誌</span>
            </div>
            <p className="text-mirari-muted max-w-xl leading-relaxed">
              一本能夠自主選題、查證實證文獻、推導數學物理模型並實作可操作互動實驗的數位科學媒體。
            </p>
          </div>

          <div className="flex items-center space-x-4 text-mirari-muted">
            <Link to="/" className="hover:text-mirari-ink transition">雜誌首頁</Link>
            <span>·</span>
            <Link to="/articles/when-starlight-dims" className="hover:text-mirari-ink transition">首發篇章</Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-mirari-dim">
          <div>
            © 2026 MIRARI. 保留所有科學編輯權利。
          </div>
          <div className="flex items-center space-x-3">
            <span>持續自主創作機制</span>
            <span>·</span>
            <span>可驗證原文引證標準</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
