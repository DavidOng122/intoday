import { useCallback } from 'react';
import { DESKTOP_DRAG_START_DISTANCE } from '../model/canvasConstants.js';
import { getCanvasDragTaskIds } from '../model/canvasDragSession.js';

// Browser event lifecycle only: it owns pointer capture and the threshold that
// turns a press into a drag. Business decisions remain in the caller.
export const useCanvasPointerDrag = ({
  runtime,
  getCanvasPointFromClient,
  setDesktopSelectionRect,
  startDesktopTaskDrag,
  onDragMove,
  finishDesktopTaskDrag,
}) => {
  const {
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
  } = runtime;

  const releasePendingPointer = useCallback((event) => {
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
        // Pointer capture may already have been released by the browser.
      }
    }
  }, [
    activePointerTaskRef,
    desktopDragAnchorPointerOffsetRef,
    desktopDragDetachedFromGroupRef,
    desktopDragLastMoveRef,
    desktopDragSourceRectRef,
    desktopDragStateRef,
  ]);

  const handleTaskPointerDown = useCallback((task, event) => {
    if (!event.isPrimary || event.button !== 0) return;
    desktopDragLastMoveRef.current = null;
    // Multi-selection remains available for other Canvas actions, but a drag
    // always moves exactly one card or the one Pack that was grabbed.
    desktopDragSelectedTaskIdsRef.current = new Set(getCanvasDragTaskIds(task));
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
      const sourceNode = task.desktopGroupId && !task.isGroupInitiator
        ? event.currentTarget.closest('.desktop-task-wrapper') || event.currentTarget
        : event.currentTarget.closest('.desktop-canvas-card-node')
          || event.currentTarget.closest('.desktop-task-wrapper')
          || event.currentTarget;
      const rect = sourceNode.getBoundingClientRect();
      const sourcePoint = getCanvasPointFromClient(rect.left, rect.top);
      const pointerPoint = getCanvasPointFromClient(event.clientX, event.clientY);
      desktopDragSourceRectRef.current = rect;
      desktopDragAnchorPointerOffsetRef.current = sourcePoint && pointerPoint
        ? { x: pointerPoint.x - sourcePoint.x, y: pointerPoint.y - sourcePoint.y }
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
    setDesktopSelectionRect,
  ]);

  const handleTaskPointerMove = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    const previousMove = desktopDragLastMoveRef.current;
    if (previousMove && previousMove.eventStamp === event.timeStamp
      && previousMove.clientX === event.clientX && previousMove.clientY === event.clientY) return;
    desktopDragLastMoveRef.current = { eventStamp: event.timeStamp, clientX: event.clientX, clientY: event.clientY };
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    if (!desktopDragModeRef.current) {
      const distance = Math.hypot(
        event.clientX - desktopDragStateRef.current.startX,
        event.clientY - desktopDragStateRef.current.startY,
      );
      if (distance < DESKTOP_DRAG_START_DISTANCE) return;
      startDesktopTaskDrag(task);
    }
    if (event.cancelable) event.preventDefault();
    onDragMove(task, event.clientX, event.clientY, event);
  }, [desktopDragLastMoveRef, desktopDragModeRef, desktopDragPointerRef, desktopDragStateRef, onDragMove, startDesktopTaskDrag]);

  const finishPointer = useCallback((task, event, wasCancelled) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    if (!desktopDragModeRef.current) {
      releasePendingPointer(event);
      return;
    }
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    finishDesktopTaskDrag(task, event.currentTarget, event.pointerId, wasCancelled);
    activePointerTaskRef.current = null;
  }, [activePointerTaskRef, desktopDragModeRef, desktopDragPointerRef, desktopDragStateRef, finishDesktopTaskDrag, releasePendingPointer]);

  const handleTaskPointerUp = useCallback((task, event) => finishPointer(task, event, false), [finishPointer]);
  const handleTaskPointerCancel = useCallback((task, event) => finishPointer(task, event, true), [finishPointer]);

  return {
    handleTaskPointerDown,
    handleTaskPointerMove,
    handleTaskPointerUp,
    handleTaskPointerCancel,
  };
};
