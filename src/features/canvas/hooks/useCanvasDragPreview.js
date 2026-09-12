import { useCallback } from 'react';
import { getCanvasPreviewPositions } from '../model/canvasDragSession.js';

// Preview state is transient UI only. It deliberately never writes tasks or
// persistence while a pointer is moving.
export const useCanvasDragPreview = ({
  runtime,
  getDragCanvasPointFromClient,
  getDesktopDragAnchorPosition,
  setDragSession,
}) => {
  const {
    desktopDragAnchorStartPositionRef,
    desktopDragModeRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragStateRef,
    desktopDragVisualPendingRef,
    desktopDragVisualRafRef,
  } = runtime;

  const syncDesktopDraggedTaskPosition = useCallback((clientX, clientY) => {
    const currentPoint = getDragCanvasPointFromClient(clientX, clientY);
    const anchorStart = desktopDragAnchorStartPositionRef.current;
    const nextAnchor = currentPoint && getDesktopDragAnchorPosition(currentPoint);
    if (!anchorStart || !nextAnchor) return;

    const movingIds = desktopDragSelectedTaskIdsRef.current.size > 0
      ? [...desktopDragSelectedTaskIdsRef.current]
      : [desktopDragStateRef.current.taskId];
    const originPositions = new Map(movingIds.map((id) => [
      id,
      desktopDragSelectionPositionsRef.current.get(id) || anchorStart,
    ]));
    setDragSession((session) => (session ? {
      ...session,
      previewPositions: getCanvasPreviewPositions({
        draggedIds: movingIds,
        originPositions,
        delta: { x: nextAnchor.x - anchorStart.x, y: nextAnchor.y - anchorStart.y },
      }),
    } : session));
  }, [
    desktopDragAnchorStartPositionRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragStateRef,
    getDesktopDragAnchorPosition,
    getDragCanvasPointFromClient,
    setDragSession,
  ]);

  const flushDesktopDragVisualUpdate = useCallback(() => {
    desktopDragVisualRafRef.current = null;
    const pending = desktopDragVisualPendingRef.current;
    desktopDragVisualPendingRef.current = null;
    if (!pending || !desktopDragModeRef.current || desktopDragStateRef.current.taskId !== pending.taskId) return;
    syncDesktopDraggedTaskPosition(pending.clientX, pending.clientY);
  }, [desktopDragModeRef, desktopDragStateRef, desktopDragVisualPendingRef, desktopDragVisualRafRef, syncDesktopDraggedTaskPosition]);

  const scheduleDesktopDragVisualUpdate = useCallback((clientX, clientY, taskId) => {
    desktopDragVisualPendingRef.current = { clientX, clientY, taskId };
    if (desktopDragVisualRafRef.current === null) {
      desktopDragVisualRafRef.current = window.requestAnimationFrame(flushDesktopDragVisualUpdate);
    }
  }, [desktopDragVisualPendingRef, desktopDragVisualRafRef, flushDesktopDragVisualUpdate]);

  const cancelDesktopDragVisualUpdate = useCallback(() => {
    if (desktopDragVisualRafRef.current !== null) {
      window.cancelAnimationFrame(desktopDragVisualRafRef.current);
      desktopDragVisualRafRef.current = null;
    }
    desktopDragVisualPendingRef.current = null;
  }, [desktopDragVisualPendingRef, desktopDragVisualRafRef]);

  return {
    cancelDesktopDragVisualUpdate,
    scheduleDesktopDragVisualUpdate,
    syncDesktopDraggedTaskPosition,
  };
};
