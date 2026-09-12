import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_DRAG_START_DISTANCE,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from '../model/canvasConstants.js';
import {
  getDesktopCanvasEntryHeight,
  getDesktopCanvasOverlapEntry,
} from '../model/canvasEntries.js';
import { useCanvasDragCollision } from './useCanvasDragCollision.js';
import { useCanvasDragPreview } from './useCanvasDragPreview.js';
import { useExternalCanvasDrop } from './useExternalCanvasDrop.js';
import { buildCanvasDragStart } from '../model/canvasDragStart.js';
import { getClampedCanvasDragPosition } from '../model/canvasDragPosition.js';
import { dateKey } from '../../../lib/dateUtils.js';
import { reduceCanvasDrop } from '../model/canvasDrop.js';
import { decideCanvasDrop } from '../model/canvasDropDecision.js';
import { createCanvasDragSession, getCanvasDragTaskIds } from '../model/canvasDragSession.js';

export const useDesktopTaskDrag = ({ runtime, viewport, canvas, externalSource }) => {
  const {
    activePointerTaskRef,
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
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    desktopSelectionStateRef,
    selectedDayEntriesRef,
    selectedTaskIdsRef,
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

const resetDesktopDragState = useCallback(() => {
  resetDragCollision();
}, [resetDragCollision]);

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
  if (!desktopDragModeRef.current || desktopDragStateRef.current.finalized) return;
  desktopDragStateRef.current = { ...desktopDragStateRef.current, finalized: true };
  resetDesktopDragState();
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
  const finalPointer = {
    clientX: desktopDragPointerRef.current.x,
    clientY: desktopDragPointerRef.current.y,
  };
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
          const geometryOverlapResult = searchDragSeparateRef.current
            ? null
            : getDesktopCanvasOverlapEntry(prev, movingTaskIds, nextPosition);
          const overlapResult = domOverlapResult || geometryOverlapResult;
          const overlapEntry = overlapResult?.entry;
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

  // Reset live transform and class on every dragged canvas entry node without CSS transition jump
  document.body.classList.remove('desktop-task-dragging');

  desktopDragModeRef.current = false;
  desktopDragContainerRectRef.current = null;
  desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
  desktopDragLastMoveRef.current = null;
  desktopDragSelectionPositionsRef.current = new Map();
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
      // Pointer capture may already be released.
    }
  }
}, [
  canvasBoundsRef,
  cleanupDesktopGroupMetadata,
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
  desktopDragSelectedTaskIdsRef,
  desktopDragSelectionPositionsRef,
  desktopDragSourceEntryIdRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  cancelDesktopDragVisualUpdate,
  getDesktopCanvasOverlapEntryFromDom,
  getDesktopDragAnchorPosition,
  getDragCanvasPointFromClient,
  isExternalDragTask,
  cancelExternalCanvasDrop,
  finishExternalCanvasDrop,
  resetDesktopDragState,
  searchDragSeparateRef,
  selectedDateRef,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDesktopDragSourceHidden,
  setDraggedTaskId,
  setIsGroupDragActive,
  setDragSession,
  setPendingGroupName,
  setPendingGroupPrompt,
  setTasks,
  suppressNextTaskClick,
]);


