import { useCallback } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
} from '../model/canvasConstants.js';
import { useCanvasDragCollision } from './useCanvasDragCollision.js';
import { useCanvasDragPreview } from './useCanvasDragPreview.js';
import { useExternalCanvasDrop } from './useExternalCanvasDrop.js';
import { useCanvasPointerDrag } from './useCanvasPointerDrag.js';
import { useCanvasDragCleanup } from './useCanvasDragCleanup.js';
import { useCanvasDragSessionStart } from './useCanvasDragSessionStart.js';
import { useCanvasTaskDrop } from './useCanvasTaskDrop.js';

export const useDesktopTaskDrag = ({ runtime, viewport, canvas, externalSource }) => {
  const {
    desktopDragAnchorSizeRef,
    desktopDragModeRef,
    desktopDragPointerRef,
    desktopDragSourceEntryIdRef,
    selectedDayEntriesRef,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    suppressTaskClickTimeoutRef,
  } = runtime;
  const {
    canvasBoundsRef,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    getDragCanvasPointFromClient,
    viewportContainerRef,
  } = viewport;
  const {
  cleanupDesktopGroupMetadata,
  searchDragSeparateRef,
  selectedDateRef,
  setDesktopDragOverlapTargetId,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDesktopSelectionRect,
  setDraggedTaskId,
  setHistoryOpen,
  setIsGroupDragActive,
  setDragSession,
  setPendingGroupName,
  setPendingGroupPrompt,
  setTasks,
  tasksRef,
  } = canvas;
  const {
    cancelExternalCanvasDrop,
    closeExternalDragSource,
    finishExternalCanvasDrop,
    isExternalDragTask,
  } = useExternalCanvasDrop({ externalSource, canvasBoundsRef, selectedDayEntriesRef });
const suppressNextTaskClick = useCallback((taskId) => {
  if (suppressTaskClickTimeoutRef.current !== null) {
    window.clearTimeout(suppressTaskClickTimeoutRef.current);
  }
  suppressAllTaskClicksUntilRef.current = Date.now() + 350;
  suppressTaskClickRef.current = taskId;
  suppressTaskClickTimeoutRef.current = window.setTimeout(() => {
    if (suppressTaskClickRef.current === taskId) {
      suppressTaskClickRef.current = null;
    }
    suppressTaskClickTimeoutRef.current = null;
  }, 250);
}, [suppressAllTaskClicksUntilRef, suppressTaskClickRef, suppressTaskClickTimeoutRef]);

const {
  getCandidatesCache,
  getDesktopCanvasOverlapEntryFromDom,
  resetDragCollision,
  scheduleDesktopDragOverlapUpdate,
} = useCanvasDragCollision({
  runtime,
  getCanvasPointFromClient,
  getDragCanvasPointFromClient,
  getDesktopDragAnchorPosition,
  isExternalDragTask,
  setDesktopDragOverlapTargetId,
  tasksRef,
});

const setDesktopDragSourceHidden = useCallback((hidden) => {
  const sourceId = desktopDragSourceEntryIdRef.current;
  if (!sourceId) return;
  const node = document.getElementById(`desktop-canvas-entry-${sourceId}`);
  if (!node) return;
  if (hidden) {
    node.classList.add('desktop-drag-source-hidden');
  } else {
    node.classList.remove('desktop-drag-source-hidden');
  }
}, [desktopDragSourceEntryIdRef]);

const {
  cancelDesktopDragVisualUpdate,
  scheduleDesktopDragVisualUpdate,
  syncDesktopDraggedTaskPosition,
} = useCanvasDragPreview({
  runtime,
  getDragCanvasPointFromClient,
  getDesktopDragAnchorPosition,
  setDragSession,
});

const { prepareDesktopDragFinish, resetDesktopDragAfterFinish } = useCanvasDragCleanup({
  runtime,
  resetDragCollision,
  cancelDesktopDragVisualUpdate,
  searchDragSeparateRef,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDraggedTaskId,
  setIsGroupDragActive,
  setDragSession,
});

const startDesktopTaskDrag = useCanvasDragSessionStart({
  runtime,
  viewport: { getCanvasPointFromClient, viewportContainerRef },
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
});

const finishCanvasTaskDrop = useCanvasTaskDrop({
  runtime,
  canvas: {
    cleanupDesktopGroupMetadata,
    searchDragSeparateRef,
    selectedDateRef,
    setPendingGroupName,
    setPendingGroupPrompt,
    setTasks,
  },
  canvasBoundsRef,
  getDesktopCanvasOverlapEntryFromDom,
});

const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId, wasCancelled = false) => {
  // Persist the exact last preview position. This avoids a tall Pack jumping
  // back when pointer-up arrives before the scheduled preview frame.
  syncDesktopDraggedTaskPosition(desktopDragPointerRef.current.x, desktopDragPointerRef.current.y);
  const finalPointer = prepareDesktopDragFinish();
  if (!finalPointer) return;
  setDesktopDragSourceHidden(false);

  if (desktopDragModeRef.current) {
    suppressNextTaskClick(task.id);

    const currentPt = getDragCanvasPointFromClient(
      finalPointer.clientX,
      finalPointer.clientY,
    );

    if (currentPt) {
      const rawNextPosition = getDesktopDragAnchorPosition(currentPt);
      if (!rawNextPosition) {
        if (isExternalDragTask?.(task) === true) cancelExternalCanvasDrop?.();
        desktopDragModeRef.current = false;
        return;
      }
      const movingHeight = desktopDragAnchorSizeRef.current?.height || DESKTOP_CANVAS_CARD_HEIGHT;

      if (isExternalDragTask?.(task) === true) {
        finishExternalCanvasDrop({
          task,
          wasCancelled,
          position: rawNextPosition,
          pointerPosition: currentPt,
          height: movingHeight,
        });
      } else {
        finishCanvasTaskDrop({ task, rawNextPosition });
      }
    } else if (isExternalDragTask?.(task) === true) {
      cancelExternalCanvasDrop?.();
    }
  }

  resetDesktopDragAfterFinish(pointerTarget, pointerId);
}, [
  desktopDragAnchorSizeRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  getDesktopDragAnchorPosition,
  getDragCanvasPointFromClient,
  isExternalDragTask,
  cancelExternalCanvasDrop,
  finishExternalCanvasDrop,
  prepareDesktopDragFinish,
  resetDesktopDragAfterFinish,
  setDesktopDragSourceHidden,
  finishCanvasTaskDrop,
  suppressNextTaskClick,
  syncDesktopDraggedTaskPosition,
]);


const onDragMove = useCallback((task, clientX, clientY) => {
  scheduleDesktopDragVisualUpdate(clientX, clientY, task.id);
  scheduleDesktopDragOverlapUpdate(clientX, clientY, task.id);
}, [scheduleDesktopDragOverlapUpdate, scheduleDesktopDragVisualUpdate]);

const {
  handleTaskPointerDown,
  handleTaskPointerMove,
  handleTaskPointerUp,
  handleTaskPointerCancel,
} = useCanvasPointerDrag({
  runtime,
  getCanvasPointFromClient,
  setDesktopSelectionRect,
  startDesktopTaskDrag,
  onDragMove,
  finishDesktopTaskDrag,
});

  return {
    startDesktopTaskDrag,
    setDesktopDragSourceHidden,
    syncDesktopDraggedTaskPosition,
    handleTaskPointerDown,
    handleTaskPointerMove,
    handleTaskPointerUp,
    handleTaskPointerCancel,
  };
};
