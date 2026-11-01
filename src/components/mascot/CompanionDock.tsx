import React, { useState } from 'react';
import { MirariMascot3D } from './MirariMascot3D';
import type { MascotState } from '../../types';
import { searchArticleEvidence, type EvidenceSearchResult } from '../../services/articleEvidenceService';

interface CompanionDockProps {
  onEvidenceFound: (result: EvidenceSearchResult) => void;
  onClearHighlight: () => void;
  hasActiveHighlight: boolean;
}

export const CompanionDock: React.FC<CompanionDockProps> = ({
  onEvidenceFound,
  onClearHighlight,
  hasActiveHighlight,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [userInput, setUserInput] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<EvidenceSearchResult | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Three distinct demonstration questions finding different sentences
  const demoQuestions = [
    {
      label: '為什麼行星越大，恆星亮度下降越多？',
      query: '為什麼行星越大，恆星亮度下降越多？',
    },
    {
      label: '為什麼真實的光度曲線底部是 U 型而不是平的？',
      query: '為什麼真實的光度曲線底部是 U 型而不是平的？',
    },
    {
      label: '系外行星凌日被觀測到的幾率有多大？',
      query: '系外行星凌日被觀測到的幾率有多大？',
    },
  ];

  const handleQuery = (queryText: string) => {
    setIsThinking(true);
    setMascotState('thinking');
    setCurrentResult(null);

    setTimeout(() => {
      const searchResult = searchArticleEvidence(queryText);
      setIsThinking(false);
      setCurrentResult(searchResult);
      setMascotState('excited');

      // Trigger exact text highlight & scroll in article
      onEvidenceFound(searchResult);

      setTimeout(() => setMascotState('idle'), 2500);
    }, 400);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    const q = userInput.trim();
    setUserInput('');
    handleQuery(q);
  };

  return (
    <>
      {/* ─── Default State: Only the 3D Mascot at corner ─────────────── */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 select-none">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95 group"
          title={isOpen ? '收起提問' : '點擊與 MIRARI 互動提問'}
        >
          {/* Subtle soft backdrop disc */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/85 border border-mirari-line shadow-md backdrop-blur-sm flex items-center justify-center p-1">
            <MirariMascot3D size="companion" state={mascotState} interactive={true} />
          </div>

          {/* Tiny gentle hover prompt (Desktop only) */}
          {!isOpen && (
            <div className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <span className="text-[11px] font-sans bg-mirari-ink text-white px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                隨文提問
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Expanded State: Sleek Editorial Query Card ──────────────── */}
      {isOpen && (
        <>
          {/* Mobile backdrop overlay to close on click outside */}
          <div
            className="fixed inset-0 bg-mirari-ink/20 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed z-50 transition-all duration-300
              /* Mobile: Slide-up Bottom Sheet */
              inset-x-0 bottom-0 sm:inset-x-auto
              /* Desktop: Anchored Card beside mascot */
              sm:bottom-24 sm:right-6 sm:w-96
              bg-white border-t sm:border border-mirari-border shadow-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden
            `}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-mirari-line bg-mirari-paper/50">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-sm font-semibold text-mirari-ink">
                  隨文提問
                </span>
                <span className="text-[11px] text-mirari-dim font-sans">
                  · 依問題定位原文依據
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {hasActiveHighlight && (
                  <button
                    onClick={onClearHighlight}
                    className="text-[11px] text-mirari-amber hover:underline px-1"
                    title="清除文章內的文字高亮"
                  >
                    清除標記
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-mirari-dim hover:text-mirari-ink px-2 py-1 rounded-md hover:bg-mirari-surfaceAlt transition"
                >
                  關閉
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 max-h-[70vh] sm:max-h-[460px] overflow-y-auto">
              {/* Question Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-mirari-dim font-sans block">
                  範例提問（定位不同原文句子）：
                </span>
                <div className="flex flex-col space-y-1.5">
                  {demoQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuery(q.query)}
                      className="text-left text-xs text-mirari-muted hover:text-mirari-ink bg-mirari-paper hover:bg-mirari-surfaceAlt border border-mirari-line px-3 py-2.5 rounded-xl transition flex items-center justify-between group"
                    >
                      <span className="line-clamp-1">{q.label}</span>
                      <span className="text-[11px] text-mirari-dim group-hover:text-mirari-amber shrink-0 ml-2 transition-colors">
                        提問
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status / Answer Box */}
              {isThinking && (
                <div className="p-3.5 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-muted flex items-center space-x-2 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-mirari-amber" />
                  <span>正在理解問題並比對文章原文...</span>
                </div>
              )}

              {currentResult && !isThinking && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60 space-y-2.5 animate-fade-in">
                  <p className="text-xs font-medium text-mirari-ink leading-relaxed">
                    {currentResult.answer}
                  </p>

                  {/* Exact Quote Card */}
                  {currentResult.evidence && (
                    <div className="mt-2 pt-2 border-t border-amber-200/50 space-y-1">
                      <div className="text-[11px] text-amber-800 font-medium">
                        已在原文精確標記支持句：
                      </div>
                      <p className="text-[11px] text-slate-700 italic bg-amber-100/60 p-2 rounded-lg border border-amber-300/40 leading-relaxed font-sans">
                        「{currentResult.evidence.exactQuote}」
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Input Form */}
              <form onSubmit={handleCustomSubmit} className="pt-1">
                <div className="flex items-center space-x-2 border border-mirari-line focus-within:border-mirari-amber rounded-xl px-3 py-1.5 bg-mirari-paper transition">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="輸入任何關於此文章的問題..."
                    className="flex-1 bg-transparent text-xs text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isThinking}
                    className="px-3 py-1 rounded-lg bg-mirari-amber text-white text-xs font-sans font-medium hover:bg-amber-700 disabled:opacity-40 transition"
                  >
                    提問
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
};
