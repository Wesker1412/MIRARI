import React, { useState } from 'react';
import { X, ChevronDown, Sparkles, Navigation, Send, ArrowRight, Layers } from 'lucide-react';
import { MirariMascot3D } from './MirariMascot3D';
import type { MascotState, KnowledgePoint } from '../../types';

interface CompanionDockProps {
  knowledgePoints: KnowledgePoint[];
  onNavigateToKnowledge: (knowledgeId: string) => void;
  onOpenArticleBySlug?: (slug: string) => void;
}

interface MessageItem {
  id: string;
  sender: 'mirari' | 'user';
  text: string;
  knowledgeId?: string;
  actionText?: string;
  actionTarget?: string;
}

export const CompanionDock: React.FC<CompanionDockProps> = ({
  knowledgePoints,
  onNavigateToKnowledge,
  onOpenArticleBySlug: _onOpenArticleBySlug,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth > 640 : true
  );
  const [isMinimized, setIsMinimized] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= 640 : false
  );
  const [showKnowledgeList, setShowKnowledgeList] = useState<boolean>(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [userInput, setUserInput] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'mirari',
      text: '你好！我是 MIRARI 陪讀精靈。在閱讀這篇《當星光暗了一點》時，有任何公式、物理概念或模擬器操作不解，隨時點選下方問題或直接問我喔！✨',
    },
  ]);

  // Suggested quick questions
  const sampleQuestions = [
    {
      label: '為什麼行星越大，恆星亮度下降越多？',
      query: '為什麼行星越大，恆星亮度下降越多？',
      knowledgeId: 'kp-transit-depth',
      reply:
        '因為當行星掠過恆星前方時，遮擋的光通量正比於行星投影面積 π·Rp²！當行星半徑變為 2 倍，遮蔽面積就會變成 4 倍，恆星亮度下降幅度（凌日深度 ΔF）也會擴大為 4 倍。讓我帶你到對應的公式段落與實驗！',
      actionText: '前往「凌日深度與行星半徑公式」段落',
    },
    {
      label: '帶我去看光度曲線模擬器',
      query: '帶我去看光度曲線模擬器',
      knowledgeId: 'kp-transit-simulator',
      reply:
        '沒問題！這篇文章配備了雙視角天文物理實驗室，可以手動調節行星半徑與撞擊參數，即時觀察光通量變化。我們這就出發！',
      actionText: '捲動至「即時模擬器」',
    },
    {
      label: '為什麼真實的光度曲線底部是 U 型？',
      query: '為什麼真實的光度曲線底部是 U 型？',
      knowledgeId: 'kp-limb-darkening',
      reply:
        '這是因為恆星大氣的「周邊昏暗效應（Limb Darkening）」！恆星中心視線穿透較深、溫度較高而明亮；邊緣視線穿透較淺、溫度較低而略暗。當行星穿過中心時遮擋了最亮區域，因此曲線呈現圓滑的 U 型。',
      actionText: '查看「周邊昏暗效應」解說',
    },
    {
      label: '凌日法如何探測外星大氣？',
      query: '凌日法如何探測外星大氣？',
      knowledgeId: 'kp-spectroscopy',
      reply:
        '當星光穿過行星大氣的微薄外緣時，大氣中的水蒸氣、二氧化碳或甲烷會吸收特定波長光線。韋伯望遠鏡就是藉由分析這圈光環的透射光譜來「嗅」出大氣成分的！',
      actionText: '前往「大氣透射光譜」專題',
    },
  ];

  const handleAskQuestion = (item: (typeof sampleQuestions)[0]) => {
    // 1. User message
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: 'user',
      text: item.query,
    };

    // 2. Switch mascot to thinking state
    setMascotState('thinking');

    // 3. Companion answers & navigates
    setTimeout(() => {
      const mirariMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: 'mirari',
        text: item.reply,
        knowledgeId: item.knowledgeId,
        actionText: item.actionText,
      };

      setMessages((prev) => [...prev, userMsg, mirariMsg]);
      setMascotState('excited');

      // Scroll and highlight target knowledge point
      if (item.knowledgeId) {
        onNavigateToKnowledge(item.knowledgeId);
      }

      // Revert to idle after celebration
      setTimeout(() => setMascotState('idle'), 2500);
    }, 600);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.trim();
    setUserInput('');

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
    };
    setMessages((prev) => [...prev, userMsg]);
    setMascotState('thinking');

    setTimeout(() => {
      let reply = '這是一個非常精采的科學思考點！';
      let targetKid = 'kp-transit-depth';
      let actionLabel = '查看相關科學段落';

      if (input.includes('大') || input.includes('半徑') || input.includes('下降') || input.includes('公式')) {
        reply =
          '行星半徑越大，投影遮蔽截面積（π·Rp²）就越大，恆星光度下降就越顯著！公式為 ΔF/F0 = (Rp / R*)²。';
        targetKid = 'kp-transit-depth';
        actionLabel = '前往公式段落';
      } else if (input.includes('模擬') || input.includes('操作') || input.includes('實驗')) {
        reply = '這就帶你前往文章中的雙視角光度曲線模擬器，親自調整行星參數！';
        targetKid = 'kp-transit-simulator';
        actionLabel = '前往模擬器';
      } else if (input.includes('昏暗') || input.includes('邊緣') || input.includes('假設')) {
        reply =
          '真實恆星有周邊昏暗效應，使得光度曲線呈現平滑的 U 型。模型簡化了光球層的溫度梯度。';
        targetKid = 'kp-limb-darkening';
        actionLabel = '查看模型假設';
      } else if (input.includes('推薦') || input.includes('黑洞') || input.includes('其他')) {
        reply =
          '如果想探索更極端的天體，推薦閱讀本期最新研究解讀《韋伯望遠鏡觀測早期宇宙超重黑洞異常吸積》！';
        targetKid = '';
      }

      const mirariMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: 'mirari',
        text: reply,
        knowledgeId: targetKid || undefined,
        actionText: targetKid ? actionLabel : undefined,
      };

      setMessages((prev) => [...prev, mirariMsg]);
      setMascotState('excited');

      if (targetKid) {
        onNavigateToKnowledge(targetKid);
      }

      setTimeout(() => setMascotState('idle'), 2000);
    }, 700);
  };

  // If minimized completely to floating pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2.5 rounded-full border border-mirari-amber/40 bg-mirari-surface/90 px-4 py-2.5 text-xs font-medium text-white shadow-xl backdrop-blur-md hover:border-mirari-amber transition group"
        >
          <div className="relative w-6 h-6">
            <span className="absolute inset-0 rounded-full bg-mirari-amber/20 animate-ping" />
            <div className="w-6 h-6 rounded-full bg-mirari-amber/30 border border-mirari-amber flex items-center justify-center text-[10px]">
              ✨
            </div>
          </div>
          <span className="font-serif tracking-wider">喚出 MIRARI 陪讀</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="MIRARI AI 陪讀伴侶"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[calc(100vw-2rem)] sm:max-w-sm w-88 transition-all duration-300"
    >
      {/* Companion Card */}
      <div className="relative rounded-2xl border border-mirari-border/80 bg-mirari-surface/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-mirari-border px-4 py-2.5 bg-mirari-card/70">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-serif text-sm font-semibold text-white tracking-wide">
              MIRARI 陪讀精靈
            </span>
            <span className="rounded bg-mirari-amber/20 px-1.5 py-0.5 text-[10px] font-mono text-mirari-amber">
              AI COMPANION
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {knowledgePoints && knowledgePoints.length > 0 && (
              <button
                onClick={() => setShowKnowledgeList(!showKnowledgeList)}
                className={`p-1 rounded transition text-xs flex items-center space-x-1 ${
                  showKnowledgeList
                    ? 'text-mirari-amber bg-mirari-amber/20'
                    : 'text-mirari-muted hover:text-white'
                }`}
                title="知識點快速目錄"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-mirari-muted hover:text-white rounded transition"
              title={isOpen ? '收起對話' : '展開對話'}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 text-mirari-muted hover:text-white rounded transition"
              title="最小化為角標"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Knowledge Points quick drop panel */}
        {showKnowledgeList && (
          <div className="p-3 bg-mirari-card/90 border-b border-mirari-border space-y-1.5 text-xs animate-fade-in">
            <span className="text-[10px] font-mono text-mirari-dim uppercase block">
              點擊快速定位知識點：
            </span>
            <div className="flex flex-col space-y-1">
              {knowledgePoints.map((kp) => (
                <button
                  key={kp.id}
                  onClick={() => {
                    onNavigateToKnowledge(kp.targetElementId);
                    setShowKnowledgeList(false);
                  }}
                  className="text-left px-2 py-1 rounded bg-mirari-surface hover:bg-mirari-border text-mirari-text hover:text-white transition flex items-center justify-between"
                >
                  <span className="truncate">{kp.title}</span>
                  <ArrowRight className="w-3 h-3 text-mirari-amber shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mascot + Status Showcase bar */}
        <div className="flex items-center px-4 py-2 bg-gradient-to-r from-mirari-card/40 via-mirari-bg/30 to-mirari-surface">
          <div
            className="w-16 h-16 shrink-0 relative cursor-pointer"
            onClick={() => setMascotState('excited')}
            title="點擊戳戳 MIRARI！"
          >
            <MirariMascot3D size="companion" state={mascotState} interactive={true} />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center space-x-1.5 text-xs text-mirari-muted font-mono">
              <Sparkles className="w-3 h-3 text-mirari-amber" />
              <span>
                {mascotState === 'thinking'
                  ? 'MIRARI 正在思考物理機制...'
                  : mascotState === 'excited'
                  ? '找到了！帶你飛往知識點 ✨'
                  : '陪同閱讀中 · 隨時可提問'}
              </span>
            </div>
            <p className="text-[11px] text-mirari-dim mt-0.5 line-clamp-1">
              點擊精靈或下方按鈕，可平滑引導至關鍵知識點
            </p>
          </div>
        </div>

        {/* Expandable Chat & Question Area */}
        {isOpen && (
          <div className="flex flex-col max-h-80 sm:max-h-96">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3 leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-mirari-cyan/15 text-white border border-mirari-cyan/30 rounded-tr-none'
                        : 'bg-mirari-card text-mirari-text border border-mirari-border rounded-tl-none shadow-sm'
                    }`}
                  >
                    <p>{m.text}</p>
                    {m.knowledgeId && m.actionText && (
                      <button
                        onClick={() => onNavigateToKnowledge(m.knowledgeId!)}
                        className="mt-2.5 inline-flex items-center space-x-1.5 text-[11px] font-mono text-mirari-amber hover:text-mirari-amberGlow bg-mirari-amber/10 border border-mirari-amber/30 px-2.5 py-1 rounded-lg transition"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{m.actionText}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Interactive Prompt Chips */}
            <div className="border-t border-mirari-border/70 p-3 bg-mirari-card/20 space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-mirari-dim block">
                探索推薦提問：
              </span>
              <div className="flex flex-col space-y-1.5">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskQuestion(q)}
                    className="text-left text-[11px] text-mirari-muted hover:text-white bg-mirari-surface hover:bg-mirari-border/60 border border-mirari-border/70 px-2.5 py-1.5 rounded-lg transition flex items-center justify-between group"
                  >
                    <span className="line-clamp-1">{q.label}</span>
                    <Sparkles className="w-3 h-3 text-mirari-amber opacity-60 group-hover:opacity-100 shrink-0 ml-1.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleCustomSubmit} className="border-t border-mirari-border p-2.5 flex items-center space-x-2 bg-mirari-surface">
              <input
                type="text"
                placeholder="詢問這篇文章的任何科學概念..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="flex-1 bg-mirari-bg border border-mirari-border text-xs text-white placeholder-mirari-dim rounded-xl px-3 py-2 focus:outline-none focus:border-mirari-cyan/60"
              />
              <button
                type="submit"
                disabled={!userInput.trim()}
                className="p-2 rounded-xl bg-mirari-cyan/20 border border-mirari-cyan/40 text-mirari-cyan hover:bg-mirari-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="發送問題"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
