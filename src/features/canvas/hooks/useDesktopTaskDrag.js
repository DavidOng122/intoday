import { useCallback, useEffect, useRef } from 'react';
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
  resolveDesktopCanvasEntries,
  getDesktopCanvasOverlapEntry,
} from '../model/canvasEntries.js';
import { getCanvasEntryIdentity } from '../model/canvasEntryIdentity.js';
import { resolveInboxCanvasDrop } from '../model/inboxCanvasDrop.js';
import {
  findDesktopDragOverlap,
} from '../model/canvasGeometry.js';
import { getPackDisplayName } from '../../../entities/pack/model/packSelectors.js';
import {
  isDroppingBackIntoOriginalPack,
  shouldPromptForPackMerge,
} from '../../pack/model/packMergePolicy.js';
import { dateKey } from '../../../lib/dateUtils.js';
import { normalizeTask } from '../../../lib/taskNormalize.js';

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
const getDesktopDragTaskIds = (task) => (
  Array.isArray(task?.groupTaskIds) && task.groupTaskIds.length > 0
    ? task.groupTaskIds
    : task?.id !== undefined && task?.id !== null
      ? [task.id]
      : []
);
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
    desktopDragOverlapStateLastTsRef,
    desktopDragOverlapTargetIdRef,
    desktopDragOverlapTimeoutRef,
    desktopDragOverlayNodeRef,
    desktopDragOverlaySnapshotRef,
    desktopDragPointerRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    desktopDragSourceEntryIdRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
    desktopDragVisualPendingRef,
    desktopDragVisualRafRef,
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

const targetCandidatesCacheRef = useRef(null);

const getCanvasRectFromClientRect = useCallback((rect) => {
  if (!rect) return null;
  const topLeft = getCanvasPointFromClient(rect.left, rect.top);
  const bottomRight = getCanvasPointFromClient(rect.right, rect.bottom);
  if (!topLeft || !bottomRight) return null;
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(0, bottomRight.x - topLeft.x),
    height: Math.max(0, bottomRight.y - topLeft.y),
  };
}, [getCanvasPointFromClient]);

const buildCandidatesCache = useCallback((tasks) => {
  const entries = resolveDesktopCanvasEntries(tasks);
  const entryNodes = new Map(
    [...document.querySelectorAll('.desktop-canvas-card-node[data-desktop-entry-id]')]
      .map((node) => [node.dataset.desktopEntryId, node]),
  );
  return entries.map((entry) => {
    const entryNode = entryNodes.get(String(getCanvasEntryIdentity(entry)));
    if (!entryNode) return null;
    const rect = getCanvasRectFromClientRect(entryNode.getBoundingClientRect());
    return { entry, rect };
  }).filter(Boolean);
}, [getCanvasRectFromClientRect]);

const getCandidatesCache = useCallback((tasks) => {
  if (
    !targetCandidatesCacheRef.current
    || targetCandidatesCacheRef.current.tasksReference !== tasks
  ) {
    targetCandidatesCacheRef.current = {
      tasksReference: tasks,
      candidates: buildCandidatesCache(tasks),
    };
  }
  return targetCandidatesCacheRef.current.candidates;
}, [buildCandidatesCache]);

const resetDesktopDragInteraction = useCallback(() => {
  targetCandidatesCacheRef.current = null;
  desktopDragOverlapTargetIdRef.current = null;
  setDesktopDragOverlapTargetId(null);
}, [desktopDragOverlapTargetIdRef, setDesktopDragOverlapTargetId]);

const getActiveDraggedCanvasRect = useCallback((taskId) => {
  const activeNode = desktopDragOverlayNodeRef.current
    || document.getElementById(`desktop-canvas-entry-${taskId}`);
  if (!activeNode) return null;
  return getCanvasRectFromClientRect(activeNode.getBoundingClientRect());
}, [desktopDragOverlayNodeRef, getCanvasRectFromClientRect]);

