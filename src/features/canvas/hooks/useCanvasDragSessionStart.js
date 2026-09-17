import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';
import { getDesktopCanvasEntryHeight } from '../model/canvasEntries.js';
import { buildCanvasDragStart } from '../model/canvasDragStart.js';
import { createCanvasDragSession } from '../model/canvasDragSession.js';

// Creates one immutable drag-session snapshot before any preview frames run.
// Pointer handling and visual updates remain in the orchestrating hook.
export const useCanvasDragSessionStart = ({
  runtime,
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
  tasksRef,
}) => {
  const {
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    selectedDayEntriesRef,
  } = runtime;
  const { getCanvasPointFromClient, viewportContainerRef } = viewport;

  return useCallback((task) => {
    setHistoryOpen(false);
    const isExternalDrag = isExternalDragTask?.(task) === true;
    getCandidatesCache(tasksRef.current);

    const taskId = task.id;
    const sourceRect = desktopDragSourceRectRef.current;
    const sourceCanvasPosition = sourceRect
      ? getCanvasPointFromClient(sourceRect.left, sourceRect.top)
      : null;
    const dragStart = buildCanvasDragStart({
      task,
      entries: selectedDayEntriesRef.current,
      tasks: tasksRef.current,
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

    desktopDragSourceEntryIdRef.current = taskId;
    desktopDragIsGroupRef.current = isGroup;
    desktopDragContainerRectRef.current = viewportContainerRef.current?.getBoundingClientRect?.() || null;
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
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    getCandidatesCache,
    getCanvasPointFromClient,
    isExternalDragTask,
    scheduleDesktopDragVisualUpdate,
    selectedDayEntriesRef,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    setDraggedTaskId,
    setHistoryOpen,
    setIsGroupDragActive,
    setDragSession,
    syncDesktopDraggedTaskPosition,
    tasksRef,
    viewportContainerRef,
  ]);
};
