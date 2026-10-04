import { useCallback, useRef } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from '../model/canvasConstants.js';
import { getCanvasEntryIdentity } from '../model/canvasEntryIdentity.js';
import { getDesktopCanvasEntryHeight, getDesktopCanvasTasksFromEntries } from '../model/canvasEntries.js';
import { getCanvasDragTaskIds, getCanvasPreviewPositions } from '../model/canvasDragSession.js';
import { useCanvasDragCollision } from './useCanvasDragCollision.js';
import { useCanvasDragPreview } from './useCanvasDragPreview.js';
import { useExternalCanvasDrop } from './useExternalCanvasDrop.js';
import { useCanvasPointerDrag } from './useCanvasPointerDrag.js';
import { useCanvasDragCleanup } from './useCanvasDragCleanup.js';
import { useCanvasDragSessionStart } from './useCanvasDragSessionStart.js';

export const useDesktopTaskDrag = ({ canvas, application, bridges }) => {
  const {
    runtime,
    entriesRef,
    viewport,
    presentation,
  } = canvas;
  const {
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragDetachedFromGroupRef,
    desktopDragModeRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragStateRef,
    desktopDragOverlapTargetIdRef,
    suppressAllTaskClicksUntilRef,
    suppressTaskClickRef,
    suppressTaskClickTimeoutRef,
  } = runtime;
  const {
    canvasBoundsRef,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
  } = viewport;
  const {
    setDesktopDragOverlapTargetId,
    setDesktopDragOverlayActive,
    setDesktopDragOverlaySnapshot,
    setDraggedTaskId,
    setIsGroupDragActive,
    setDragSession,
  } = presentation;
  const { onCommitInternalDrop } = application;
  const activeFlowDragRef = useRef(null);
  const {
    search,
    externalSource,
  } = bridges;
  const {
    searchDragSeparateRef,
    setHistoryOpen,
  } = search;
  const {
    cancelExternalCanvasDrop,
    closeExternalDragSource,
    finishExternalCanvasDrop,
    isExternalDragTask,
  } = useExternalCanvasDrop({ externalSource, canvasBoundsRef, entriesRef });
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
  getDesktopDragAnchorPosition,
  isExternalDragTask,
  setDesktopDragOverlapTargetId,
  entriesRef,
});

const {
  cancelDesktopDragVisualUpdate,
  scheduleDesktopDragVisualUpdate,
  syncDesktopDraggedTaskPosition,
} = useCanvasDragPreview({
  runtime,
  getCanvasPointFromClient,
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
  entriesRef,
  viewport: { getCanvasPointFromClient },
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
});

