import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from '../model/canvasConstants.js';
import {
  getDesktopCanvasEntryHeight,
} from '../model/canvasEntries.js';
import { useCanvasDragCollision } from './useCanvasDragCollision.js';
import { useCanvasDragPreview } from './useCanvasDragPreview.js';
import { useExternalCanvasDrop } from './useExternalCanvasDrop.js';
import { useCanvasPointerDrag } from './useCanvasPointerDrag.js';
import { useCanvasDragCleanup } from './useCanvasDragCleanup.js';
import { buildCanvasDragStart } from '../model/canvasDragStart.js';
import { getClampedCanvasDragPosition } from '../model/canvasDragPosition.js';
import { dateKey } from '../../../lib/dateUtils.js';
import { reduceCanvasDrop } from '../model/canvasDrop.js';
import { decideCanvasDrop } from '../model/canvasDropDecision.js';
import { createCanvasDragSession } from '../model/canvasDragSession.js';

export const useDesktopTaskDrag = ({ runtime, viewport, canvas, externalSource }) => {
  const {
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragContainerRectRef,
    desktopDragDetachedFromGroupRef,
    desktopDragIsGroupRef,
    desktopDragModeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
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

const startDesktopTaskDrag = useCallback((task) => {
  setHistoryOpen(false); // Ensure modal closes when drag starts
  const isExternalDrag = isExternalDragTask?.(task) === true;

  // Pre-build candidate rect cache in clean untransformed state before drag transforms begin
  getCandidatesCache(tasksRef.current);

  const taskId = task.id;
  const sourceRect = desktopDragSourceRectRef.current;
  const sourceCanvasPosition = sourceRect
    ? getCanvasPointFromClient(sourceRect.left, sourceRect.top)
    : null;
  const dragStart = buildCanvasDragStart({
    task,
    selectedTaskIds: desktopDragSelectedTaskIdsRef.current,
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
  desktopDragAnchorStartPositionRef.current = anchorPosition;

  desktopDragOverlaySnapshotRef.current = overlaySnapshot;
  setDragSession(createCanvasDragSession({
    pointerId: desktopDragStateRef.current.pointerId,
    type: movingTaskIds.length > 1 ? (desktopDragIsGroupRef.current ? 'pack' : 'selection') : 'single',
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
    // Mark the canvas-card-shell (direct child of the canvas entry node) for the lift CSS
    const entryNode = document.getElementById(`desktop-canvas-entry-${movingTaskId}`);
    const shell = entryNode?.querySelector('.desktop-canvas-card-shell');
    if (shell) shell.classList.add('is-dragging');
  });

  setDraggedTaskId(taskId);
  setIsGroupDragActive(!!task.isGroupInitiator);

  // Center-locked snap: force a visual sync immediately when drag mode begins.
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
  desktopDragSelectedTaskIdsRef,
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

const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId, wasCancelled = false) => {
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
      const anchorStart = desktopDragAnchorStartPositionRef.current || { x: 0, y: 0 };
      const startPositions = [...desktopDragSelectionPositionsRef.current.values()];
      const { position: nextPosition, delta: { x: deltaX, y: deltaY } } = getClampedCanvasDragPosition({
        rawPosition: rawNextPosition,
        anchorPosition: anchorStart,
        originPositions: startPositions,
        canvasBounds: canvasBoundsRef.current,
        height: movingHeight,
      });

        flushSync(() => {
          setTasks((prev) => {
          const isGroupDrag = !!task.isGroupInitiator;
          const movingTaskIds = new Set(
            desktopDragSelectedTaskIdsRef.current.size > 0
              ? [...desktopDragSelectedTaskIdsRef.current]
              : (isGroupDrag ? task.groupTaskIds : [task.id]),
          );
          const activeDateKey = selectedDateRef.current ? dateKey(selectedDateRef.current) : task.dateString;
          const domOverlapResult = searchDragSeparateRef.current
            ? null
            : getDesktopCanvasOverlapEntryFromDom(
              prev,
              movingTaskIds,
              task.id,
              nextPosition,
              DESKTOP_GROUP_OVERLAP_THRESHOLD,
              true,
            );
          // The DOM candidates describe what is actually on screen at drop
          // time. Do not fall back to persisted coordinates: those may still
          // describe the source Pack and create a false merge prompt.
          const overlapEntry = domOverlapResult?.entry;
          const isMultiDrag = desktopDragSelectedTaskIdsRef.current.size > 1;
          const isDetachedGroupTask = desktopDragDetachedFromGroupRef.current && !isMultiDrag && movingTaskIds.size === 1;
          const timestamp = Date.now();
          const decision = decideCanvasDrop({
            tasks: prev,
            movingTaskIds,
            originPositions: Object.fromEntries(desktopDragSelectionPositionsRef.current),
            anchorPosition: anchorStart,
            nextPosition,
            delta: { x: deltaX, y: deltaY },
            activeDateKey,
            timestamp,
            isGroupDrag,
            isDetachedGroupTask,
            overlapEntry,
          });
          if (!decision.prompt) {
            setPendingGroupPrompt(null);
            return cleanupDesktopGroupMetadata(reduceCanvasDrop(prev, decision.drop));
          }
          setPendingGroupPrompt({
            ...decision.prompt,
            anchorX: desktopDragPointerRef.current.x,
            anchorY: desktopDragPointerRef.current.y,
          });
          setPendingGroupName(decision.suggestedGroupName);
          return cleanupDesktopGroupMetadata(reduceCanvasDrop(prev, decision.drop.move));
          });
        });
      }
    } else if (isExternalDragTask?.(task) === true) {
      cancelExternalCanvasDrop?.();
    }
  }

  resetDesktopDragAfterFinish(pointerTarget, pointerId);
}, [
  canvasBoundsRef,
  cleanupDesktopGroupMetadata,
  desktopDragAnchorSizeRef,
  desktopDragAnchorStartPositionRef,
  desktopDragDetachedFromGroupRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragSelectionPositionsRef,
  getDesktopCanvasOverlapEntryFromDom,
  getDesktopDragAnchorPosition,
  getDragCanvasPointFromClient,
  isExternalDragTask,
  cancelExternalCanvasDrop,
  finishExternalCanvasDrop,
  prepareDesktopDragFinish,
  resetDesktopDragAfterFinish,
  searchDragSeparateRef,
  selectedDateRef,
  setDesktopDragSourceHidden,
  setPendingGroupName,
  setPendingGroupPrompt,
  setTasks,
  suppressNextTaskClick,
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