const getDesktopCanvasOverlapEntryFromDom = useCallback((
  tasks,
  movingTaskIds,
  taskId,
  fallbackNextPosition,
  threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD,
  preferFallbackPosition = false,
) => {
  const activeRect = getActiveDraggedCanvasRect(taskId);
  const fallbackRect = fallbackNextPosition
    ? {
      x: fallbackNextPosition.x,
      y: fallbackNextPosition.y,
      width: activeRect?.width || DESKTOP_CANVAS_CARD_WIDTH,
      height: activeRect?.height || DESKTOP_CANVAS_CARD_HEIGHT,
    }
    : null;
  const movingRect = (preferFallbackPosition ? fallbackRect : activeRect) || (
    fallbackNextPosition
      ? {
        x: fallbackNextPosition.x,
        y: fallbackNextPosition.y,
        width: DESKTOP_CANVAS_CARD_WIDTH,
        height: DESKTOP_CANVAS_CARD_HEIGHT,
      }
      : null
  );
  if (!movingRect) {
    return fallbackNextPosition
      ? getDesktopCanvasOverlapEntry(tasks, movingTaskIds, fallbackNextPosition, threshold)
      : null;
  }

  const candidates = getCandidatesCache(tasks);

  return findDesktopDragOverlap({
    movingRect,
    candidates,
    movingTaskIds,
    threshold,
  });
}, [getActiveDraggedCanvasRect, getCandidatesCache]);

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
  resetDesktopDragInteraction();
}, [resetDesktopDragInteraction]);

const updateDesktopDragOverlapTarget = useCallback((clientX, clientY, taskId) => {
  const currentPoint = getDragCanvasPointFromClient(clientX, clientY);
  const nextPosition = getDesktopDragAnchorPosition(currentPoint);
  if (!nextPosition) return;

  const movingTaskIds = new Set(
    desktopDragSelectedTaskIdsRef.current.size > 0
      ? [...desktopDragSelectedTaskIdsRef.current]
      : [taskId],
  );

  const overlapResult = getDesktopCanvasOverlapEntryFromDom(
    tasksRef.current,
    movingTaskIds,
    taskId,
    nextPosition,
  );

  const isExternalDrag = isExternalDragTask?.(activePointerTaskRef.current) === true;
  const nextTargetId = isExternalDrag && overlapResult?.entry?.type !== 'group'
    ? null
    : (overlapResult?.entry ? getCanvasEntryIdentity(overlapResult.entry) : null);
  const currentTargetId = desktopDragOverlapTargetIdRef.current;

  if (nextTargetId === currentTargetId) return;

  // Stability / Anti-Flicker:
  // If we have a current target and a new candidate, only switch if the new 
  // candidate is meaningfully better (e.g. 10% higher ratio).
  if (currentTargetId && nextTargetId) {
    const currentOverlap = getDesktopCanvasOverlapEntryFromDom(
      tasksRef.current,
      movingTaskIds,
      taskId,
      nextPosition,
      0.01, // Use low threshold to get actual ratio even if below 0.6
    );
    // If current still has a decent overlap, don't switch unless next is much better
    if (currentOverlap && currentOverlap.ratio * 1.1 > (overlapResult?.ratio || 0)) {
      return;
    }
  }

  desktopDragOverlapTargetIdRef.current = nextTargetId;
  setDesktopDragOverlapTargetId(nextTargetId);
}, [
  activePointerTaskRef,
  desktopDragOverlapTargetIdRef,
  desktopDragSelectedTaskIdsRef,
  getDesktopCanvasOverlapEntryFromDom,
  getDesktopDragAnchorPosition,
  getDragCanvasPointFromClient,
  isExternalDragTask,
  setDesktopDragOverlapTargetId,
  tasksRef,
]);

const flushDesktopDragOverlapUpdate = useCallback(() => {
  desktopDragOverlapRafRef.current = null;
  const pending = desktopDragOverlapPendingRef.current;
  desktopDragOverlapPendingRef.current = null;
  if (!pending) return;
  if (!desktopDragModeRef.current) return;
  if (desktopDragStateRef.current.taskId !== pending.taskId) return;

  updateDesktopDragOverlapTarget(pending.clientX, pending.clientY, pending.taskId);
}, [
  desktopDragModeRef,
  desktopDragOverlapPendingRef,
  desktopDragOverlapRafRef,
  desktopDragStateRef,
  updateDesktopDragOverlapTarget,
]);

const scheduleDesktopDragOverlapUpdate = useCallback((clientX, clientY, taskId) => {
  desktopDragOverlapPendingRef.current = { clientX, clientY, taskId };
  if (desktopDragIsGroupRef.current) {
    if (desktopDragOverlapTimeoutRef.current === null) {
      desktopDragOverlapTimeoutRef.current = window.setTimeout(() => {
        desktopDragOverlapTimeoutRef.current = null;
        flushDesktopDragOverlapUpdate();
      }, 34);
    }
    return;
  }

  if (desktopDragOverlapRafRef.current === null) {
    desktopDragOverlapRafRef.current = window.requestAnimationFrame(flushDesktopDragOverlapUpdate);
  }
}, [
  desktopDragIsGroupRef,
  desktopDragOverlapPendingRef,
  desktopDragOverlapRafRef,
  desktopDragOverlapTimeoutRef,
  flushDesktopDragOverlapUpdate,
]);

