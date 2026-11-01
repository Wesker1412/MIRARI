import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MirariMascot3D } from './MirariMascot3D';
import type { MascotState, Article, AIRecommendation } from '../../types';
import { queryMockAIRecommendation } from '../../services/aiRecommendationService';
import { searchArticleEvidence, type EvidenceSearchResult } from '../../services/articleEvidenceService';

interface GlobalMascotOverlayProps {
  currentView: 'home' | 'article';
  currentArticle?: Article;
  onSelectArticle: (article: Article) => void;
  onEvidenceFound: (result: EvidenceSearchResult) => void;
  onClearHighlight: () => void;
  hasActiveHighlight: boolean;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY_POS = 'mirari_mascot_pos';
const SESSION_KEY_GREETED = 'mirari_home_greeted';

export const GlobalMascotOverlay: React.FC<GlobalMascotOverlayProps> = ({
  currentView,
  currentArticle: _currentArticle,
  onSelectArticle,
  onEvidenceFound,
  onClearHighlight,
  hasActiveHighlight,
}) => {
  // Mascot state
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Position & Drag state
  const [hasCustomPos, setHasCustomPos] = useState<boolean>(() => {
    return !!localStorage.getItem(STORAGE_KEY_POS);
  });
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Home search state
  const [homeQuery, setHomeQuery] = useState<string>('');
  const [homeRecResult, setHomeRecResult] = useState<AIRecommendation | null>(null);
  const [isSearchingHome, setIsSearchingHome] = useState<boolean>(false);

  // Article Q&A state
  const [articleQuery, setArticleQuery] = useState<string>('');
  const [articleEvidenceResult, setArticleEvidenceResult] = useState<EvidenceSearchResult | null>(null);
  const [isSearchingArticle, setIsSearchingArticle] = useState<boolean>(false);

  // Drag interaction tracking refs
  const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartMascotPosRef = useRef<Position>({ x: 0, y: 0 });
  const hasMovedBeyondThresholdRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mascot dimensions based on view
  const isHomeView = currentView === 'home';
  const mascotDimension = isHomeView ? 116 : 80;

  // ─── Default Anchor Calculation ──────────────────────────────────
  const getDefaultAnchorPosition = useCallback((): Position => {
    const margin = 24;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (isHomeView) {
      // Check if hero anchor element exists in DOM
      const heroAnchor = document.getElementById('mirari-hero-anchor');
      if (heroAnchor) {
        const rect = heroAnchor.getBoundingClientRect();
        // If anchor is within or near viewport, snap to it
        if (rect.top > -50 && rect.top < h) {
          return {
            x: Math.max(margin, Math.min(w - mascotDimension - margin, rect.left)),
            y: Math.max(margin, Math.min(h - mascotDimension - margin, rect.top)),
          };
        }
      }
      // Default floating hero position (prominently placed on right)
      return {
        x: Math.max(margin, w - mascotDimension - (w > 1024 ? 80 : 32)),
        y: Math.max(margin, Math.min(h - mascotDimension - margin, 240)),
      };
    } else {
      // Article view default companion anchor: bottom-right corner
      return {
        x: Math.max(margin, w - mascotDimension - 24),
        y: Math.max(margin, h - mascotDimension - 24),
      };
    }
  }, [isHomeView, mascotDimension]);

  // Synchronize position on mount or view switch if not custom dragged
  useEffect(() => {
    if (hasCustomPos) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_POS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const clampedX = Math.max(16, Math.min(window.innerWidth - mascotDimension - 16, parsed.x));
          const clampedY = Math.max(16, Math.min(window.innerHeight - mascotDimension - 16, parsed.y));
          setPosition({ x: clampedX, y: clampedY });
          return;
        }
      } catch (err) {
        console.warn('Failed to parse saved mascot position:', err);
      }
    }

