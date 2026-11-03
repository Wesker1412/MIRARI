import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useHorizontalDragScroll
 * 
 * 桌面版橫向滑動列平滑跟手、慣性滑行與柔和吸附 Hook：
 * 
 * 1. 跟手拖曳（Phase 1）：
 *    - 滑鼠按住時卡片跟隨滑鼠平順移動，使用 requestAnimationFrame 協調逐幀更新。
 *    - 拖曳期間暫停 CSS scroll-snap (scrollSnapType: 'none')，消除瀏覽器原生強制吸附造成的缺幀微卡頓。
 *    - 拖曳期間停用文字選取 (userSelect: 'none')，防止文字反白。
 *    - 全域追蹤滑鼠移動，游標短暫移出容器仍能持續穩定跟手，不突兀中斷。
 * 
 * 2. 慣性滑行（Phase 2）：
 *    - 記錄最近約 100–150ms 內的拖曳位移與時間戳，精確估算放開瞬間的速度 (px/ms)。
 *    - 速度越快，滑行距離適度延伸，並設定最大慣性距離上限，避免甩動過猛導致一次滑過多張卡片。
 *    - 新一輪 mousedown 立即取消進行中的慣性動畫，無縫銜接。
 * 
 * 3. 平滑吸附（Phase 3）：
 *    - 依據實際 DOM 卡片位置（card.getBoundingClientRect）計算最近卡片起始點，不硬編碼固定寬度。
 *    - 透過 easeOutCubic 曲線平滑收尾（動畫時長約 220–380ms 依距離自適應），達到接近手機原生橫滑的絲滑吸附感。
 *    - 吸附到達後再恢復 CSS scroll-snap，杜絕自訂動畫與原生吸附衝突跳格。
 * 
 * 4. 無障礙與相容性：
 *    - 單擊卡片正常進入（位移 <= 6px 放行）。
 *    - 拖曳 > 6px 透過 onClickCapture 徹底阻斷誤觸跳轉。
 *    - 支援鍵盤左右方向鍵平滑導航。
 *    - 支援 prefers-reduced-motion 降級。
 *    - 手機觸控與桌面觸控板完全維持原生流暢滑動。
 */

interface PointerRecord {
  x: number;
  time: number;
}