const syncDesktopDraggedTaskPosition = useCallback((clientX, clientY) => {
  const currentPt = getDragCanvasPointFromClient(clientX, clientY);
  if (!currentPt) return;

  const anchorStart = desktopDragAnchorStartPositionRef.current;
  if (!anchorStart) return;
  const nextAnchor = getDesktopDragAnchorPosition(currentPt);
  if (!nextAnchor) return;
  const nextAnchorX = nextAnchor.x;
  const nextAnchorY = nextAnchor.y;
  const dx = nextAnchorX - anchorStart.x;
  const dy = nextAnchorY - anchorStart.y;

  const overlayNode = desktopDragOverlayNodeRef.current;
  if (overlayNode) {
    overlayNode.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    overlayNode.style.zIndex = '999';
    return;
  }

  const movingIds = desktopDragSelectedTaskIdsRef.current.size > 0
    ? [...desktopDragSelectedTaskIdsRef.current]
    : [desktopDragStateRef.current.taskId];

  movingIds.forEach((id) => {
    // Target the absolutely-positioned canvas entry node (not the inner wrapper)
    const node = document.getElementById(`desktop-canvas-entry-${id}`);
    if (node) {
      node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      node.style.zIndex = '999';
    }
  });
}, [
  desktopDragAnchorStartPositionRef,
  desktopDragOverlayNodeRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragStateRef,
  getDesktopDragAnchorPosition,
  getDragCanvasPointFromClient,
]);

const flushDesktopDragVisualUpdate = useCallback(() => {
  desktopDragVisualRafRef.current = null;
  const pending = desktopDragVisualPendingRef.current;
  desktopDragVisualPendingRef.current = null;
  if (!pending) return;
  if (!desktopDragModeRef.current) return;
  if (desktopDragStateRef.current.taskId !== pending.taskId) return;

  syncDesktopDraggedTaskPosition(pending.clientX, pending.clientY);
}, [
  desktopDragModeRef,
  desktopDragStateRef,
  desktopDragVisualPendingRef,
  desktopDragVisualRafRef,
  syncDesktopDraggedTaskPosition,
]);

const scheduleDesktopDragVisualUpdate = useCallback((clientX, clientY, taskId) => {
  desktopDragVisualPendingRef.current = { clientX, clientY, taskId };
  if (desktopDragVisualRafRef.current === null) {
    desktopDragVisualRafRef.current = window.requestAnimationFrame(flushDesktopDragVisualUpdate);
  }
}, [desktopDragVisualPendingRef, desktopDragVisualRafRef, flushDesktopDragVisualUpdate]);

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
    : getDesktopDragTaskIds(task);
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
  syncDesktopDraggedTaskPosition,
  tasksRef,
  viewportContainerRef,
]);