    // Otherwise calculate default anchor
    const pos = getDefaultAnchorPosition();
    setPosition(pos);
  }, [currentView, hasCustomPos, getDefaultAnchorPosition, mascotDimension]);

  // Recalculate on window resize & scroll (when unpinned)
  useEffect(() => {
    const handleResize = () => {
      if (hasCustomPos) {
        setPosition((prev) => ({
          x: Math.max(16, Math.min(window.innerWidth - mascotDimension - 16, prev.x)),
          y: Math.max(16, Math.min(window.innerHeight - mascotDimension - 16, prev.y)),
        }));
      } else {
        setPosition(getDefaultAnchorPosition());
      }
    };

    const handleScroll = () => {
      if (!hasCustomPos && isHomeView) {
        // Smoothly track anchor or remain comfortably floating
        setPosition(getDefaultAnchorPosition());
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasCustomPos, isHomeView, getDefaultAnchorPosition, mascotDimension]);

  // ─── Proactive Home Greeting & Search Pull-out ───────────────────
  useEffect(() => {
    if (currentView === 'home') {
      const alreadyGreeted = sessionStorage.getItem(SESSION_KEY_GREETED);
      if (!alreadyGreeted) {
        // Gentle delay before proactive greeting and pull-out
        const timer = setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY_GREETED, 'true');
          setMascotState('excited');
          setIsPanelOpen(true);
          const resetTimer = setTimeout(() => {
            setMascotState('idle');
          }, 1800);
          return () => clearTimeout(resetTimer);
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      // In article view, keep panel closed initially
      setIsPanelOpen(false);
    }
  }, [currentView]);

  // ─── Free Drag Pointer Handlers ──────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Capture pointer to track outside container smoothly
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }

    dragStartPointerRef.current = { x: e.clientX, y: e.clientY };
    dragStartMascotPosRef.current = { ...position };
    hasMovedBeyondThresholdRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Only if pointer capture is active
    if (!containerRef.current?.hasPointerCapture(e.pointerId)) return;

    const dx = e.clientX - dragStartPointerRef.current.x;
    const dy = e.clientY - dragStartPointerRef.current.y;

    if (!hasMovedBeyondThresholdRef.current && Math.hypot(dx, dy) > 8) {
      hasMovedBeyondThresholdRef.current = true;
      setIsDragging(true);
      setMascotState('thinking');
    }

    if (hasMovedBeyondThresholdRef.current) {
      const rawX = dragStartMascotPosRef.current.x + dx;
      const rawY = dragStartMascotPosRef.current.y + dy;

      const minX = 16;
      const maxX = window.innerWidth - mascotDimension - 16;
      const minY = 16;
      const maxY = window.innerHeight - mascotDimension - 16;

      const clampedX = Math.max(minX, Math.min(maxX, rawX));
      const clampedY = Math.max(minY, Math.min(maxY, rawY));

      setPosition({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!containerRef.current?.hasPointerCapture(e.pointerId)) return;
    try {
      containerRef.current.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (hasMovedBeyondThresholdRef.current) {
      // Drag action completed
      setIsDragging(false);
      setMascotState('idle');
      setHasCustomPos(true);
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(position));
    } else {
      // Click/Tap toggle
      setIsPanelOpen((prev) => !prev);
    }

    hasMovedBeyondThresholdRef.current = false;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setIsDragging(false);
    setMascotState('idle');
    hasMovedBeyondThresholdRef.current = false;
  };

  // Reset to default anchor position
  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(STORAGE_KEY_POS);
    setHasCustomPos(false);
    setPosition(getDefaultAnchorPosition());
  };

  // ─── Home Natural Language Search Logic ──────────────────────────
  const sampleHomeQueries = [
    '可以親手操作的天文物理文章',
    '黑洞與早期宇宙的秘密',
    '大腦如何感知時間？',
    '近期關注的科學研究',
  ];

  const handleExecuteHomeSearch = (queryStr: string) => {
    if (!queryStr.trim()) return;
    setIsSearchingHome(true);
    setMascotState('thinking');
    setHomeQuery(queryStr);

    setTimeout(() => {
      const rec = queryMockAIRecommendation(queryStr);
      setHomeRecResult(rec);
      setIsSearchingHome(false);
      setMascotState('excited');
      setTimeout(() => setMascotState('idle'), 2000);
    }, 400);
  };

  // ─── Article Reading Evidence Query Logic ────────────────────────
  const demoArticleQuestions = [
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

  const handleExecuteArticleQuery = (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearchingArticle(true);
    setMascotState('thinking');
    setArticleEvidenceResult(null);

    setTimeout(() => {
      const searchResult = searchArticleEvidence(queryText);
      setIsSearchingArticle(false);
      setArticleEvidenceResult(searchResult);
      setMascotState('excited');

      // Trigger exact text highlight and smooth scroll in ArticleView
      onEvidenceFound(searchResult);

      setTimeout(() => setMascotState('idle'), 2500);
    }, 400);
  };

  // ─── Floating Panel Position Calculation (Desktop) ───────────────
  const panelWidth = 420;
  const estimatedPanelHeight = 520;
  const isNearRight = position.x + mascotDimension / 2 > window.innerWidth / 2;

  // Horizontal position
  let panelLeft: number | undefined;
  let panelRight: number | undefined;

  if (isNearRight) {
    const rawRight = window.innerWidth - position.x + 16;
    panelRight = Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rawRight));
  } else {
    const rawLeft = position.x + mascotDimension + 16;
    panelLeft = Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rawLeft));
  }

  // Vertical position clamped to ensure header is always inside viewport
  let panelTop: number;
  if (position.y + estimatedPanelHeight > window.innerHeight - 16) {
    panelTop = Math.max(16, window.innerHeight - estimatedPanelHeight - 24);
  } else {
    panelTop = Math.max(16, position.y);
  }

  return (
    <>
      {/* ─── Persistent Single Mascot Controller ───────────────────── */}
      <div
        ref={containerRef}
        id="mirari-global-mascot"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: `${mascotDimension}px`,
          height: `${mascotDimension}px`,
          touchAction: 'none',
        }}
        className={`fixed top-0 left-0 z-50 select-none cursor-grab active:cursor-grabbing ${
          isDragging ? '' : 'transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)'
        }`}
        title={isPanelOpen ? '點擊收起面板，長按可自由拖曳' : '點擊展開對話，長按可自由拖曳'}
      >
        {/* Subtle disc backdrop for clean readability on any background */}
        <div className="relative w-full h-full rounded-full bg-white/90 border border-mirari-line shadow-md backdrop-blur-sm flex items-center justify-center p-1.5 group">
          {/* THE SINGLE 3D WebGL MASCOT */}
          <MirariMascot3D
            size="full"
            state={mascotState}
            interactive={false} // Outer container handles pointer events & gaze
          />

          {/* Hover Status Indicator / Hint (Desktop) */}
          {!isPanelOpen && !isDragging && isHovered && (
            <div className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <span className="text-[11px] font-sans bg-mirari-ink text-white px-2.5 py-1 rounded-full shadow-md">
                {isHomeView ? '探索篇章' : '隨文提問'}
              </span>
            </div>
          )}

          {/* Reset Position Pill if User Dragged it Away */}
          {hasCustomPos && isHovered && !isDragging && (
            <button
              onClick={handleResetPosition}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white border border-mirari-line text-mirari-dim hover:text-mirari-ink text-[10px] px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap font-sans transition hover:bg-mirari-paper"
              title="將 MIRARI 移回預設錨點"
            >
              復位
            </button>
          )}
        </div>
      </div>

      {/* ─── Contextual Floating Panel ──────────────────────────────── */}
      {isPanelOpen && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-mirari-ink/25 backdrop-blur-[2px] z-40 sm:hidden"
            onClick={() => setIsPanelOpen(false)}
          />

          {/* Panel Wrapper: Bottom Sheet on Mobile, Smart Anchor on Desktop */}
          <div
            style={
              window.innerWidth >= 640
                ? {
                    position: 'fixed',
                    top: `${panelTop}px`,
                    ...(panelLeft !== undefined ? { left: `${panelLeft}px` } : { right: `${panelRight}px` }),
                    maxHeight: `${Math.min(window.innerHeight - 32, 580)}px`,
                  }
                : undefined
            }
            className={`fixed z-50 
              /* Mobile: Bottom Sheet */
              inset-x-0 bottom-0 sm:inset-x-auto
              /* Desktop: Sized Floating Card */
              sm:w-[420px]
              bg-white border-t sm:border border-mirari-border shadow-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden
              flex flex-col animate-fade-in
            `}
          >
            {/* ─── Header Bar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-mirari-line bg-mirari-paper/60">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-sm font-semibold text-mirari-ink">
                  {isHomeView ? '探索科學篇章' : '隨文提問'}
                </span>
                <span className="text-[11px] text-mirari-dim font-sans">
                  {isHomeView ? '· 自然語言搜尋' : '· 定位原文依據'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {!isHomeView && hasActiveHighlight && (
                  <button
                    onClick={onClearHighlight}
                    className="text-[11px] text-mirari-amber hover:underline px-1 font-sans"
                    title="清除文章內的文字高亮"
                  >
                    清除標記
                  </button>
                )}
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="text-xs text-mirari-dim hover:text-mirari-ink px-2 py-1 rounded-md hover:bg-mirari-surfaceAlt transition font-sans"
                >
                  關閉
                </button>
              </div>
            </div>

            {/* ─── Panel Content: Home Exploration Mode ──────────────── */}
            {isHomeView ? (
              <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] sm:max-h-[500px]">
                <p className="text-xs text-mirari-muted leading-relaxed font-sans">
                  輸入你想探索的科學現象或主題，為你推薦站內深度解析與期刊追蹤。
                </p>

                {/* Search Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleExecuteHomeSearch(homeQuery);
                  }}
                  className="relative flex items-center rounded-xl border border-mirari-border bg-mirari-paper p-1 focus-within:border-mirari-ink transition"
                >
                  <input
                    type="text"
                    value={homeQuery}
                    onChange={(e) => setHomeQuery(e.target.value)}
                    placeholder="例如：行星凌日、黑洞、大腦時間感..."
                    className="w-full bg-transparent px-3 py-1.5 text-xs text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!homeQuery.trim() || isSearchingHome}
                    className="shrink-0 rounded-lg bg-mirari-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-black transition disabled:opacity-40 font-sans"
                  >
                    {isSearchingHome ? '尋找中' : '搜尋'}
                  </button>
                </form>

                {/* Hot Query Chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-mirari-dim font-sans block">熱門探索：</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sampleHomeQueries.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleExecuteHomeSearch(q)}
                        className="text-[11px] font-sans rounded-full border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt px-2.5 py-1 text-mirari-muted hover:text-mirari-ink transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Recommendation Results */}
                {homeRecResult && (
                  <div className="pt-3 border-t border-mirari-line space-y-3 animate-fade-in">
                    <div className="p-3 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-ink leading-relaxed font-sans">
                      {homeRecResult.curatorReply}
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-sans text-mirari-dim block">推薦篇章：</span>
                      {homeRecResult.recommendedArticles.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => {
                            setIsPanelOpen(false);
                            onSelectArticle(article);
                          }}
                          className="group p-3 rounded-xl border border-mirari-line hover:border-mirari-border bg-white transition cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-1 text-[11px]">
                            <span className="text-mirari-amber font-sans font-medium">
                              {article.formatBadgeText}
                            </span>
                            <span className="text-mirari-dim font-sans">
                              {article.status === 'published' ? '正式發布' : '企劃中'}
                            </span>
                          </div>
                          <h4 className="font-serif text-sm font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-1">
                            {article.title}
                          </h4>
                          <p className="mt-1 text-xs text-mirari-muted line-clamp-2 leading-relaxed">
                            {article.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ─── Panel Content: Article Evidence Q&A Mode ─────────── */
              <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] sm:max-h-[500px]">
                {/* Example Questions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-mirari-dim font-sans block">
                    範例提問（定位不同原文句子）：
                  </span>
                  <div className="flex flex-col space-y-1.5">
                    {demoArticleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleExecuteArticleQuery(q.query)}
                        className="text-left text-xs text-mirari-muted hover:text-mirari-ink bg-mirari-paper hover:bg-mirari-surfaceAlt border border-mirari-line px-3 py-2 rounded-xl transition flex items-center justify-between group"
                      >
                        <span className="line-clamp-1">{q.label}</span>
                        <span className="text-mirari-dim group-hover:text-mirari-ink ml-2 shrink-0 font-sans text-[11px]">
                          定位
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Query Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleExecuteArticleQuery(articleQuery);
                  }}
                  className="space-y-2 pt-2 border-t border-mirari-line"
                >
                  <span className="text-[11px] text-mirari-dim font-sans block">
                    或直接輸入提問：
                  </span>
                  <div className="flex items-center space-y-0 rounded-xl border border-mirari-border bg-mirari-paper p-1 focus-within:border-mirari-ink transition">
                    <input
                      type="text"
                      value={articleQuery}
                      onChange={(e) => setArticleQuery(e.target.value)}
                      placeholder="針對本文內容提問..."
                      className="w-full bg-transparent px-3 py-1.5 text-xs text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!articleQuery.trim() || isSearchingArticle}
                      className="shrink-0 rounded-lg bg-mirari-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-black transition disabled:opacity-40 font-sans"
                    >
                      {isSearchingArticle ? '檢索中' : '提問'}
                    </button>
                  </div>
                </form>

                {/* Evidence Answer Card */}
                {articleEvidenceResult && (
                  <div className="pt-3 border-t border-mirari-line space-y-3 animate-fade-in">
                    {articleEvidenceResult.evidence ? (
                      <div className="space-y-2">
                        {/* Evidence quote tag */}
                        <div className="flex items-center space-x-1.5 text-xs font-sans text-mirari-amber font-semibold">
                          <span>已定位原文依據</span>
                          <span className="text-mirari-dim font-normal">
                            (可見文章發光標記)
                          </span>
                        </div>

                        {/* Exact quote pill */}
                        <blockquote className="p-3 rounded-xl bg-amber-50/70 border-l-2 border-mirari-amber text-xs text-mirari-ink leading-relaxed italic">
                          「{articleEvidenceResult.evidence.exactQuote}」
                        </blockquote>

                        {/* Companion Explanation */}
                        <div className="p-3 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-ink leading-relaxed">
                          {articleEvidenceResult.answer}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-muted leading-relaxed font-sans">
                        {articleEvidenceResult.answer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};
