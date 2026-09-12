import { useCallback } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';

// Centralizes the one-time cleanup path for pointer-up and pointer-cancel.
// Keeping this idempotent prevents stale RAF callbacks from restoring old UI.
export const useCanvasDragCleanup = ({
  runtime,
  resetDragCollision,
  cancelDesktopDragVisualUpdate,
  searchDragSeparateRef,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDraggedTaskId,
  setIsGroupDragActive,
  setDragSession,
}) => {
  const {
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragLastMoveRef,
    desktopDragModeRef,
    desktopDragOverlapPendingRef,
    desktopDragOverlapRafRef,
    desktopDragOverlapTimeoutRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
  } = runtime;

  const prepareDesktopDragFinish = useCallback(() => {
    if (!desktopDragModeRef.current || desktopDragStateRef.current.finalized) return null;
    desktopDragStateRef.current = { ...desktopDragStateRef.current, finalized: true };
    resetDragCollision();
    if (desktopDragOverlapRafRef.current !== null) {
      window.cancelAnimationFrame(desktopDragOverlapRafRef.current);
      desktopDragOverlapRafRef.current = null;
    }
    desktopDragOverlapPendingRef.current = null;
    if (desktopDragOverlapTimeoutRef.current !== null) {
      window.clearTimeout(desktopDragOverlapTimeoutRef.current);
      desktopDragOverlapTimeoutRef.current = null;
    }
    cancelDesktopDragVisualUpdate();
    return { clientX: desktopDragPointerRef.current.x, clientY: desktopDragPointerRef.current.y };
  }, [
    cancelDesktopDragVisualUpdate,
    desktopDragModeRef,
    desktopDragOverlapPendingRef,
    desktopDragOverlapRafRef,
    desktopDragOverlapTimeoutRef,
    desktopDragPointerRef,
    desktopDragStateRef,
    resetDragCollision,
  ]);

  const resetDesktopDragAfterFinish = useCallback((pointerTarget, pointerId) => {
    document.body.classList.remove('desktop-task-dragging');
    desktopDragModeRef.current = false;
    desktopDragContainerRectRef.current = null;
    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0, finalized: false };
    desktopDragLastMoveRef.current = null;
    desktopDragSelectionPositionsRef.current = new Map();
    desktopDragPreviewPositionsRef.current = {};
    desktopDragAnchorStartPositionRef.current = null;
    desktopDragAnchorSizeRef.current = { width: DESKTOP_CANVAS_CARD_WIDTH, height: DESKTOP_CANVAS_CARD_HEIGHT };
    desktopDragAnchorPointerOffsetRef.current = null;
    desktopDragSourceRectRef.current = null;
    desktopDragDetachedFromGroupRef.current = false;
    desktopDragIsGroupRef.current = false;
    desktopDragOverlaySnapshotRef.current = null;
    desktopDragSourceEntryIdRef.current = null;
    desktopDragSelectedTaskIdsRef.current = new Set();
    searchDragSeparateRef.current = false;
    setDraggedTaskId(null);
    setIsGroupDragActive(false);
    setDesktopDragOverlayActive(false);
    setDesktopDragOverlaySnapshot(null);
    setDragSession(null);
    if (pointerTarget?.hasPointerCapture?.(pointerId)) {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already have been released.
      }
    }
  }, [
    desktopDragAnchorPointerOffsetRef,
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragLastMoveRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    searchDragSeparateRef,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    setDragSession,
    setDraggedTaskId,
    setIsGroupDragActive,
  ]);

  return { prepareDesktopDragFinish, resetDesktopDragAfterFinish };
};