const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId, wasCancelled = false) => {
  // Persist the exact last preview position. This avoids a tall Pack jumping
  // back when pointer-up arrives before the scheduled preview frame.
  syncDesktopDraggedTaskPosition(desktopDragPointerRef.current.x, desktopDragPointerRef.current.y);
  const finalPointer = prepareDesktopDragFinish();
  if (!finalPointer) return;

  if (desktopDragModeRef.current) {
    suppressNextTaskClick(task.id);

    const currentPt = getCanvasPointFromClient(
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
        onCommitInternalDrop({
          task,
          rawNextPosition,
          getDesktopCanvasOverlapEntryFromDom,
        });
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
  getCanvasPointFromClient,
  isExternalDragTask,
  cancelExternalCanvasDrop,
  finishExternalCanvasDrop,
  prepareDesktopDragFinish,
  resetDesktopDragAfterFinish,
  getDesktopCanvasOverlapEntryFromDom,
  onCommitInternalDrop,
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
  startDesktopTaskDrag,
  onDragMove,
  finishDesktopTaskDrag,
});

const getFlowDragTask = useCallback((node) => {
  const entry = node?.data?.entry;
  if (entry?.type === 'group') {
    return {
      ...entry.task,
      groupTaskIds: entry.tasks.map((task) => task.id),
      isGroupInitiator: true,
    };
  }
  return entry?.type === 'task' ? entry.task : null;
}, []);

const handleFlowNodeDragStart = useCallback((event, node) => {
  const task = getFlowDragTask(node);
  const entry = node?.data?.entry;
  if (!task || !entry) return;

  const movingTaskIds = getCanvasDragTaskIds(task);
  const origin = { x: entry.x, y: entry.y };
  const originPositions = new Map(movingTaskIds.map((taskId) => [taskId, origin]));
  const isGroup = entry.type === 'group';
  activeFlowDragRef.current = { nodeId: node.id, task, movingTaskIds, origin };
  desktopDragAnchorStartPositionRef.current = origin;
  desktopDragAnchorSizeRef.current = {
    width: node.measured?.width || DESKTOP_CANVAS_CARD_WIDTH,
    height: node.measured?.height || getDesktopCanvasEntryHeight(entry),
  };
  desktopDragSelectionPositionsRef.current = originPositions;
  desktopDragSelectedTaskIdsRef.current = new Set(movingTaskIds);
  desktopDragPreviewPositionsRef.current = Object.fromEntries(originPositions);
  desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
  desktopDragStateRef.current = {
    pointerId: null,
    taskId: task.id,
    startX: event.clientX,
    startY: event.clientY,
    finalized: false,
  };
  desktopDragDetachedFromGroupRef.current = false;
  desktopDragModeRef.current = false;
  searchDragSeparateRef.current = false;
  resetDragCollision();
  getCandidatesCache();
  setHistoryOpen(false);
  setDraggedTaskId(task.id);
  setIsGroupDragActive(isGroup);
  setDesktopDragOverlayActive(false);
  setDesktopDragOverlaySnapshot(null);
  setDragSession(null);
  document.body.classList.add('desktop-task-dragging');
}, [
  desktopDragAnchorSizeRef,
  desktopDragAnchorStartPositionRef,
  desktopDragDetachedFromGroupRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragPreviewPositionsRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragSelectionPositionsRef,
  desktopDragStateRef,
  getCandidatesCache,
  getFlowDragTask,
  resetDragCollision,
  searchDragSeparateRef,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDragSession,
  setDraggedTaskId,
  setHistoryOpen,
  setIsGroupDragActive,
]);

const updateFlowNodeDrag = useCallback((event, node) => {
  const activeDrag = activeFlowDragRef.current;
  if (!activeDrag || activeDrag.nodeId !== node?.id) return;

  desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
  const delta = {
    x: node.position.x - activeDrag.origin.x,
    y: node.position.y - activeDrag.origin.y,
  };
  desktopDragPreviewPositionsRef.current = getCanvasPreviewPositions({
    draggedIds: activeDrag.movingTaskIds,
    originPositions: desktopDragSelectionPositionsRef.current,
    delta,
  });

  const overlapResult = getDesktopCanvasOverlapEntryFromDom(
    getDesktopCanvasTasksFromEntries(entriesRef.current),
    new Set(activeDrag.movingTaskIds),
    activeDrag.task.id,
    node.position,
    DESKTOP_GROUP_OVERLAP_THRESHOLD,
    true,
  );
  const targetId = overlapResult?.entry
    ? getCanvasEntryIdentity(overlapResult.entry)
    : null;
  if (targetId === desktopDragOverlapTargetIdRef.current) return;
  desktopDragOverlapTargetIdRef.current = targetId;
  setDesktopDragOverlapTargetId(targetId);
}, [
  desktopDragOverlapTargetIdRef,
  desktopDragPointerRef,
  desktopDragPreviewPositionsRef,
  desktopDragSelectionPositionsRef,
  entriesRef,
  getDesktopCanvasOverlapEntryFromDom,
  setDesktopDragOverlapTargetId,
]);

const handleFlowNodeDrag = useCallback((event, node) => {
  updateFlowNodeDrag(event, node);
}, [updateFlowNodeDrag]);

const handleFlowNodeDragStop = useCallback((event, node) => {
  const activeDrag = activeFlowDragRef.current;
  if (!activeDrag || activeDrag.nodeId !== node?.id) return;

  updateFlowNodeDrag(event, node);
  suppressNextTaskClick(activeDrag.task.id);
  try {
    onCommitInternalDrop({
      task: activeDrag.task,
      rawNextPosition: node.position,
      getDesktopCanvasOverlapEntryFromDom,
    });
  } finally {
    activeFlowDragRef.current = null;
    document.body.classList.remove('desktop-task-dragging');
    desktopDragAnchorStartPositionRef.current = null;
    desktopDragPreviewPositionsRef.current = {};
    desktopDragAnchorSizeRef.current = {
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: DESKTOP_CANVAS_CARD_HEIGHT,
    };
    desktopDragSelectedTaskIdsRef.current = new Set();
    desktopDragSelectionPositionsRef.current = new Map();
    desktopDragDetachedFromGroupRef.current = false;
    desktopDragStateRef.current = {
      pointerId: null,
      taskId: null,
      startX: 0,
      startY: 0,
      finalized: false,
    };
    resetDragCollision();
    setDraggedTaskId(null);
    setIsGroupDragActive(false);
    setDesktopDragOverlayActive(false);
    setDesktopDragOverlaySnapshot(null);
    setDragSession(null);
  }
}, [
  desktopDragAnchorStartPositionRef,
  desktopDragAnchorSizeRef,
  desktopDragDetachedFromGroupRef,
  desktopDragPreviewPositionsRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragSelectionPositionsRef,
  desktopDragStateRef,
  getDesktopCanvasOverlapEntryFromDom,
  onCommitInternalDrop,
  resetDragCollision,
  setDesktopDragOverlayActive,
  setDesktopDragOverlaySnapshot,
  setDragSession,
  setDraggedTaskId,
  setIsGroupDragActive,
  suppressNextTaskClick,
  updateFlowNodeDrag,
]);

  return {
    startDesktopTaskDrag,
    syncDesktopDraggedTaskPosition,
    handleTaskPointerDown,
    handleTaskPointerMove,
    handleTaskPointerUp,
    handleTaskPointerCancel,
    handleFlowNodeDragStart,
    handleFlowNodeDrag,
    handleFlowNodeDragStop,
  };
};