const handleTaskPointerDown = useCallback((task, event) => {
  if (!event.isPrimary || event.button !== 0) return;
  desktopDragLastMoveRef.current = null;

  const taskSelectionIds = getCanvasDragTaskIds(task);
  const isWithinCurrentSelection = taskSelectionIds.some((taskId) => selectedTaskIdsRef.current.has(taskId));
  const dragTaskIds = task.isGroupInitiator
    ? taskSelectionIds
    : isWithinCurrentSelection && selectedTaskIdsRef.current.size > 0
      ? [...selectedTaskIdsRef.current]
      : taskSelectionIds;

  desktopDragSelectedTaskIdsRef.current = new Set(dragTaskIds);
  setDesktopSelectionRect(null);
  desktopSelectionStateRef.current = { pointerId: null, origin: null };
  activePointerTaskRef.current = task;
  desktopDragModeRef.current = false;
  desktopDragStateRef.current = {
    pointerId: event.pointerId,
    taskId: task.id,
    startX: event.clientX,
    startY: event.clientY,
    finalized: false,
  };
  desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof HTMLElement) {
    const isDetachedGroupTask = !!task.desktopGroupId && !task.isGroupInitiator;
    const sourceNode = isDetachedGroupTask
      ? event.currentTarget.closest('.desktop-task-wrapper') || event.currentTarget
      : event.currentTarget.closest('.desktop-canvas-card-node') || event.currentTarget.closest('.desktop-task-wrapper') || event.currentTarget;
    const rect = sourceNode.getBoundingClientRect();
    const sourceCanvasPoint = getCanvasPointFromClient(rect.left, rect.top);
    const pointerCanvasPoint = getCanvasPointFromClient(event.clientX, event.clientY);
    desktopDragSourceRectRef.current = rect;
    desktopDragAnchorPointerOffsetRef.current = sourceCanvasPoint && pointerCanvasPoint
      ? {
        x: pointerCanvasPoint.x - sourceCanvasPoint.x,
        y: pointerCanvasPoint.y - sourceCanvasPoint.y,
      }
      : null;
  } else {
    desktopDragSourceRectRef.current = null;
    desktopDragAnchorPointerOffsetRef.current = null;
  }
  desktopDragDetachedFromGroupRef.current = false;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}, [
  activePointerTaskRef,
  desktopDragAnchorPointerOffsetRef,
  desktopDragDetachedFromGroupRef,
  desktopDragLastMoveRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  desktopSelectionStateRef,
  getCanvasPointFromClient,
  selectedTaskIdsRef,
  setDesktopSelectionRect,
]);

const processDesktopDragMove = useCallback((task, clientX, clientY, nativeEvent = null) => {
  const eventStamp = nativeEvent?.timeStamp ?? null;
  const previousMove = desktopDragLastMoveRef.current;
  if (
    previousMove
    && previousMove.eventStamp === eventStamp
    && previousMove.clientX === clientX
    && previousMove.clientY === clientY
  ) return;
  desktopDragLastMoveRef.current = { eventStamp, clientX, clientY };
  desktopDragPointerRef.current = { x: clientX, y: clientY };
  const deltaX = clientX - desktopDragStateRef.current.startX;
  const deltaY = clientY - desktopDragStateRef.current.startY;

  if (!desktopDragModeRef.current) {
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= DESKTOP_DRAG_START_DISTANCE) {
      startDesktopTaskDrag(task);
    } else {
      return;
    }
  }

  if (nativeEvent?.cancelable) {
    nativeEvent.preventDefault();
  }
  scheduleDesktopDragVisualUpdate(clientX, clientY, task.id);
  scheduleDesktopDragOverlapUpdate(clientX, clientY, task.id);
}, [
  desktopDragLastMoveRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragStateRef,
  scheduleDesktopDragOverlapUpdate,
  scheduleDesktopDragVisualUpdate,
  startDesktopTaskDrag,
]);

const handleTaskPointerMove = useCallback((task, event) => {
  if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
  processDesktopDragMove(task, event.clientX, event.clientY, event);
}, [desktopDragStateRef, processDesktopDragMove]);

const handleTaskPointerUp = useCallback((task, event) => {
  if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
  if (desktopDragModeRef.current) {
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    finishDesktopTaskDrag(task, event.currentTarget, event.pointerId);
    activePointerTaskRef.current = null;
    return;
  }

  desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0, finalized: false };
  desktopDragLastMoveRef.current = null;
  activePointerTaskRef.current = null;
  desktopDragAnchorPointerOffsetRef.current = null;
  desktopDragSourceRectRef.current = null;
  desktopDragDetachedFromGroupRef.current = false;
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }
}, [
  activePointerTaskRef,
  desktopDragAnchorPointerOffsetRef,
  desktopDragDetachedFromGroupRef,
  desktopDragLastMoveRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  finishDesktopTaskDrag,
]);

const handleTaskPointerCancel = useCallback((task, event) => {
  if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
  if (desktopDragModeRef.current) {
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    finishDesktopTaskDrag(task, event.currentTarget, event.pointerId, true);
    activePointerTaskRef.current = null;
    return;
  }

  desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0, finalized: false };
  activePointerTaskRef.current = null;
  desktopDragAnchorPointerOffsetRef.current = null;
  desktopDragSourceRectRef.current = null;
  desktopDragDetachedFromGroupRef.current = false;
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }
}, [
  activePointerTaskRef,
  desktopDragAnchorPointerOffsetRef,
  desktopDragDetachedFromGroupRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  finishDesktopTaskDrag,
]);

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
