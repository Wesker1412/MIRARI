import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MirariMascot3D } from './MirariMascot3D';
import { RoundBottomFlaskFrame } from './RoundBottomFlaskFrame';
import type { MascotState, Article, AIRecommendation, SentenceEvidence } from '../../types';
import { queryMockAIRecommendation, queryAISearch } from '../../services/aiRecommendationService';
import {
  searchArticleEvidence,
  getArticleKnowledgePoints,
  queryArticleCompanionChat,
  type EvidenceSearchResult,
} from '../../services/articleEvidenceService';

interface GlobalMascotOverlayProps {
  currentView: 'home' | 'article' | 'explore';
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
  currentArticle,
  onSelectArticle,
  onEvidenceFound,
  onClearHighlight,
  hasActiveHighlight,
}) => {
  // Mascot state
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isInExploreSection, setIsInExploreSection] = useState<boolean>(false);
  const hasUserDismissedExploreRef = useRef<boolean>(false);

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

  // Article Q&A state (Phase 5: Multi-turn Dialogue Stream & Recommendation)
  interface DialogueTurn {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    evidence?: SentenceEvidence | null;
    recommendedArticles?: Article[];
    isRecommendation?: boolean;
  }
  const [articleQuery, setArticleQuery] = useState<string>('');
  const [articleEvidenceResult, setArticleEvidenceResult] = useState<EvidenceSearchResult | null>(null);
  const [articleDialogue, setArticleDialogue] = useState<DialogueTurn[]>([]);
  const [isSearchingArticle, setIsSearchingArticle] = useState<boolean>(false);
  const [isMobileExpandedAnswer, setIsMobileExpandedAnswer] = useState<boolean>(false);

  // Drag interaction tracking refs
  const dragStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartMascotPosRef = useRef<Position>({ x: 0, y: 0 });
  const hasMovedBeyondThresholdRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [measuredPanelHeight, setMeasuredPanelHeight] = useState<number>(180);

  // Request sequence and article tracking to prevent race conditions / stale async responses
  const activeArticleRequestIdRef = useRef<number>(0);
  const activeArticleIdRef = useRef<string | null>(null);
  const activeHomeRequestIdRef = useRef<number>(0);

  // Mascot dimensions based on view & Section 4 presence (Flask ratio 100:120)
  const isHomeView = currentView === 'home';
  const isExploreView = currentView === 'explore';
  const mascotWidth = isInExploreSection || isExploreView ? 120 : isHomeView ? 104 : 80;
  const mascotHeight = isInExploreSection || isExploreView ? 144 : isHomeView ? 125 : 96;

  // ─── Default Anchor Calculation ──────────────────────────────────
  const getDefaultAnchorPosition = useCallback((): Position => {
    const margin = 24;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1. If in Explore Page, anchor to #explore-page-mascot-anchor
    if (isExploreView) {
      const explorePageAnchor = document.getElementById('explore-page-mascot-anchor');
      if (explorePageAnchor) {
        const rect = explorePageAnchor.getBoundingClientRect();
        if (rect.top > -100 && rect.top < h + 100) {
          return {
            x: Math.max(margin, Math.min(w - mascotWidth - margin, rect.left + (rect.width - mascotWidth) / 2)),
            y: Math.max(margin, Math.min(h - mascotHeight - margin, rect.top + (rect.height - mascotHeight) / 2)),
          };
        }
      }
      return {
        x: Math.max(margin, w - mascotWidth - (w > 1024 ? 64 : 24)),
        y: Math.max(margin, Math.min(h - mascotHeight - margin, 180)),
      };
    }

    if (isHomeView) {
      // 2. If in Section 4 Explore workbench, anchor to #explore-mirari-anchor
      if (isInExploreSection) {
        const exploreAnchor = document.getElementById('explore-mirari-anchor');
        if (exploreAnchor) {
          const rect = exploreAnchor.getBoundingClientRect();
          if (rect.top > -100 && rect.top < h + 100) {
            return {
              x: Math.max(margin, Math.min(w - mascotWidth - margin, rect.left + (rect.width - mascotWidth) / 2)),
              y: Math.max(margin, Math.min(h - mascotHeight - margin, rect.top + (rect.height - mascotHeight) / 2)),
            };
          }
        }
      }

      // 3. Check if hero anchor element exists in DOM (Section 1 Cover)
      const heroAnchor = document.getElementById('mirari-hero-anchor');
      if (heroAnchor) {
        const rect = heroAnchor.getBoundingClientRect();
        if (rect.top > -50 && rect.top < h) {
          return {
            x: Math.max(margin, Math.min(w - mascotWidth - margin, rect.left)),
            y: Math.max(margin, Math.min(h - mascotHeight - margin, rect.top)),
          };
        }
      }

      // 4. Default floating hero position (prominently placed on right)
      return {
        x: Math.max(margin, w - mascotWidth - (w > 1024 ? 64 : 24)),
        y: Math.max(margin, Math.min(h - mascotHeight - margin, 240)),
      };
    } else {
      // Article view default companion anchor: bottom-right corner
      return {
        x: Math.max(margin, w - mascotWidth - 24),
        y: Math.max(margin, h - mascotHeight - 24),
      };
    }
  }, [isHomeView, isExploreView, isInExploreSection, mascotWidth, mascotHeight]);

  // Synchronize position on mount or view switch if not custom dragged
  useEffect(() => {
    if (hasCustomPos) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_POS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const clampedX = Math.max(16, Math.min(window.innerWidth - mascotWidth - 16, parsed.x));
          const clampedY = Math.max(16, Math.min(window.innerHeight - mascotHeight - 16, parsed.y));
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
  }, [currentView, hasCustomPos, getDefaultAnchorPosition, mascotWidth, mascotHeight]);

  // Recalculate on window resize & scroll (when unpinned)
  useEffect(() => {
    const handleResize = () => {
      if (hasCustomPos) {
        setPosition((prev) => ({
          x: Math.max(16, Math.min(window.innerWidth - mascotWidth - 16, prev.x)),
          y: Math.max(16, Math.min(window.innerHeight - mascotHeight - 16, prev.y)),
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
  }, [hasCustomPos, isHomeView, getDefaultAnchorPosition, mascotWidth, mascotHeight]);

  // ─── Section 4 Intersection Observer (Explore with MIRARI) ───────
  useEffect(() => {
    if (currentView !== 'home') {
      setIsInExploreSection(false);
      return;
    }

    const exploreElement = document.getElementById('explore-mirari');
    if (!exploreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInExploreSection(true);
          // Auto-open panel if user hasn't explicitly dismissed it
          if (!hasUserDismissedExploreRef.current) {
            setIsPanelOpen(true);
            setMascotState('excited');
            const timer = setTimeout(() => setMascotState('idle'), 1800);
            return () => clearTimeout(timer);
          }
        } else {
          setIsInExploreSection(false);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(exploreElement);
    return () => observer.disconnect();
  }, [currentView]);

  // ─── Global Event Bus for Section 4 Chips & Summon ───────────────
  useEffect(() => {
    const handleExploreQuery = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (customEvent.detail?.query) {
        setHomeQuery(customEvent.detail.query);
        setIsPanelOpen(true);
        handleExecuteHomeSearch(customEvent.detail.query);
      }
    };

    const handleSummon = () => {
      setHasCustomPos(false);
      localStorage.removeItem(STORAGE_KEY_POS);
      setMascotState('excited');
      setIsPanelOpen(true);
      setTimeout(() => {
        setMascotState('idle');
      }, 1800);
    };

    window.addEventListener('mirari:explore-query', handleExploreQuery);
    window.addEventListener('mirari:summon-mascot', handleSummon);
    return () => {
      window.removeEventListener('mirari:explore-query', handleExploreQuery);
      window.removeEventListener('mirari:summon-mascot', handleSummon);
    };
  }, []);

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    if (isInExploreSection) {
      hasUserDismissedExploreRef.current = true;
    }
  };

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
    } else if (currentView === 'explore') {
      // In explore page: expand panel on desktop; on mobile keep closed so it doesn't block the screen
      if (typeof window !== 'undefined' && window.innerWidth >= 640) {
        setIsPanelOpen(true);
      }
      setMascotState('excited');
      const resetTimer = setTimeout(() => setMascotState('idle'), 1800);
      return () => clearTimeout(resetTimer);
    } else {
      // In article view, keep panel closed initially
      setIsPanelOpen(false);
    }
  }, [currentView]);

  // ─── Reset Article Q&A State on Article Switch ───────────────────
  useEffect(() => {
    // 增加請求序號，立即使前一篇文章正在發送中的非同步請求失效
    activeArticleRequestIdRef.current++;
    activeArticleIdRef.current = currentArticle?.id || currentArticle?.slug || null;
    setArticleQuery('');
    setArticleEvidenceResult(null);
    setArticleDialogue([]);
    setIsSearchingArticle(false);
    setIsMobileExpandedAnswer(false);
    onClearHighlight();
  }, [currentArticle?.id, onClearHighlight]);

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
      const maxX = window.innerWidth - mascotWidth - 16;
      const minY = 16;
      const maxY = window.innerHeight - mascotHeight - 16;

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

  // ─── Home Natural Language Search Logic ──────────────────────────
  const sampleHomeQueries = [
    '想看看雙擺如何展現渾沌？',
    '好奇動作電位怎麼跨越細胞膜？',
    '聊聊麥克斯韋妖如何把資訊變成能量？',
    '系外行星如何利用凌日法量測半徑？',
  ];

  const handleExecuteHomeSearch = async (queryStr: string) => {
    if (!queryStr.trim()) return;
    const currentHomeId = ++activeHomeRequestIdRef.current;
    setIsSearchingHome(true);
    setMascotState('thinking');
    setHomeQuery(queryStr);

    try {
      const rec = await queryAISearch(queryStr);
      if (currentHomeId !== activeHomeRequestIdRef.current) return;
      setHomeRecResult(rec);
      setIsSearchingHome(false);
      if (rec.recommendedArticles.length > 0) {
        setMascotState('excited');
        setTimeout(() => setMascotState('idle'), 2000);
      } else {
        setMascotState('idle');
      }
    } catch {
      if (currentHomeId !== activeHomeRequestIdRef.current) return;
      const rec = queryMockAIRecommendation(queryStr);
      setHomeRecResult(rec);
      setIsSearchingHome(false);
      setMascotState('idle');
    }
  };

  // ─── Article Reading Evidence Query Logic ────────────────────────
  const articleQuestionChips = useMemo(() => {
    if (!currentArticle) return [];
    const kps = getArticleKnowledgePoints(currentArticle.id || currentArticle.slug);
    return kps.map((kp) => ({
      label: kp.label,
      query: kp.suggestedQuestion,
    }));
  }, [currentArticle]);

  const handleExecuteArticleQuery = async (queryText: string) => {
    if (!queryText.trim() || !currentArticle) return;

    // Immediately blur active element to collapse mobile virtual keyboard
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur();
    }

    const trimmedQuery = queryText.trim();
    const currentRequestId = ++activeArticleRequestIdRef.current;
    const requestArticleId = currentArticle.id || currentArticle.slug;
    activeArticleIdRef.current = requestArticleId;

    setIsSearchingArticle(true);
    setMascotState('thinking');

    // Contextual dialogue history for continuous follow-ups
    const historyPayload = articleDialogue.slice(-4).map((d) => ({
      role: d.role,
      content: d.content,
    }));

    try {
      const searchResult = await queryArticleCompanionChat(
        requestArticleId,
        trimmedQuery,
        historyPayload
      );

      // 防止非同步舊答案覆蓋：若有新問題發出或讀者已切換至其他文章，直接拋棄過期結果
      if (
        currentRequestId !== activeArticleRequestIdRef.current ||
        requestArticleId !== (currentArticle?.id || currentArticle?.slug)
      ) {
        return;
      }

      setIsSearchingArticle(false);
      setArticleEvidenceResult(searchResult);

      setArticleDialogue((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          content: trimmedQuery,
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          content: searchResult.answer,
          evidence: searchResult.evidence,
          recommendedArticles: searchResult.recommendedArticles,
          isRecommendation: searchResult.isRecommendation,
        },
      ]);

      // On mobile, collapse full overlay panel so user sees article and compact card
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        setIsPanelOpen(false);
      }

      // 絕不拿其他文章的證據標記當前文章，僅在確信為本文證據時高亮
      if (searchResult.evidence && !searchResult.isRecommendation) {
        setMascotState('excited');
        // Trigger exact text highlight and smooth scroll in ArticleView
        onEvidenceFound(searchResult);
        setTimeout(() => setMascotState('idle'), 2500);
      } else {
        onClearHighlight();
        setMascotState('idle');
      }
    } catch {
      // 異常降級同樣防止舊請求覆蓋當前文章
      if (
        currentRequestId !== activeArticleRequestIdRef.current ||
        requestArticleId !== (currentArticle?.id || currentArticle?.slug)
      ) {
        return;
      }

      const fallback = searchArticleEvidence(
        trimmedQuery,
        requestArticleId
      );
      setIsSearchingArticle(false);
      setArticleEvidenceResult(fallback);

      setArticleDialogue((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          content: trimmedQuery,
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          content: fallback.answer,
          evidence: fallback.evidence,
          recommendedArticles: fallback.recommendedArticles,
          isRecommendation: fallback.isRecommendation,
        },
      ]);

      if (fallback.evidence && !fallback.isRecommendation) {
        onEvidenceFound(fallback);
      } else {
        onClearHighlight();
      }
      setMascotState('idle');
    }
  };

  const handleDismissAnswer = () => {
    setArticleEvidenceResult(null);
    onClearHighlight();
  };

  const handleResetArticleChat = () => {
    activeArticleRequestIdRef.current++;
    setArticleQuery('');
    setArticleEvidenceResult(null);
    setArticleDialogue([]);
    setIsSearchingArticle(false);
    onClearHighlight();
  };

  // ─── Floating Panel Position Calculation (Desktop) ───────────────
  const panelWidth = 380;
  const isNearRight = position.x + mascotWidth / 2 > window.innerWidth / 2;

  // Dynamically measure actual panel height to avoid hardcoded height assumptions
  useEffect(() => {
    if (!isPanelOpen || !panelRef.current) return;
    const updateHeight = () => {
      if (panelRef.current) {
        const h = panelRef.current.offsetHeight;
        if (h > 0) setMeasuredPanelHeight(h);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [isPanelOpen, homeRecResult, articleEvidenceResult, isSearchingHome, isSearchingArticle]);

  // Horizontal position
  let panelLeft: number | undefined;
  let panelRight: number | undefined;

  if (isNearRight) {
    const rawRight = window.innerWidth - position.x + 16;
    panelRight = Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rawRight));
  } else {
    const rawLeft = position.x + mascotWidth + 16;
    panelLeft = Math.max(16, Math.min(window.innerWidth - panelWidth - 16, rawLeft));
  }

  // Vertical position dynamically clamped using actual measured panel height
  const panelTop =
    position.y + measuredPanelHeight > window.innerHeight - 20
      ? Math.max(16, window.innerHeight - measuredPanelHeight - 20)
      : Math.max(16, position.y);

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
          width: `${mascotWidth}px`,
          height: `${mascotHeight}px`,
          touchAction: 'none',
        }}
        className={`fixed top-0 left-0 z-50 select-none cursor-grab active:cursor-grabbing ${
          isDragging ? '' : 'transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)'
        }`}
        title={isPanelOpen ? '點擊收起面板，長按可自由拖曳' : '點擊展開對話，長按可自由拖曳'}
      >
        {/* Laboratory Round-Bottom Flask (圓底燒瓶) Container Frame */}
        <div className="relative w-full h-full flex items-center justify-center group">
          {/* Refined Glass Flask Frame (Lip Rim, Neck, Spherical Bulb & Highlights) */}
          <RoundBottomFlaskFrame
            isHovered={isHovered}
            state={mascotState}
          />

          {/* THE SINGLE 3D WebGL MASCOT (Star-seed Sprite / 星種精靈) */}
          <div className="relative z-10 w-full h-full flex items-center justify-center pt-2">
            <MirariMascot3D
              size="full"
              state={mascotState}
              interactive={true} // Responsive gaze tracking
            />
          </div>

          {/* Hover Status Indicator / Hint (Desktop) */}
          {!isPanelOpen && !isDragging && isHovered && (
            <div className="hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <span className="text-[11px] font-sans bg-mirari-ink text-white px-2.5 py-1 rounded-full shadow-md">
                {isHomeView || isExploreView ? '探索篇章' : '隨文提問'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Contextual Floating Panel ──────────────────────────────── */}
      {isPanelOpen && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-mirari-ink/25 backdrop-blur-[2px] z-40 sm:hidden"
            onClick={handleClosePanel}
          />

          {/* Panel Wrapper: Bottom Sheet on Mobile, Smart Anchor on Desktop */}
          <div
            ref={panelRef}
            id="mirari-floating-panel"
            style={
              window.innerWidth >= 640
                ? {
                    position: 'fixed',
                    top: `${panelTop}px`,
                    ...(panelLeft !== undefined ? { left: `${panelLeft}px` } : { right: `${panelRight}px` }),
                  }
                : undefined
            }
            className={`fixed z-50 
              /* Mobile: Bottom Sheet */
              inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto
              /* Desktop: Compact Floating Card */
              sm:w-[380px]
              h-auto max-h-[calc(100vh-32px)] sm:max-h-[min(560px,calc(100vh-32px))]
              bg-white border-t sm:border border-mirari-border shadow-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden
              flex flex-col animate-fade-in
            `}
          >
            {/* ─── Header Bar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-mirari-line bg-mirari-paper/80">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-sm font-semibold text-mirari-ink">
                  {isHomeView || isExploreView ? '探索篇章' : '隨文提問'}
                </span>
                {!isHomeView && !isExploreView && hasActiveHighlight && (
                  <button
                    onClick={onClearHighlight}
                    className="text-[11px] text-mirari-amber hover:underline px-1 font-sans"
                    title="清除文章內的文字高亮"
                  >
                    清除標記
                  </button>
                )}
              </div>

              <button
                onClick={handleClosePanel}
                className="text-xs text-mirari-dim hover:text-mirari-ink px-2 py-0.5 rounded hover:bg-mirari-surfaceAlt transition font-sans"
              >
                關閉
              </button>
            </div>

            {/* ─── Panel Content: Home/Explore Exploration Mode ──────────────── */}
            {isHomeView || isExploreView ? (
              <div className="p-4 space-y-3 overflow-y-auto max-h-[min(500px,calc(85vh-48px))]">
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
                    placeholder="輸入科學現象或關鍵字..."
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

                {/* 試試這樣問 (Single-line Short Chips) */}
                <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-sans">
                  <span className="text-mirari-dim shrink-0">試試：</span>
                  {sampleHomeQueries.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleExecuteHomeSearch(q)}
                      className="rounded-md border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt px-2 py-0.5 text-mirari-muted hover:text-mirari-ink transition whitespace-nowrap"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Search Recommendation Results (Only expands when present) */}
                {homeRecResult && (
                  <div className="pt-3 border-t border-mirari-line space-y-2.5 animate-fade-in">
                    <div className="p-2.5 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-ink leading-relaxed font-sans space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-mirari-dim">MIRARI 引導回應</span>
                        {homeRecResult.matchLevel === 'direct' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-sans font-medium">已有專題收錄</span>
                        )}
                        {homeRecResult.matchLevel === 'partial' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-sans font-medium">部分相關內容</span>
                        )}
                        {homeRecResult.matchLevel === 'none' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-sans font-medium">尚無相關文章</span>
                        )}
                      </div>
                      <p>{homeRecResult.curatorReply}</p>
                    </div>

                    {homeRecResult.recommendedArticles.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-sans text-mirari-dim block">推薦篇章：</span>
                        {homeRecResult.recommendedArticles.map((article) => (
                          <div
                            key={article.id}
                            onClick={() => {
                              setIsPanelOpen(false);
                              onSelectArticle(article);
                            }}
                            className="group p-2.5 rounded-xl border border-mirari-line hover:border-mirari-border bg-white transition cursor-pointer flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between mb-1 text-[11px]">
                              <span className="text-mirari-amber font-sans font-medium">
                                {article.formatBadgeText}
                              </span>
                              <span className="text-mirari-dim font-sans">
                                {article.status === 'published' ? '正式發布' : '籌備中'}
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
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ─── Panel Content: Article Evidence Q&A Mode ─────────── */
              <div className="p-4 space-y-3 overflow-y-auto max-h-[min(520px,calc(85vh-48px))]">
                {/* Multi-turn Dialogue Stream if turns exist */}
                {articleDialogue.length > 0 && (
                  <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                    {articleDialogue.map((turn) => (
                      <div
                        key={turn.id}
                        className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-xl p-2.5 text-xs font-sans leading-relaxed ${
                            turn.role === 'user'
                              ? 'bg-mirari-ink text-white rounded-br-none'
                              : 'bg-mirari-paper border border-mirari-line text-mirari-ink rounded-bl-none shadow-sm'
                          }`}
                        >
                          {turn.role === 'assistant' && (
                            <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-semibold text-mirari-amber">
                              <span className="w-1.5 h-1.5 rounded-full bg-mirari-amber" />
                              <span>{turn.isRecommendation ? 'MIRARI 推薦閱讀' : 'MIRARI 白話陪讀'}</span>
                              {turn.evidence && (
                                <span className="px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-medium">
                                  已定位原文
                                </span>
                              )}
                              {turn.isRecommendation && (
                                <span className="px-1 py-0.2 rounded bg-sky-50 text-sky-800 font-medium">
                                  延伸專題
                                </span>
                              )}
                            </div>
                          )}
                          <p>{turn.content}</p>

                          {/* 渲染推薦文章卡片 */}
                          {turn.recommendedArticles && turn.recommendedArticles.length > 0 && (
                            <div className="mt-2.5 space-y-1.5 pt-2 border-t border-mirari-line/60">
                              <div className="text-[10px] font-sans font-medium text-mirari-muted flex items-center space-x-1">
                                <span>站內推薦專題：</span>
                              </div>
                              {turn.recommendedArticles.map((rec) => (
                                <div
                                  key={rec.id}
                                  onClick={() => {
                                    if (onSelectArticle) {
                                      onSelectArticle(rec);
                                      setIsPanelOpen(false);
                                    }
                                  }}
                                  className="group block p-2 rounded-lg border border-mirari-line hover:border-mirari-amber/60 bg-white/70 hover:bg-white transition-all cursor-pointer text-left shadow-2xs"
                                >
                                  <div className="flex items-center space-x-1 text-[10px] font-mono text-mirari-amber mb-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-mirari-amber" />
                                    <span>
                                      {rec.formatBadgeText ||
                                        (rec.editorialCategory === 'journal_interpretation'
                                          ? '期刊解讀'
                                          : '科學原理')}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-serif font-bold text-mirari-ink group-hover:text-mirari-amber transition-colors line-clamp-1">
                                    {rec.title}
                                  </div>
                                  {rec.summary && (
                                    <div className="text-[10px] font-sans text-mirari-dim line-clamp-1 mt-0.5">
                                      {rec.summary}
                                    </div>
                                  )}
                                  <div className="mt-1 flex items-center justify-end text-[10px] font-sans text-mirari-amber font-medium">
                                    <span>閱讀此專題 →</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-up / Question Chips */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px] font-sans pt-1">
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="text-mirari-dim shrink-0 text-[10px]">
                      {articleDialogue.length > 0 ? '追問與主題：' : '提問提示：'}
                    </span>
                    {articleDialogue.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setArticleQuery('那為什麼？');
                            handleExecuteArticleQuery('那為什麼？');
                          }}
                          className="rounded-full border border-mirari-amber/40 bg-amber-50/50 hover:bg-amber-100/60 px-2 py-0.5 text-amber-900 transition cursor-pointer text-[10px]"
                        >
                          那為什麼？
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setArticleQuery('可以再簡單一點嗎？');
                            handleExecuteArticleQuery('可以再簡單一點嗎？');
                          }}
                          className="rounded-full border border-mirari-amber/40 bg-amber-50/50 hover:bg-amber-100/60 px-2 py-0.5 text-amber-900 transition cursor-pointer text-[10px]"
                        >
                          可以再簡單一點嗎？
                        </button>
                      </>
                    )}
                    {articleQuestionChips.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setArticleQuery(q.query);
                          handleExecuteArticleQuery(q.query);
                        }}
                        className="rounded-md border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt px-2 py-0.5 text-mirari-muted hover:text-mirari-ink transition whitespace-nowrap cursor-pointer text-left"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  {articleDialogue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetArticleChat}
                      className="text-[10px] text-mirari-muted hover:text-mirari-ink hover:underline cursor-pointer shrink-0"
                    >
                      重新開始
                    </button>
                  )}
                </div>

                {/* Custom Query Input (Always at bottom for continuous interaction) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = articleQuery;
                    setArticleQuery('');
                    handleExecuteArticleQuery(q);
                  }}
                  className="relative flex items-center rounded-xl border border-mirari-border bg-mirari-paper p-1 focus-within:border-mirari-ink transition"
                >
                  <input
                    type="text"
                    value={articleQuery}
                    onChange={(e) => setArticleQuery(e.target.value)}
                    placeholder={
                      articleDialogue.length > 0
                        ? '輸入追問或新疑問...'
                        : '針對本文內容自由提問...'
                    }
                    className="w-full bg-transparent px-3 py-1.5 text-xs text-mirari-ink placeholder-mirari-dim focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!articleQuery.trim() || isSearchingArticle}
                    className="shrink-0 rounded-lg bg-mirari-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-black transition disabled:opacity-40 font-sans"
                  >
                    {isSearchingArticle ? '思考中' : '發送'}
                  </button>
                </form>

                {/* Fallback Display if single result without dialogue turn */}
                {articleDialogue.length === 0 && articleEvidenceResult && (
                  <div className="pt-2 border-t border-mirari-line space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-sans text-mirari-amber font-semibold">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-mirari-amber animate-pulse" />
                        <span>
                          {articleEvidenceResult.isRecommendation ? 'MIRARI 推薦閱讀' : 'MIRARI 白話陪讀'}
                        </span>
                        {articleEvidenceResult.evidence && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 font-sans font-medium">
                            已定位原文
                          </span>
                        )}
                        {articleEvidenceResult.isRecommendation && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 font-sans font-medium">
                            延伸專題
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleDismissAnswer}
                        className="text-[11px] text-mirari-muted hover:text-mirari-ink hover:underline font-normal cursor-pointer"
                      >
                        關閉回答
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-ink leading-relaxed font-sans">
                      <p>{articleEvidenceResult.answer}</p>
                      {articleEvidenceResult.recommendedArticles && articleEvidenceResult.recommendedArticles.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-mirari-line/60 space-y-1.5">
                          <div className="text-[10px] font-sans font-medium text-mirari-muted">推薦閱讀專題：</div>
                          {articleEvidenceResult.recommendedArticles.map((rec) => (
                            <div
                              key={rec.id}
                              onClick={() => {
                                if (onSelectArticle) {
                                  onSelectArticle(rec);
                                  setIsPanelOpen(false);
                                }
                              }}
                              className="group block p-2 rounded-lg border border-mirari-line hover:border-mirari-amber/60 bg-white/70 hover:bg-white transition cursor-pointer text-left shadow-2xs"
                            >
                              <div className="text-[11px] font-serif font-bold text-mirari-ink group-hover:text-mirari-amber transition-colors line-clamp-1">
                                {rec.title}
                              </div>
                              {rec.summary && (
                                <div className="text-[10px] font-sans text-mirari-dim line-clamp-1 mt-0.5">
                                  {rec.summary}
                                </div>
                              )}
                              <div className="mt-1 flex items-center justify-end text-[10px] font-sans text-mirari-amber font-medium">
                                <span>閱讀此專題 →</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Mobile Compact Companion Answer Card (In Article View) ──── */}
      {currentView === 'article' && articleEvidenceResult && !isPanelOpen && (
        <div
          id="mirari-mobile-companion-card"
          className="fixed bottom-4 inset-x-3 z-[60] sm:hidden animate-fade-in pointer-events-auto"
          style={{
            paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="bg-white/95 backdrop-blur-md border border-mirari-amber/40 shadow-2xl rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-mirari-amber animate-pulse" />
                <span className="text-[11px] font-sans font-bold text-mirari-ink">
                  {articleEvidenceResult.isRecommendation ? 'MIRARI 推薦閱讀' : 'MIRARI 白話陪讀'}
                </span>
                {articleEvidenceResult.evidence && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 font-sans font-medium">
                    已定位原文
                  </span>
                )}
                {articleEvidenceResult.isRecommendation && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 font-sans font-medium">
                    延伸專題
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(true)}
                  className="text-[11px] text-mirari-muted hover:text-mirari-ink px-2 py-1 rounded hover:bg-mirari-surfaceAlt transition font-sans cursor-pointer"
                >
                  換個問題
                </button>
                <button
                  type="button"
                  onClick={handleDismissAnswer}
                  className="flex items-center space-x-1 text-xs text-mirari-dim hover:text-mirari-ink px-2.5 py-1 rounded-full bg-mirari-paper border border-mirari-line hover:bg-mirari-surfaceAlt transition font-sans font-medium cursor-pointer"
                  title="收起回答並清除標記"
                  aria-label="收起回答"
                >
                  <span>✕</span>
                  <span>收起</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-mirari-ink leading-relaxed font-sans">
              <div className={isMobileExpandedAnswer ? 'max-h-[30vh] overflow-y-auto pr-1' : 'line-clamp-3'}>
                <p>{articleEvidenceResult.answer}</p>
              </div>
              {articleEvidenceResult.answer.length > 90 && (
                <button
                  type="button"
                  onClick={() => setIsMobileExpandedAnswer((prev) => !prev)}
                  className="text-[11px] text-mirari-amber hover:underline mt-1 font-medium block cursor-pointer"
                >
                  {isMobileExpandedAnswer ? '▲ 收合簡短模式' : '▼ 展開完整解釋'}
                </button>
              )}
            </div>

            {/* 推薦閱讀文章卡片 */}
            {articleEvidenceResult.recommendedArticles && articleEvidenceResult.recommendedArticles.length > 0 && (
              <div className="pt-2 border-t border-mirari-line/60 space-y-1.5">
                <div className="text-[10px] text-mirari-muted font-sans font-medium flex items-center space-x-1">
                  <span>推薦閱讀專題：</span>
                </div>
                {articleEvidenceResult.recommendedArticles.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      if (onSelectArticle) {
                        onSelectArticle(rec);
                        handleDismissAnswer();
                      }
                    }}
                    className="p-2 rounded-lg bg-mirari-paper border border-mirari-line hover:border-mirari-amber/60 flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-serif font-bold text-mirari-ink truncate">{rec.title}</div>
                      {rec.summary && (
                        <div className="text-[10px] font-sans text-mirari-dim truncate">{rec.summary}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-mirari-amber font-sans font-medium shrink-0">閱讀 →</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile Quick Follow-up Row */}
            <div className="flex items-center space-x-1.5 pt-1.5 border-t border-mirari-line/60 overflow-x-auto text-[11px] font-sans">
              <span className="text-[10px] text-mirari-dim shrink-0">追問：</span>
              <button
                type="button"
                onClick={() => handleExecuteArticleQuery('那為什麼？')}
                className="rounded-full border border-mirari-amber/40 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900 font-sans cursor-pointer hover:bg-amber-100 shrink-0"
              >
                那為什麼？
              </button>
              <button
                type="button"
                onClick={() => handleExecuteArticleQuery('可以再簡單一點嗎？')}
                className="rounded-full border border-mirari-amber/40 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900 font-sans cursor-pointer hover:bg-amber-100 shrink-0"
              >
                再簡單一點
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
