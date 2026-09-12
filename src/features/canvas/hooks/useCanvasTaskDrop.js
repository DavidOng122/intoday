import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from '../model/canvasConstants.js';
import { getClampedCanvasDragPosition } from '../model/canvasDragPosition.js';
import { reduceCanvasDrop } from '../model/canvasDrop.js';
import { decideCanvasDrop } from '../model/canvasDropDecision.js';
import { dateKey } from '../../../lib/dateUtils.js';

// Commits an internal Canvas drag. This intentionally excludes Inbox/external
// drops, whose data ownership belongs to useExternalCanvasDrop.
export const useCanvasTaskDrop = ({
  runtime,
  canvas,
  canvasBoundsRef,
  getDesktopCanvasOverlapEntryFromDom,
}) => {
  const {
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragDetachedFromGroupRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
  } = runtime;
  const {
    cleanupDesktopGroupMetadata,
    searchDragSeparateRef,
    selectedDateRef,
    setPendingGroupName,
    setPendingGroupPrompt,
    setTasks,
  } = canvas;

  return useCallback(({ task, rawNextPosition }) => {
    const anchorStart = desktopDragAnchorStartPositionRef.current || { x: 0, y: 0 };
    const startPositions = [...desktopDragSelectionPositionsRef.current.values()];
    const previewPosition = desktopDragPreviewPositionsRef.current[task.id];
    const movingHeight = desktopDragAnchorSizeRef.current?.height || DESKTOP_CANVAS_CARD_HEIGHT;
    const { position: nextPosition, delta } = previewPosition
      ? {
        position: previewPosition,
        delta: { x: previewPosition.x - anchorStart.x, y: previewPosition.y - anchorStart.y },
      }
      : getClampedCanvasDragPosition({
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
        const overlapEntry = domOverlapResult?.entry;
        const isMultiDrag = desktopDragSelectedTaskIdsRef.current.size > 1;
        const isDetachedGroupTask = desktopDragDetachedFromGroupRef.current && !isMultiDrag && movingTaskIds.size === 1;
        const decision = decideCanvasDrop({
          tasks: prev,
          movingTaskIds,
          originPositions: Object.fromEntries(desktopDragSelectionPositionsRef.current),
          anchorPosition: anchorStart,
          nextPosition,
          delta,
          activeDateKey,
          timestamp: Date.now(),
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
  }, [
    canvasBoundsRef,
    cleanupDesktopGroupMetadata,
    desktopDragAnchorSizeRef,
    desktopDragAnchorStartPositionRef,
    desktopDragDetachedFromGroupRef,
    desktopDragPointerRef,
    desktopDragPreviewPositionsRef,
    desktopDragSelectedTaskIdsRef,
    desktopDragSelectionPositionsRef,
    getDesktopCanvasOverlapEntryFromDom,
    searchDragSeparateRef,
    selectedDateRef,
    setPendingGroupName,
    setPendingGroupPrompt,
    setTasks,
  ]);
};