export function useHorizontalDragScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 內部動畫與物理狀態 Ref（不觸發不必要的 React 重繪）
  const stateRef = useRef<{
    isMouseDown: boolean;
    hasDraggedFar: boolean;
    startX: number;
    startScrollLeft: number;
    pendingScrollLeft: number;
    history: PointerRecord[];
    rafId: number | null;
    animId: number | null;
  }>({
    isMouseDown: false,
    hasDraggedFar: false,
    startX: 0,
    startScrollLeft: 0,
    pendingScrollLeft: 0,
    history: [],
    rafId: null,
    animId: null,
  });

  // 停止任何進行中的動畫或逐幀捲動
  const cancelActiveAnimations = useCallback(() => {
    if (stateRef.current.rafId !== null) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = null;
    }
    if (stateRef.current.animId !== null) {
      cancelAnimationFrame(stateRef.current.animId);
      stateRef.current.animId = null;
    }
  }, []);

  // 計算實際 DOM 中所有卡片的精確吸附點（相對於 container 捲動原點）
  const getCardSnapPoints = useCallback((): number[] => {
    const container = containerRef.current;
    if (!container) return [];

    const containerRect = container.getBoundingClientRect();
    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return [];

    const currentScrollLeft = container.scrollLeft;
    return children.map((child) => {
      const childRect = child.getBoundingClientRect();
      return currentScrollLeft + (childRect.left - containerRect.left);
    });
  }, []);

  // 執行平滑吸附與慣性停止動畫
  const startSnapAnimation = useCallback(
    (targetScrollLeft: number) => {
      const container = containerRef.current;
      if (!container) return;

      const startPos = container.scrollLeft;
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const targetPos = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
      const distance = targetPos - startPos;

      // 若距離極小或使用者偏好減少動畫，立即歸位
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (Math.abs(distance) < 1 || prefersReducedMotion) {
        container.scrollLeft = targetPos;
        container.style.scrollSnapType = '';
        container.style.scrollBehavior = '';
        setIsDragging(false);
        return;
      }

      // 動畫時長：基準 220ms，根據剩餘位移與速度動態調整在 220–380ms
      const baseDuration = 220 + Math.min(160, Math.abs(distance) * 0.32);
      const duration = Math.max(220, Math.min(380, baseDuration));
      const startTime = performance.now();

      // easeOutCubic: 柔和減速停靠
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = easeOutCubic(progress);

        if (containerRef.current) {
          containerRef.current.scrollLeft = startPos + distance * easedProgress;
        }

        if (progress < 1) {
          stateRef.current.animId = requestAnimationFrame(step);
        } else {
          // 動畫完成：精確寫入最終吸附點並恢復 CSS scroll-snap
          if (containerRef.current) {
            containerRef.current.scrollLeft = targetPos;
            containerRef.current.style.scrollSnapType = '';
            containerRef.current.style.scrollBehavior = '';
          }
          stateRef.current.animId = null;
          setIsDragging(false);
        }
      };

      stateRef.current.animId = requestAnimationFrame(step);
    },
    []
  );

  // 滑鼠放開處理（慣性滑行 + 平滑吸附）
  const handleDragRelease = useCallback(() => {
    if (!stateRef.current.isMouseDown) return;

    stateRef.current.isMouseDown = false;

    // 取消逐幀更新
    if (stateRef.current.rafId !== null) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = null;
    }

    const container = containerRef.current;
    if (!container) {
      setIsDragging(false);
      return;
    }

    // 若位移未超過 6px，視為正常單擊，不觸發吸附動畫
    if (!stateRef.current.hasDraggedFar) {
      container.style.scrollSnapType = '';
      container.style.scrollBehavior = '';
      setIsDragging(false);
      return;
    }

    // 延遲重設 hasDraggedFar，以在緊隨其後的 clickCapture 中攔截點擊跳轉
    setTimeout(() => {
      stateRef.current.hasDraggedFar = false;
    }, 80);

    // 估算放開瞬間的速度 (px/ms)
    const now = performance.now();
    const recent = stateRef.current.history.filter((p) => now - p.time <= 150);
    let velocity = 0; // 正值代表向左滑動（內容向前推進）、負值代表向右滑動

    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = last.time - first.time;
      if (dt > 10) {
        velocity = -(last.x - first.x) / dt;
      }
    }

    // 取得所有卡片在 DOM 中的真實吸附位置
    const snapPoints = getCardSnapPoints();
    const currentScrollLeft = container.scrollLeft;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);

    if (snapPoints.length === 0) {
      container.style.scrollSnapType = '';
      container.style.scrollBehavior = '';
      setIsDragging(false);
      return;
    }

    // 計算慣性位移：速度低於 0.15 px/ms 視為靜止放開；高於門檻時適度滑行
    let momentumDistance = 0;
    if (Math.abs(velocity) >= 0.15) {
      // 慣性係數約 190ms，並限制最大滑行距離（不超過約 1.6 個卡片寬度或容器 75% 寬度）
      const maxFlingDistance = Math.min(container.clientWidth * 0.75, 580);
      momentumDistance = velocity * 190;
      if (momentumDistance > maxFlingDistance) momentumDistance = maxFlingDistance;
      if (momentumDistance < -maxFlingDistance) momentumDistance = -maxFlingDistance;
    }

    const projectedScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, currentScrollLeft + momentumDistance)
    );

    // 尋找最接近 projectedScrollLeft 的卡片吸附點
    let targetSnapPoint = snapPoints[0];
    let minDistance = Infinity;

    for (const pt of snapPoints) {
      const d = Math.abs(pt - projectedScrollLeft);
      if (d < minDistance) {
        minDistance = d;
        targetSnapPoint = pt;
      }
    }

    // 當帶有較明確甩動力道時，保證至少前進或後退一個卡片
    if (velocity > 0.38) {
      const forwardPoints = snapPoints.filter((p) => p > currentScrollLeft + 25);
      if (forwardPoints.length > 0 && targetSnapPoint <= currentScrollLeft) {
        targetSnapPoint = forwardPoints[0];
      }
    } else if (velocity < -0.38) {
      const backwardPoints = snapPoints.filter((p) => p < currentScrollLeft - 25);
      if (backwardPoints.length > 0 && targetSnapPoint >= currentScrollLeft) {
        targetSnapPoint = backwardPoints[backwardPoints.length - 1];
      }
    }

    targetSnapPoint = Math.max(0, Math.min(maxScrollLeft, targetSnapPoint));

    // 啟動 ease-out 吸附動畫
    startSnapAnimation(targetSnapPoint);
  }, [getCardSnapPoints, startSnapAnimation]);

  // 1. 滑鼠按下
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !containerRef.current) return;

      // 新拖曳動作立即中斷前一輪未完成之慣性或吸附動畫
      cancelActiveAnimations();

      const now = performance.now();
      stateRef.current = {
        isMouseDown: true,
        hasDraggedFar: false,
        startX: e.pageX,
        startScrollLeft: containerRef.current.scrollLeft,
        pendingScrollLeft: containerRef.current.scrollLeft,
        history: [{ x: e.pageX, time: now }],
        rafId: null,
        animId: null,
      };
    },
    [cancelActiveAnimations]
  );

  // 2. 移動跟手（全域綁定，防止快速拖動出容器時中斷）
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!stateRef.current.isMouseDown || !containerRef.current) return;

      const dx = e.pageX - stateRef.current.startX;
      const now = performance.now();

      // 超過 6px 門檻判定為明確拖曳
      if (!stateRef.current.hasDraggedFar && Math.abs(dx) > 6) {
        stateRef.current.hasDraggedFar = true;
        setIsDragging(true);
        // 關鍵：拖曳期間暫停 CSS scroll-snap，杜絕瀏覽器每幀強制吸附之卡頓
        containerRef.current.style.scrollSnapType = 'none';
        containerRef.current.style.scrollBehavior = 'auto';
      }

      if (stateRef.current.hasDraggedFar) {
        e.preventDefault();

        // 維護最近 150ms 移動軌跡
        stateRef.current.history.push({ x: e.pageX, time: now });
        stateRef.current.history = stateRef.current.history.filter((p) => now - p.time <= 150);

        // 計算目標捲動位置
        const container = containerRef.current;
        const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
        const targetScroll = stateRef.current.startScrollLeft - dx;
        stateRef.current.pendingScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScroll));

        // 使用 requestAnimationFrame 協調逐幀平順捲動
        if (stateRef.current.rafId === null) {
          stateRef.current.rafId = requestAnimationFrame(() => {
            if (containerRef.current && stateRef.current.isMouseDown) {
              containerRef.current.scrollLeft = stateRef.current.pendingScrollLeft;
            }
            stateRef.current.rafId = null;
          });
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (stateRef.current.isMouseDown) {
        handleDragRelease();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      cancelActiveAnimations();
    };
  }, [cancelActiveAnimations, handleDragRelease]);

  // 阻斷拖曳後的誤點擊
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (stateRef.current.hasDraggedFar) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // 鍵盤無障礙導航（支援左右方向鍵切換至鄰近卡片）
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        cancelActiveAnimations();

        const snapPoints = getCardSnapPoints();
        const current = container.scrollLeft;
        const max = Math.max(0, container.scrollWidth - container.clientWidth);

        let target = current;
        if (e.key === 'ArrowRight') {
          const next = snapPoints.find((p) => p > current + 15);
          target = next !== undefined ? next : max;
        } else {
          const prevs = snapPoints.filter((p) => p < current - 15);
          target = prevs.length > 0 ? prevs[prevs.length - 1] : 0;
        }

        target = Math.max(0, Math.min(max, target));
        startSnapAnimation(target);
      }
    },
    [cancelActiveAnimations, getCardSnapPoints, startSnapAnimation]
  );

  // 防止瀏覽器原生拖曳鬼影（HTML5 dragstart）
  const onDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return {
    containerRef,
    isDragging,
    dragProps: {
      ref: containerRef,
      onMouseDown,
      onClickCapture,
      onKeyDown,
      onDragStart,
      tabIndex: 0,
      role: 'region',
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: isDragging ? ('none' as const) : undefined,
      },
    },
  };
}
