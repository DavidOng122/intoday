import { useCallback } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';
import { resolveInboxCanvasDrop } from '../model/inboxCanvasDrop.js';

// Owns the bridge from an Inbox resource to the Canvas. Canvas task movement
// does not need to know how the external source persists its result.
export const useExternalCanvasDrop = ({ externalSource, canvasBoundsRef, selectedDayEntriesRef }) => {
  const {
    isTask: isExternalDragTask,
    onCancel,
    onDrop,
    onDropFailure,
    onOverlayReady,
  } = externalSource;

  const finishExternalCanvasDrop = useCallback(({
    task,
    wasCancelled,
    position,
    pointerPosition,
    height = DESKTOP_CANVAS_CARD_HEIGHT,
  }) => {
    const outcome = wasCancelled
      ? { kind: 'cancelled' }
      : resolveInboxCanvasDrop({
        entries: selectedDayEntriesRef.current,
        position,
        pointerPosition,
        canvasBounds: canvasBoundsRef.current,
        cardSize: { width: DESKTOP_CANVAS_CARD_WIDTH, height },
      });
    if (outcome.kind === 'cancelled') {
      onCancel?.();
      return;
    }
    if (typeof onDrop !== 'function') return;
    void onDrop({
      itemId: task.id,
      packId: outcome.kind === 'pack' ? outcome.packId : null,
      position: {
        x: Number(outcome.position.x.toFixed(1)),
        y: Number(outcome.position.y.toFixed(1)),
        z: Date.now(),
      },
    }).catch(() => onDropFailure?.());
  }, [canvasBoundsRef, onCancel, onDrop, onDropFailure, selectedDayEntriesRef]);

  return {
    closeExternalDragSource: onOverlayReady,
    finishExternalCanvasDrop,
    isExternalDragTask,
    cancelExternalCanvasDrop: onCancel,
  };
};
