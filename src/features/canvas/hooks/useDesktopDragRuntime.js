import { useRef } from 'react';
import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
} from '../model/canvasConstants.js';

export const useDesktopDragRuntime = () => ({
  activePointerTaskRef: useRef(null),
  desktopDragStateRef: useRef({ pointerId: null, taskId: null, startX: 0, startY: 0, finalized: false }),
  desktopDragPointerRef: useRef({ x: 0, y: 0 }),
  desktopDragLastMoveRef: useRef(null),
  desktopDragModeRef: useRef(false),
  desktopDragSelectedTaskIdsRef: useRef(new Set()),
  desktopDragSelectionPositionsRef: useRef(new Map()),
  desktopDragPreviewPositionsRef: useRef({}),
  desktopDragAnchorStartPositionRef: useRef(null),
  desktopDragAnchorSizeRef: useRef({
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: DESKTOP_CANVAS_CARD_HEIGHT,
  }),
  desktopDragAnchorPointerOffsetRef: useRef(null),
  desktopDragSourceRectRef: useRef(null),
  desktopDragDetachedFromGroupRef: useRef(false),
  desktopDragVisualRafRef: useRef(null),
  desktopDragVisualPendingRef: useRef(null),
  desktopDragOverlayNodeRef: useRef(null),
  desktopDragOverlaySnapshotRef: useRef(null),
  desktopDragOverlapTargetIdRef: useRef(null),
  desktopDragOverlapRafRef: useRef(null),
  desktopDragOverlapPendingRef: useRef(null),
  selectedTaskIdsRef: useRef(new Set()),
  suppressTaskClickRef: useRef(null),
  suppressAllTaskClicksUntilRef: useRef(0),
  suppressTaskClickTimeoutRef: useRef(null),
});