const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId, wasCancelled = false) => {
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
  if (desktopDragVisualRafRef.current !== null) {
    window.cancelAnimationFrame(desktopDragVisualRafRef.current);
    desktopDragVisualRafRef.current = null;
  }
  const finalPointer = {
    clientX: desktopDragPointerRef.current.x,
    clientY: desktopDragPointerRef.current.y,
  };
  desktopDragVisualPendingRef.current = null;
  setDesktopDragSourceHidden(false);

  const movingTaskIds = desktopDragSelectedTaskIdsRef.current.size > 0
    ? [...desktopDragSelectedTaskIdsRef.current]
    : getDesktopDragTaskIds(task);

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
          const applyDroppedPosition = (tasksToMap) => tasksToMap.map((item) => {
            if (!movingTaskIds.has(item.id)) return item;
            const itemStartPosition = desktopDragSelectionPositionsRef.current.get(item.id) || anchorStart;
            const shouldResetGroup = !isGroupDrag && !isMultiDrag;
            const resetGroupProps = shouldResetGroup ? {
              desktopGroupId: null,
              desktopGroupName: null,
              desktopGroupIcon: null,
              desktopGroupTags: [],
              desktopGroupCover: null,
            } : {};

            return normalizeTask({
              ...item,
              ...resetGroupProps,
              dateString: activeDateKey,
              desktopSlot: null,
              desktopCanvasX: Number((isDetachedGroupTask ? nextPosition.x : (itemStartPosition.x + deltaX)).toFixed(1)),
              desktopCanvasY: Number((isDetachedGroupTask ? nextPosition.y : (itemStartPosition.y + deltaY)).toFixed(1)),
              desktopZ: timestamp,
            });
          });

          const movingTasks = prev.filter((item) => movingTaskIds.has(item.id));
          const isPutBack = isDroppingBackIntoOriginalPack({ movingTasks, overlapEntry });
          const shouldShowPackMergePrompt = shouldPromptForPackMerge({ isGroupDrag, overlapEntry });

          if (isPutBack || shouldShowPackMergePrompt) {
            // Returning an item to the Pack it came from is immediate; no modal is shown.

            if (isPutBack) {
              return prev.map((item) => {
                if (!movingTaskIds.has(item.id)) return item;
                return normalizeTask({
                  ...item,
                  dateString: activeDateKey,
                  desktopCanvasX: overlapEntry.x,
                  desktopCanvasY: overlapEntry.y,
                  desktopZ: timestamp,
                });
              });
            }

            const targetGroupName = getPackDisplayName(overlapEntry.tasks);

            setPendingGroupPrompt({
              mode: 'merge-packs',
              movingTaskIds: [...movingTaskIds],
              targetTaskIds: overlapEntry.tasks.map((item) => item.id),
              groupId: overlapEntry.id,
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
            setPendingGroupName(targetGroupName || '');
            return cleanupDesktopGroupMetadata(applyDroppedPosition(prev));
          }

          setPendingGroupPrompt(null);
          return cleanupDesktopGroupMetadata(applyDroppedPosition(prev));
          });
        });
      }
    } else if (isExternalDragTask?.(task) === true) {
      onExternalDropCancelled?.();
    }
  }

  // Reset live transform and class on every dragged canvas entry node without CSS transition jump
  movingTaskIds.forEach((movingTaskId) => {
    const node = document.getElementById(`desktop-canvas-entry-${movingTaskId}`);
    if (node) {
      node.style.transform = '';
      node.style.zIndex = '';
      const shell = node.querySelector('.desktop-canvas-card-shell');
      if (shell) {
        shell.style.transition = 'none';
        shell.classList.remove('is-dragging');
        window.requestAnimationFrame(() => {
          shell.style.transition = '';
        });
      }
    }
  });

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
  desktopDragOverlapStateLastTsRef.current = 0;
  desktopDragSelectedTaskIdsRef.current = new Set();
  searchDragSeparateRef.current = false;
  setDraggedTaskId(null);
  setIsGroupDragActive(false);
  setDesktopDragOverlayActive(false);
  setDesktopDragOverlaySnapshot(null);

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
  desktopDragOverlapStateLastTsRef,
  desktopDragOverlapTimeoutRef,
  desktopDragOverlaySnapshotRef,
  desktopDragPointerRef,
  desktopDragSelectedTaskIdsRef,
  desktopDragSelectionPositionsRef,
  desktopDragSourceEntryIdRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  desktopDragVisualPendingRef,
  desktopDragVisualRafRef,
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
  setPendingGroupName,
  setPendingGroupPrompt,
  setTasks,
  suppressNextTaskClick,
]);


const handleTaskPointerDown = useCallback((task, event) => {
  if (!event.isPrimary || event.button !== 0) return;
  desktopDragLastMoveRef.current = null;

  const taskSelectionIds = getDesktopDragTaskIds(task);
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

  desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
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

  desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
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

useEffect(() => {
  const handleWindowPointerMove = (event) => {
    const activeTask = activePointerTaskRef.current;
    if (!activeTask) return;
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;
    processDesktopDragMove(activeTask, event.clientX, event.clientY, event);
  };

  const handleWindowPointerEnd = (event) => {
    const activeTask = activePointerTaskRef.current;
    if (!activeTask) return;
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;

    if (desktopDragModeRef.current) {
      desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
      finishDesktopTaskDrag(activeTask, null, event.pointerId, event.type === 'pointercancel');
    } else {
      desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
      desktopDragAnchorPointerOffsetRef.current = null;
      desktopDragSourceRectRef.current = null;
      desktopDragDetachedFromGroupRef.current = false;
      resetDesktopDragState();
    }
    activePointerTaskRef.current = null;
  };

  window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
  window.addEventListener('pointerup', handleWindowPointerEnd);
  window.addEventListener('pointercancel', handleWindowPointerEnd);

  return () => {
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerEnd);
    window.removeEventListener('pointercancel', handleWindowPointerEnd);
  };
}, [
  activePointerTaskRef,
  desktopDragAnchorPointerOffsetRef,
  desktopDragDetachedFromGroupRef,
  desktopDragModeRef,
  desktopDragPointerRef,
  desktopDragSourceRectRef,
  desktopDragStateRef,
  finishDesktopTaskDrag,
  processDesktopDragMove,
  resetDesktopDragState,
]);

useEffect(() => {
  const handleViewportChange = () => {
    targetCandidatesCacheRef.current = null;
  };
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);
  return () => {
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, true);
  };
}, []);


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
