import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const useCanvasDragPresentation = ({
  desktopDragDetachedFromGroupRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  selectedDateKey,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragSession, setDragSession] = useState(null);
  const [isGroupDragActive, setIsGroupDragActive] = useState(false);
  const [desktopDragOverlapTargetId, setDesktopDragOverlapTargetId] = useState(null);
  const [desktopDragOverlayActive, setDesktopDragOverlayActive] = useState(false);
  const [desktopDragOverlaySnapshot, setDesktopDragOverlaySnapshot] = useState(null);
  const dragPresentationApiRef = useRef({ syncDesktopDraggedTaskPosition: null });

  const connectDragPresentation = useCallback((api) => {
    dragPresentationApiRef.current = api || { syncDesktopDraggedTaskPosition: null };
  }, []);

  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) {
      if (desktopDragOverlayActive) {
        // Preserve the existing visual reset timing when a drag ends.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDesktopDragOverlayActive(false);
      }
      return;
    }

    const shouldOverlay = (
      desktopDragOverlayActive
      || desktopDragDetachedFromGroupRef.current
    );
    if (!desktopDragOverlayActive && shouldOverlay) {
      setDesktopDragOverlayActive(true);
    }
  }, [
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragOverlayActive,
    draggedTaskId,
  ]);

  useLayoutEffect(() => {
    if (!desktopDragOverlayActive || !desktopDragOverlaySnapshot) return;
    const { syncDesktopDraggedTaskPosition } = dragPresentationApiRef.current;
    if (typeof syncDesktopDraggedTaskPosition !== 'function') return;
    syncDesktopDraggedTaskPosition(
      desktopDragPointerRef.current.x,
      desktopDragPointerRef.current.y,
    );
  }, [
    desktopDragOverlayActive,
    desktopDragOverlaySnapshot,
    desktopDragPointerRef,
  ]);

  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const { syncDesktopDraggedTaskPosition } = dragPresentationApiRef.current;
      if (typeof syncDesktopDraggedTaskPosition !== 'function') return;
      syncDesktopDraggedTaskPosition(
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    desktopDragModeRef,
    desktopDragPointerRef,
    draggedTaskId,
    selectedDateKey,
  ]);

  return {
    draggedTaskId,
    dragSession,
    isGroupDragActive,
    desktopDragOverlapTargetId,
    desktopDragOverlayActive,
    desktopDragOverlaySnapshot,
    setDraggedTaskId,
    setDragSession,
    setIsGroupDragActive,
    setDesktopDragOverlapTargetId,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    connectDragPresentation,
  };
};
