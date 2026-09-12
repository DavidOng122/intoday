import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_DRAG_START_DISTANCE,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from '../model/canvasConstants.js';
import {
  getDesktopCanvasEntryHeight,
  getDesktopCanvasEntryTaskIds,
  getDesktopCanvasResolvedPosition,
  getDesktopCanvasOverlapEntry,
} from '../model/canvasEntries.js';
import { resolveInboxCanvasDrop } from '../model/inboxCanvasDrop.js';
import { useCanvasDragCollision } from './useCanvasDragCollision.js';
import { useCanvasDragPreview } from './useCanvasDragPreview.js';
import { getPackDisplayName } from '../../../entities/pack/model/packSelectors.js';
import { getSuggestedDesktopGroupName } from '../../pack/model/groupMetadata.js';
import {
  isDroppingBackIntoOriginalPack,
  shouldPromptForGroupDrop,
  shouldPromptForPackMerge,
} from '../../pack/model/packMergePolicy.js';
import { dateKey } from '../../../lib/dateUtils.js';
import { calculateCanvasDrop, reduceCanvasDrop } from '../model/canvasDrop.js';
import { createCanvasDragSession, getCanvasDragTaskIds } from '../model/canvasDragSession.js';

const clampDesktopCanvasPosition = (position, bounds, height = DESKTOP_CANVAS_CARD_HEIGHT) => ({
  x: Math.min(
    Math.max(0, (bounds?.width || DESKTOP_MAIN_CONTENT_MAX_WIDTH) - DESKTOP_CANVAS_CARD_WIDTH),
    Math.max(0, position.x),
  ),
  y: Math.min(
    Math.max(0, (bounds?.height || DESKTOP_CANVAS_CARD_HEIGHT) - height),
    Math.max(0, position.y),
  ),
});
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
    isTask: isExternalDragTask,
    onCancel: onExternalDropCancelled,
    onDrop: onExternalDrop,
    onDropFailure: onExternalDropFailure,
    onOverlayReady: closeExternalDragSource,
  } = externalSource;
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
  desktopDragSourceEntryIdRef.current = taskId;
  desktopDragIsGroupRef.current = !!task.isGroupInitiator;
  desktopDragContainerRectRef.current = viewportContainerRef.current?.getBoundingClientRect?.() || null;
  const movingTaskIds = desktopDragSelectedTaskIdsRef.current.size > 0
    ? [...desktopDragSelectedTaskIdsRef.current]
    : getCanvasDragTaskIds(task);
  const isDetachedGroupTask = !desktopDragIsGroupRef.current && !!task.desktopGroupId && movingTaskIds.length === 1;
  desktopDragDetachedFromGroupRef.current = isDetachedGroupTask;

  // Record original canvas positions of all moving tasks for multi-drag delta math
  const entryPositionMap = new Map();
  selectedDayEntriesRef.current.forEach((entry) => {
    const taskIds = getDesktopCanvasEntryTaskIds(entry);
    taskIds.forEach((entryTaskId) => {
      entryPositionMap.set(entryTaskId, { x: entry.x, y: entry.y });
    });
  });
  const sourceRect = desktopDragSourceRectRef.current;
  const sourceCanvasPoint = sourceRect
    ? getCanvasPointFromClient(sourceRect.left, sourceRect.top)
    : null;
  const anchorPosition = entryPositionMap.get(taskId) || sourceCanvasPoint || { x: 0, y: 0 };
  const nextPositions = new Map();
  movingTaskIds.forEach((movingTaskId) => {
    const movingPosition = entryPositionMap.get(movingTaskId) || anchorPosition;
    nextPositions.set(movingTaskId, movingPosition);
  });
  desktopDragSelectionPositionsRef.current = nextPositions;
  desktopDragAnchorStartPositionRef.current = anchorPosition;

  const anchorEntry = selectedDayEntriesRef.current.find((entry) => getDesktopCanvasEntryTaskIds(entry).includes(taskId)) || null;
  const overlaySnapshot = {
    taskId,
    type: desktopDragIsGroupRef.current ? 'group' : 'task',
    baseX: anchorPosition.x,
    baseY: anchorPosition.y,
    task: null,
    tasks: null,
  };

  if (desktopDragIsGroupRef.current) {
    const resolvedTasks = anchorEntry?.type === 'group'
      ? anchorEntry.tasks
      : tasksRef.current.filter((candidate) => Array.isArray(task.groupTaskIds) && task.groupTaskIds.includes(candidate.id));
    overlaySnapshot.tasks = resolvedTasks.map((item) => ({ ...item }));
  } else {
    const resolvedTask = tasksRef.current.find((candidate) => candidate.id === taskId) || task;
    overlaySnapshot.task = { ...resolvedTask };
  }

  desktopDragOverlaySnapshotRef.current = overlaySnapshot;
  setDragSession(createCanvasDragSession({
    pointerId: desktopDragStateRef.current.pointerId,
    type: movingTaskIds.length > 1 ? (desktopDragIsGroupRef.current ? 'pack' : 'selection') : 'single',
    draggedIds: movingTaskIds,
    startPointer: desktopDragPointerRef.current,
    originPositions: nextPositions,
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
        if (isExternalDragTask?.(task) === true) onExternalDropCancelled?.();
        desktopDragModeRef.current = false;
        return;
      }
      const movingHeight = desktopDragAnchorSizeRef.current?.height || DESKTOP_CANVAS_CARD_HEIGHT;

      if (isExternalDragTask?.(task) === true) {
        const dropOutcome = wasCancelled
          ? { kind: 'cancelled' }
          : resolveInboxCanvasDrop({
            entries: selectedDayEntriesRef.current,
            position: rawNextPosition,
            pointerPosition: currentPt,
            canvasBounds: canvasBoundsRef.current,
            cardSize: {
              width: DESKTOP_CANVAS_CARD_WIDTH,
              height: movingHeight,
            },
          });

        if (dropOutcome.kind === 'cancelled') {
          onExternalDropCancelled?.();
        } else if (typeof onExternalDrop === 'function') {
          void onExternalDrop({
            itemId: task.id,
            packId: dropOutcome.kind === 'pack' ? dropOutcome.packId : null,
            position: {
              x: Number(dropOutcome.position.x.toFixed(1)),
              y: Number(dropOutcome.position.y.toFixed(1)),
              z: Date.now(),
            },
          }).catch(() => onExternalDropFailure?.());
        }
      } else {
      const anchorStart = desktopDragAnchorStartPositionRef.current || { x: 0, y: 0 };
      const startPositions = [...desktopDragSelectionPositionsRef.current.values()];
      const positionBounds = startPositions.length > 0 ? startPositions : [anchorStart];
      const rawDeltaX = rawNextPosition.x - anchorStart.x;
      const rawDeltaY = rawNextPosition.y - anchorStart.y;
      const minStartX = Math.min(...positionBounds.map((position) => position.x));
      const maxStartX = Math.max(...positionBounds.map((position) => position.x));
      const minStartY = Math.min(...positionBounds.map((position) => position.y));
      const maxStartY = Math.max(...positionBounds.map((position) => position.y));
      const maxCanvasX = Math.max(
        0,
        (canvasBoundsRef.current?.width || DESKTOP_MAIN_CONTENT_MAX_WIDTH) - DESKTOP_CANVAS_CARD_WIDTH,
      );
      const maxCanvasY = Math.max(0, (canvasBoundsRef.current?.height || movingHeight) - movingHeight);
      const clampedDeltaX = Math.min(maxCanvasX - maxStartX, Math.max(-minStartX, rawDeltaX));
      const clampedDeltaY = Math.min(maxCanvasY - maxStartY, Math.max(-minStartY, rawDeltaY));
      const nextPosition = clampDesktopCanvasPosition({
        x: anchorStart.x + clampedDeltaX,
        y: anchorStart.y + clampedDeltaY,
      }, canvasBoundsRef.current, movingHeight);
      const deltaX = nextPosition.x - anchorStart.x;
      const deltaY = nextPosition.y - anchorStart.y;

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
          const timestamp = Date.now();
          const isMultiDrag = desktopDragSelectedTaskIdsRef.current.size > 1;
          const isDetachedGroupTask = desktopDragDetachedFromGroupRef.current && !isMultiDrag && movingTaskIds.size === 1;
          const movingTasks = prev.filter((item) => movingTaskIds.has(item.id));
          const isPutBack = isDroppingBackIntoOriginalPack({ movingTasks, overlapEntry });
          const shouldShowGroupPrompt = shouldPromptForGroupDrop({ overlapEntry });
          const previewPositions = Object.fromEntries([...movingTaskIds].map((id) => {
            const origin = desktopDragSelectionPositionsRef.current.get(id) || anchorStart;
            return [id, isDetachedGroupTask ? nextPosition : { x: origin.x + deltaX, y: origin.y + deltaY }];
          }));
          const drop = calculateCanvasDrop({
            draggedIds: [...movingTaskIds],
            originPositions: Object.fromEntries(desktopDragSelectionPositionsRef.current),
            previewPositions,
            activeDateKey,
            timestamp,
            detachFromPack: !isGroupDrag && !isMultiDrag,
            overlapEntry,
            isReturningToPack: isPutBack,
          });

          if (isPutBack || shouldShowGroupPrompt) {
            // Returning an item to the Pack it came from is immediate; no modal is shown.

            if (isPutBack) {
              return cleanupDesktopGroupMetadata(reduceCanvasDrop(prev, drop));
            }

            const isMergePacks = shouldPromptForPackMerge({ isGroupDrag, overlapEntry });
            const targetGroupName = overlapEntry.type === 'group'
              ? getPackDisplayName(overlapEntry.tasks)
              : null;

            setPendingGroupPrompt({
              mode: isMergePacks ? 'merge-packs' : 'create-group',
              movingTaskIds: [...movingTaskIds],
              targetTaskIds: overlapEntry.type === 'group'
                ? overlapEntry.tasks.map((item) => item.id)
                : [overlapEntry.task.id],
              groupId: overlapEntry.type === 'group' ? overlapEntry.id : `desktop-group-${timestamp}`,
              targetGroupName,
              anchorX: desktopDragPointerRef.current.x,
              anchorY: desktopDragPointerRef.current.y,
              targetDateKey: activeDateKey,
              overlapX: overlapEntry.x,
              overlapY: overlapEntry.y,
              dropX: nextPosition.x,
              dropY: nextPosition.y,
              fallbackPosition: getDesktopCanvasResolvedPosition(prev, movingTaskIds, {
                x: overlapEntry.x,
                y: overlapEntry.y + getDesktopCanvasEntryHeight(overlapEntry) + DESKTOP_CANVAS_CARD_GAP,
              }),
            });
            setPendingGroupName(isMergePacks
              ? targetGroupName || ''
              : getSuggestedDesktopGroupName(movingTasks, overlapEntry));
            return cleanupDesktopGroupMetadata(reduceCanvasDrop(prev, drop.move));
          }

          setPendingGroupPrompt(null);
          return cleanupDesktopGroupMetadata(reduceCanvasDrop(prev, drop));
          });
        });
      }
    } else if (isExternalDragTask?.(task) === true) {
      onExternalDropCancelled?.();
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
  onExternalDrop,
  onExternalDropCancelled,
  onExternalDropFailure,
  resetDesktopDragState,
  searchDragSeparateRef,
  selectedDateRef,
  selectedDayEntriesRef,
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
