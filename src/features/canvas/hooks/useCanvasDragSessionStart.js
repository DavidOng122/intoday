import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';
import {
  getDesktopCanvasEntryHeight,
  getDesktopCanvasTasksFromEntries,
} from '../model/canvasEntries.js';
import { buildCanvasDragStart } from '../model/canvasDragStart.js';
import { createCanvasDragSession } from '../model/canvasDragSession.js';

// Creates one immutable drag-session snapshot before any preview frames run.
// Pointer handling and visual updates remain in the orchestrating hook.
export const useCanvasDragSessionStart = ({
  runtime,
  entriesRef,
  viewport,
  isExternalDragTask,
  closeExternalDragSource,
  getCandidatesCache,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDraggedTaskId,
  setHistoryOpen,
  setIsGroupDragActive,
  setDragSession,
  syncDesktopDraggedTaskPosition,
  scheduleDesktopDragVisualUpdate,
}) => {
  const {
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
  } = runtime;
  const { getCanvasPointFromClient } = viewport;

  return useCallback((task) => {
    setHistoryOpen(false);
    const isExternalDrag = isExternalDragTask?.(task) === true;
    getCandidatesCache();

    const taskId = task.id;
    const sourceRect = desktopDragSourceRectRef.current;
    const sourceCanvasPosition = sourceRect
      ? getCanvasPointFromClient(sourceRect.left, sourceRect.top)
      : null;
    const entries = entriesRef.current;
    const dragStart = buildCanvasDragStart({
      task,
      entries,
      tasks: getDesktopCanvasTasksFromEntries(entries),
      sourceCanvasPosition,
    });
    const {
      anchorEntry,
      anchorPosition,
      isDetachedGroupTask,
      isGroup,
      movingTaskIds,
      originPositions,
      overlaySnapshot,
    } = dragStart;

    desktopDragDetachedFromGroupRef.current = isDetachedGroupTask;
    desktopDragSelectionPositionsRef.current = originPositions;
    desktopDragPreviewPositionsRef.current = Object.fromEntries(originPositions);
    desktopDragAnchorStartPositionRef.current = anchorPosition;
    desktopDragOverlaySnapshotRef.current = overlaySnapshot;

    setDragSession(createCanvasDragSession({
      pointerId: desktopDragStateRef.current.pointerId,
      type: movingTaskIds.length > 1 ? (isGroup ? 'pack' : 'selection') : 'single',
      draggedIds: movingTaskIds,
      startPointer: desktopDragPointerRef.current,
      originPositions,
    }));
    if (isExternalDrag) {
      flushSync(() => {
        setDesktopDragOverlaySnapshot(overlaySnapshot);
        setDesktopDragOverlayActive(true);
      });
      closeExternalDragSource?.();
    } else {
      setDesktopDragOverlaySnapshot(overlaySnapshot);
      setDesktopDragOverlayActive(isDetachedGroupTask);
    }

    desktopDragAnchorSizeRef.current = {
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: anchorEntry ? getDesktopCanvasEntryHeight(anchorEntry) : DESKTOP_CANVAS_CARD_HEIGHT,
    };
    desktopDragModeRef.current = true;
    document.body.classList.add('desktop-task-dragging');

    movingTaskIds.forEach((movingTaskId) => {
      const entryNode = document.getElementById(`desktop-canvas-entry-${movingTaskId}`);
      entryNode?.querySelector('.desktop-canvas-card-shell')?.classList.add('is-dragging');
    });

    setDraggedTaskId(taskId);
    setIsGroupDragActive(!!task.isGroupInitiator);
    syncDesktopDraggedTaskPosition(desktopDragPointerRef.current.x, desktopDragPointerRef.current.y);
    scheduleDesktopDragVisualUpdate(desktopDragPointerRef.current.x, desktopDragPointerRef.current.y, taskId);
  }, [
    closeExternalDragSource,
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    entriesRef,
    getCandidatesCache,
    getCanvasPointFromClient,
    isExternalDragTask,
    scheduleDesktopDragVisualUpdate,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    setDraggedTaskId,
    setHistoryOpen,
    setIsGroupDragActive,
    setDragSession,
    syncDesktopDraggedTaskPosition,
  ]);
};
