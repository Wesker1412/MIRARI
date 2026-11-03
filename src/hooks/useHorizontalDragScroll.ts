import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useHorizontalDragScroll
 * 
 * 輕量橫向拖曳捲動 Hook：
 * - 桌面：滑鼠左鍵按住左右拖曳，拖曳超過門檻（> 6px）時阻斷卡片點擊；未拖曳之單擊正常進入。
 * - 拖曳時禁止選取卡片文字，不干擾頁面垂直捲動。
 * - 支援鍵盤左右方向鍵平滑移動與卡片 Tab 聚焦。
 * - 手機：保持原生觸控平滑滑動。
 */
export function useHorizontalDragScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragInfoRef = useRef<{
    startX: number;
    scrollLeft: number;
    hasDraggedFar: boolean;
    isMouseDown: boolean;
  }>({
    startX: 0,
    scrollLeft: 0,
    hasDraggedFar: false,
    isMouseDown: false,
  });

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 僅響應滑鼠主鍵（左鍵）
    if (e.button !== 0 || !containerRef.current) return;

    dragInfoRef.current = {
      startX: e.pageX,
      scrollLeft: containerRef.current.scrollLeft,
      hasDraggedFar: false,
      isMouseDown: true,
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragInfoRef.current.isMouseDown || !containerRef.current) return;

    const dx = e.pageX - dragInfoRef.current.startX;
    if (Math.abs(dx) > 6) {
      dragInfoRef.current.hasDraggedFar = true;
    }

    if (dragInfoRef.current.hasDraggedFar) {
      // 拖曳捲動時避免選取文字
      e.preventDefault();
      containerRef.current.scrollLeft = dragInfoRef.current.scrollLeft - dx;
    }
  }, []);

  const stopDragging = useCallback(() => {
    if (dragInfoRef.current.isMouseDown) {
      dragInfoRef.current.isMouseDown = false;
      setIsDragging(false);
      // 延遲重設 hasDraggedFar，以確保在緊隨其後的 clickCapture 中能攔截點擊
      setTimeout(() => {
        dragInfoRef.current.hasDraggedFar = false;
      }, 60);
    }
  }, []);

  const onMouseUp = stopDragging;
  const onMouseLeave = stopDragging;

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (dragInfoRef.current.hasDraggedFar) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      containerRef.current.scrollBy({ left: 340, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      containerRef.current.scrollBy({ left: -340, behavior: 'smooth' });
    }
  }, []);

  // 全域 mouseup 監聽，防止滑鼠在外部放開時狀態卡住
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragInfoRef.current.isMouseDown) {
        stopDragging();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [stopDragging]);

  return {
    containerRef,
    isDragging,
    dragProps: {
      ref: containerRef,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClickCapture,
      onKeyDown,
      tabIndex: 0,
      role: 'region',
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: isDragging ? ('none' as const) : undefined,
      },
    },
  };
}
