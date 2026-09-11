import { useCallback, useEffect, useRef } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from '../model/canvasConstants.js';
import { getDesktopCanvasOverlapEntry } from '../model/canvasEntries.js';
import { buildCanvasCollisionCandidates, getCanvasRectFromClientRect } from '../model/canvasCollisionCandidates.js';
import { getCanvasEntryIdentity } from '../model/canvasEntryIdentity.js';
import { findCanvasCollisionTarget } from '../model/canvasCollisionTarget.js';

// Keeps DOM measurement, collision caching, and target highlighting outside the
// pointer/session hook. The drag hook only asks for a target at a given position.
export const useCanvasDragCollision = ({
  runtime,
  getCanvasPointFromClient,
  getDragCanvasPointFromClient,
  getDesktopDragAnchorPosition,
  isExternalDragTask,
  setDesktopDragOverlapTargetId,
  tasksRef,
}) => {
  const {
    activePointerTaskRef,
    desktopDragIsGroupRef,
    desktopDragModeRef,
    desktopDragOverlapPendingRef,
    desktopDragOverlapRafRef,
    desktopDragOverlapTargetIdRef,
    desktopDragOverlapTimeoutRef,
    desktopDragOverlayNodeRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragStateRef,
  } = runtime;
  const targetCandidatesCacheRef = useRef(null);

  const getCandidatesCache = useCallback((tasks) => {
    if (!targetCandidatesCacheRef.current || targetCandidatesCacheRef.current.tasksReference !== tasks) {
      targetCandidatesCacheRef.current = {
        tasksReference: tasks,
        candidates: buildCanvasCollisionCandidates(tasks, getCanvasPointFromClient),
      };
    }
    return targetCandidatesCacheRef.current.candidates;
  }, [getCanvasPointFromClient]);

  const resetDragCollision = useCallback(() => {
    targetCandidatesCacheRef.current = null;
    desktopDragOverlapTargetIdRef.current = null;
    setDesktopDragOverlapTargetId(null);
  }, [desktopDragOverlapTargetIdRef, setDesktopDragOverlapTargetId]);

  const getActiveDraggedCanvasRect = useCallback((taskId) => {
    const activeNode = desktopDragOverlayNodeRef.current
      || document.getElementById(`desktop-canvas-entry-${taskId}`);
    return activeNode
      ? getCanvasRectFromClientRect(activeNode.getBoundingClientRect(), getCanvasPointFromClient)
      : null;
  }, [desktopDragOverlayNodeRef, getCanvasPointFromClient]);

  const getDesktopCanvasOverlapEntryFromDom = useCallback((
    tasks,
    movingTaskIds,
    taskId,
    fallbackNextPosition,
    threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD,
    preferFallbackPosition = false,
  ) => {
    const activeRect = getActiveDraggedCanvasRect(taskId);
    const fallbackRect = fallbackNextPosition && {
      x: fallbackNextPosition.x,
      y: fallbackNextPosition.y,
      width: activeRect?.width || DESKTOP_CANVAS_CARD_WIDTH,
      height: activeRect?.height || DESKTOP_CANVAS_CARD_HEIGHT,
    };
    const movingRect = (preferFallbackPosition ? fallbackRect : activeRect) || fallbackRect;
    if (!movingRect) {
      return fallbackNextPosition
        ? getDesktopCanvasOverlapEntry(tasks, movingTaskIds, fallbackNextPosition, threshold)
        : null;
    }
    return findCanvasCollisionTarget({
      movingRect,
      candidates: getCandidatesCache(tasks),
      movingTaskIds,
      threshold,
    });
  }, [getActiveDraggedCanvasRect, getCandidatesCache]);

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
      tasksRef.current, movingTaskIds, taskId, nextPosition,
    );
    const isExternalDrag = isExternalDragTask?.(activePointerTaskRef.current) === true;
    const nextTargetId = isExternalDrag && overlapResult?.entry?.type !== 'group'
      ? null
      : (overlapResult?.entry ? getCanvasEntryIdentity(overlapResult.entry) : null);
    if (nextTargetId === desktopDragOverlapTargetIdRef.current) return;
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
    if (!pending || !desktopDragModeRef.current || desktopDragStateRef.current.taskId !== pending.taskId) return;
    updateDesktopDragOverlapTarget(pending.clientX, pending.clientY, pending.taskId);
  }, [desktopDragModeRef, desktopDragOverlapPendingRef, desktopDragOverlapRafRef, desktopDragStateRef, updateDesktopDragOverlapTarget]);

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
  }, [desktopDragIsGroupRef, desktopDragOverlapPendingRef, desktopDragOverlapRafRef, desktopDragOverlapTimeoutRef, flushDesktopDragOverlapUpdate]);

  useEffect(() => {
    const invalidateCandidates = () => { targetCandidatesCacheRef.current = null; };
    window.addEventListener('resize', invalidateCandidates);
    window.addEventListener('scroll', invalidateCandidates, true);
    return () => {
      window.removeEventListener('resize', invalidateCandidates);
      window.removeEventListener('scroll', invalidateCandidates, true);
    };
  }, []);

  return {
    getCandidatesCache,
    getDesktopCanvasOverlapEntryFromDom,
    resetDragCollision,
    scheduleDesktopDragOverlapUpdate,
  };
};
