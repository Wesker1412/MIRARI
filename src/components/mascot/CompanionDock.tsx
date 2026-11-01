import React, { useState } from 'react';
import { X, Send, ArrowRight, CornerDownRight } from 'lucide-react';
import { MirariMascot3D } from './MirariMascot3D';
import type { MascotState, KnowledgePoint } from '../../types';

interface CompanionDockProps {
  knowledgePoints: KnowledgePoint[];
  onNavigateToKnowledge: (knowledgeId: string) => void;
  onOpenArticleBySlug?: (slug: string) => void;
}

interface QAReply {
  query: string;
  answer: string;
  knowledgeId?: string;
  actionText?: string;
}

export const CompanionDock: React.FC<CompanionDockProps> = ({
  onNavigateToKnowledge,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [userInput, setUserInput] = useState<string>('');
  const [currentReply, setCurrentReply] = useState<QAReply | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Quick concept exploration questions
  const quickQuestions: {
    label: string;
    query: string;
    knowledgeId: string;
    answer: string;
    actionText: string;
  }[] = [
    {
      label: '為什麼行星越大，恆星亮度下降越多？',
      query: '為什麼行星越大，恆星亮度下降越多？',
      knowledgeId: 'kp-transit-depth',
      answer:
        '因為行星遮擋的光量正比於它的二維截面積（π·Rp²）。當行星半徑變為 2 倍時，遮蔽面積會擴大為 4 倍，因此光度下降深度 ΔF 也隨之變為 4 倍。',
      actionText: '查看公式與推導段落',
    },
    {
      label: '跳至即時光度模擬器',
      query: '跳至即時光度模擬器',
      knowledgeId: 'kp-transit-simulator',
      answer:
        '已為你定位至模擬器。你可以親手拖動行星半徑比 Rp/R* 與撞擊參數 b，觀察空間投影與光度曲線的即時聯動。',
      actionText: '前往模擬實驗區',
    },
    {
      label: '為什麼真實的光度曲線底部是 U 型？',
      query: '為什麼真實的光度曲線底部是 U 型？',
      knowledgeId: 'kp-limb-darkening',
      answer:
        '這是由於恆星的「周邊昏暗效應」。恆星中心視線穿透較深、溫度較高而明亮；邊緣視線穿透較淺而較暗。當行星穿過中心時遮擋了最明亮區域，使曲線底部形成圓滑的 U 型。',
      actionText: '查看周邊昏暗解說',
    },
  ];

  const handleAskQuestion = (item: (typeof quickQuestions)[0]) => {
    setIsThinking(true);
    setMascotState('thinking');
    setCurrentReply(null);

    setTimeout(() => {
      setIsThinking(false);
      setCurrentReply({
        query: item.query,
        answer: item.answer,
        knowledgeId: item.knowledgeId,
        actionText: item.actionText,
      });
      setMascotState('excited');

      if (item.knowledgeId) {
        onNavigateToKnowledge(item.knowledgeId);
      }

      setTimeout(() => setMascotState('idle'), 2500);
    }, 450);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const query = userInput.trim();
    setUserInput('');
    setIsThinking(true);
    setMascotState('thinking');
    setCurrentReply(null);

    setTimeout(() => {
      setIsThinking(false);
      let answer = '這是一個很有啟發性的問題！在系外行星凌日法中，光度的微弱變化蘊含著行星幾何與大氣的關鍵密碼。';
      let targetKid = 'kp-transit-depth';
      let actionLabel = '前往相關段落';

      if (query.includes('大') || query.includes('半徑') || query.includes('下降') || query.includes('公式')) {
        answer =
          '行星半徑越大，投影遮蔽截面積（π·Rp²）就越大，光度下降深度與半徑比呈平方關係：ΔF/F₀ = (Rp / R*)²。';
        targetKid = 'kp-transit-depth';
        actionLabel = '前往公式段落';
      } else if (query.includes('模擬') || query.includes('操作') || query.includes('實驗')) {
        answer = '為你跳轉至文中的即時模擬器，可手動調節行星半徑與公轉時間軸。';
        targetKid = 'kp-transit-simulator';
        actionLabel = '前往模擬器';
      } else if (query.includes('昏暗') || query.includes('邊緣') || query.includes('假設')) {
        answer =
          '真實恆星大氣光學厚度隨視角改變，產生中心亮、邊緣暗的周邊昏暗現象，使曲線呈現柔和的 U 型。';
        targetKid = 'kp-limb-darkening';
        actionLabel = '查看模型假設';
      } else if (query.includes('大氣') || query.includes('光譜') || query.includes('水') || query.includes('韋伯')) {
        answer =
          '當星光穿透行星稀薄的大氣層外緣時，特定化學分子會吸收特定波長光線，藉由光譜分析即可探測異星大氣成分。';
        targetKid = 'kp-spectroscopy';
        actionLabel = '前往大氣光譜段落';
      }

      setCurrentReply({
        query,
        answer,
        knowledgeId: targetKid,
        actionText: actionLabel,
      });
      setMascotState('excited');

      if (targetKid) {
        onNavigateToKnowledge(targetKid);
      }

      setTimeout(() => setMascotState('idle'), 2500);
    }, 500);
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
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/80 border border-mirari-line shadow-md backdrop-blur-sm flex items-center justify-center p-1">
            <MirariMascot3D size="companion" state={mascotState} interactive={true} />
          </div>

          {/* Tiny gentle hover prompt (Desktop only) */}
          {!isOpen && (
            <div className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <span className="text-[11px] font-sans bg-mirari-ink text-white px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                點擊提問
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
                  · 點選概念快速定位
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-mirari-dim hover:text-mirari-ink hover:bg-mirari-surfaceAlt transition"
                title="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 max-h-[70vh] sm:max-h-[460px] overflow-y-auto">
              {/* Quick suggestion chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-mirari-dim font-sans block">
                  常見問題：
                </span>
                <div className="flex flex-col space-y-1.5">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAskQuestion(q)}
                      className="text-left text-xs text-mirari-muted hover:text-mirari-ink bg-mirari-paper hover:bg-mirari-surfaceAlt border border-mirari-line px-3 py-2 rounded-xl transition flex items-center justify-between group"
                    >
                      <span className="line-clamp-1">{q.label}</span>
                      <CornerDownRight className="w-3.5 h-3.5 text-mirari-dim group-hover:text-mirari-amber shrink-0 ml-1.5 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Status / Answer Box */}
              {isThinking && (
                <div className="p-3.5 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-muted flex items-center space-x-2 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-mirari-amber" />
                  <span>正在檢索相關物理概念...</span>
                </div>
              )}

              {currentReply && !isThinking && (
                <div className="p-4 rounded-xl bg-mirari-amberLight/60 border border-mirari-amber/20 space-y-2.5 animate-fade-in">
                  <div className="text-xs font-medium text-mirari-ink leading-relaxed">
                    {currentReply.answer}
                  </div>
                  {currentReply.knowledgeId && currentReply.actionText && (
                    <button
                      onClick={() => {
                        onNavigateToKnowledge(currentReply.knowledgeId!);
                      }}
                      className="inline-flex items-center space-x-1.5 text-xs font-sans text-mirari-amber hover:text-amber-800 font-medium transition"
                    >
                      <span>{currentReply.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleCustomSubmit} className="pt-1">
                <div className="flex items-center space-x-2 border border-mirari-line focus-within:border-mirari-amber rounded-xl px-3 py-1.5 bg-mirari-paper transition">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="詢問這篇文章的任何概念..."
                    className="flex-1 bg-transparent text-xs text-mirari-ink placeholder-mirari-dim focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isThinking}
                    className="p-1.5 rounded-lg bg-mirari-amber text-white hover:bg-amber-700 disabled:opacity-40 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
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
