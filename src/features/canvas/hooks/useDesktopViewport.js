/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DESKTOP_APP_WINDOW_SCALE,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_DEFAULT_ZOOM,
  DESKTOP_CANVAS_MAX_SCALE,
  DESKTOP_CANVAS_MIN_SCALE,
  DESKTOP_CANVAS_SCALE_STEP,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from '../model/canvasConstants';
import { getDesktopCanvasEntryHeight, getDesktopCanvasEntryTaskIds } from '../model/canvasEntries';
import { doDesktopRectsIntersect } from '../model/canvasGeometry';

const screenToCanvas = (screenX, screenY, viewport) => ({
  x: (screenX - viewport.panX) / viewport.zoom,
  y: (screenY - viewport.panY) / viewport.zoom,
});
const clampDesktopCanvasScale = (value) => Math.min(
  DESKTOP_CANVAS_MAX_SCALE,
  Math.max(DESKTOP_CANVAS_MIN_SCALE, value),
);
const isEditableElement = (target) => (
  target instanceof HTMLElement
  && Boolean(target.closest('input, textarea, button, select, [contenteditable="true"], [role="dialog"]'))
);
const getDesktopSelectionRect = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const useDesktopViewport = ({
  activeGroupView,
  desktopDragAnchorPointerOffsetRef,
  desktopDragAnchorSizeRef,
  desktopDragContainerRectRef,
  desktopDragModeRef,
  desktopSelectionStateRef,
  editingTaskId,
  getCanvasDeletionSummary,
  panelOpen,
  selectedDayEntriesRef,
  selectedTaskIdsRef,
  setDesktopSelectionRect,
  setPendingCanvasDeletion,
  setSelectedTaskIds,
  t,
  tasksRef,
}) => {
const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: DESKTOP_CANVAS_DEFAULT_ZOOM });
const viewportRef = useRef({ panX: 0, panY: 0, zoom: DESKTOP_CANVAS_DEFAULT_ZOOM });
const viewportContainerRef = useRef(null);
const [desktopCanvasPanReady, setDesktopCanvasPanReady] = useState(false);
const [desktopCanvasPanActive, setDesktopCanvasPanActive] = useState(false);
const [desktopZoomMenuOpen, setDesktopZoomMenuOpen] = useState(false);
const desktopCanvasPanStateRef = useRef({
  pointerId: null,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
});


useEffect(() => {
  viewportRef.current = viewport;
}, [viewport]);
useEffect(() => {
  if (!desktopZoomMenuOpen) return undefined;

  const handlePointerDown = (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('.desktop-zoom-menu-anchor')) return;
    setDesktopZoomMenuOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setDesktopZoomMenuOpen(false);
    }
  };

  window.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [desktopZoomMenuOpen]);

const fitDesktopCanvas = useCallback(() => {
  const container = viewportContainerRef.current;
  if (!container) return;
  const vw = container.clientWidth;
  const zoom = clampDesktopCanvasScale(Math.min(vw / DESKTOP_MAIN_CONTENT_MAX_WIDTH, DESKTOP_CANVAS_DEFAULT_ZOOM));
  const contentW = DESKTOP_MAIN_CONTENT_MAX_WIDTH * zoom;
  const nextPanX = vw > contentW ? (vw - contentW) / 2 : 0;
  const nextVp = { panX: nextPanX, panY: 0, zoom };
  viewportRef.current = nextVp;
  setViewport(nextVp);
}, []);

useEffect(() => {
  let isMounted = true;
  const attemptFit = () => {
    if (!isMounted) return;
    if (viewportContainerRef.current && viewportContainerRef.current.clientWidth > 0) {
      if (viewportRef.current.panX === 0 && viewportRef.current.panY === 0) {
        fitDesktopCanvas();
      }
    } else {
      setTimeout(attemptFit, 50);
    }
  };
  attemptFit();
  return () => { isMounted = false; };
}, [fitDesktopCanvas]);

const getCanvasPointFromClient = useCallback((clientX, clientY) => {
  const container = viewportContainerRef.current;
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  return screenToCanvas(
    (clientX - rect.left) / DESKTOP_APP_WINDOW_SCALE,
    (clientY - rect.top) / DESKTOP_APP_WINDOW_SCALE,
    viewportRef.current,
  );
}, []);

const getDragCanvasPointFromClient = useCallback((clientX, clientY) => {
  const rect = desktopDragContainerRectRef.current;
  if (rect) {
    return screenToCanvas(
      (clientX - rect.left) / DESKTOP_APP_WINDOW_SCALE,
      (clientY - rect.top) / DESKTOP_APP_WINDOW_SCALE,
      viewportRef.current,
    );
  }
  return getCanvasPointFromClient(clientX, clientY);
}, [getCanvasPointFromClient]);

const getDesktopDragAnchorPosition = useCallback((canvasPoint) => {
  if (!canvasPoint) return null;

  const pointerOffset = desktopDragAnchorPointerOffsetRef.current;
  if (pointerOffset) {
    return {
      x: canvasPoint.x - pointerOffset.x,
      y: canvasPoint.y - pointerOffset.y,
    };
  }

  const anchorSize = desktopDragAnchorSizeRef.current || {
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: DESKTOP_CANVAS_CARD_HEIGHT,
  };
  return {
    x: canvasPoint.x - (anchorSize.width / 2),
    y: canvasPoint.y - (anchorSize.height / 2),
  };
}, []);

const updateDesktopSelectionFromRect = useCallback((selectionRect) => {
  const nextSelectedTaskIds = selectedDayEntriesRef.current.flatMap((entry) => {
    const entryRect = {
      x: entry.x,
      y: entry.y,
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: getDesktopCanvasEntryHeight(entry),
    };

    return doDesktopRectsIntersect(selectionRect, entryRect)
      ? getDesktopCanvasEntryTaskIds(entry)
      : [];
  });

  setSelectedTaskIds([...new Set(nextSelectedTaskIds)]);
}, []);

// Clamp panX/panY so the canvas content is always at least MIN_VISIBLE px
// inside the viewport — prevents tasks from floating completely off-screen.
const clampViewportPan = useCallback((vp) => {
  const container = viewportContainerRef.current;
  if (!container) return vp;
  const MIN_VISIBLE = 128; // px — minimum overlap required on each axis
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const contentW = DESKTOP_MAIN_CONTENT_MAX_WIDTH * vp.zoom;
  // Horizontal: canvas right edge must be at least MIN_VISIBLE from the left;
  //             canvas left edge must be at most (cw - MIN_VISIBLE) from the left.
  const minPanX = MIN_VISIBLE - contentW;  // canvas almost entirely right of viewport
  const maxPanX = cw - MIN_VISIBLE;         // canvas almost entirely left of viewport
  // Vertical: keep top of canvas reachable (panY should not exceed containerHeight - MIN_VISIBLE).
  //           Infinite height downward is fine, but don't push top too far down.
  const minPanY = -(ch * 4);               // generous — allow lots of vertical canvas
  const maxPanY = ch - MIN_VISIBLE;
  return {
    panX: Math.min(maxPanX, Math.max(minPanX, vp.panX)),
    panY: Math.min(maxPanY, Math.max(minPanY, vp.panY)),
    zoom: vp.zoom,
  };
}, []);

// Zoom while anchoring a specific screen point (used for wheel/pinch so the canvas
// point under the cursor stays fixed on screen).
const updateDesktopCanvasZoomAnchored = useCallback((nextZoom, anchor) => {
  const container = viewportContainerRef.current;
  const current = viewportRef.current;
  const clampedZoom = clampDesktopCanvasScale(Number(nextZoom.toFixed(3)));
  if (!container || desktopDragModeRef.current || Math.abs(clampedZoom - current.zoom) < 0.001) return;

  const containerRect = container.getBoundingClientRect();
  const screenAnchorX = (anchor.clientX - containerRect.left) / DESKTOP_APP_WINDOW_SCALE;
  const screenAnchorY = (anchor.clientY - containerRect.top) / DESKTOP_APP_WINDOW_SCALE;
  const { x: canvasAnchorX, y: canvasAnchorY } = screenToCanvas(screenAnchorX, screenAnchorY, current);
  const nextPanX = screenAnchorX - canvasAnchorX * clampedZoom;
  const nextPanY = screenAnchorY - canvasAnchorY * clampedZoom;
  const nextVp = clampViewportPan({ panX: nextPanX, panY: nextPanY, zoom: clampedZoom });
  viewportRef.current = nextVp;
  setViewport(nextVp);
}, [clampViewportPan]);

// Zoom controls and keyboard shortcuts use the viewport center as their anchor.
const updateDesktopCanvasZoom = useCallback((nextZoom) => {
  const container = viewportContainerRef.current;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  updateDesktopCanvasZoomAnchored(nextZoom, {
    clientX: rect.left + (rect.width / 2),
    clientY: rect.top + (rect.height / 2),
  });
}, [updateDesktopCanvasZoomAnchored]);

const handleDesktopCanvasWheel = useCallback((event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  updateDesktopCanvasZoomAnchored(
    viewportRef.current.zoom + (direction * DESKTOP_CANVAS_SCALE_STEP),
    { clientX: event.clientX, clientY: event.clientY },
  );
}, [updateDesktopCanvasZoomAnchored]);

const handleDesktopCanvasPointerDown = useCallback((event) => {
  if (event.button !== 0 || isEditableElement(event.target)) return;

  if (desktopCanvasPanReady) {
    event.preventDefault();
    event.stopPropagation();

    desktopCanvasPanStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: viewportRef.current.panX,
      startPanY: viewportRef.current.panY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDesktopCanvasPanActive(true);
    return;
  }

  if (event.target instanceof HTMLElement && event.target.closest('.desktop-task-card, .desktop-task-group-row, .desktop-task-actions, .desktop-task-action-button')) {
    return;
  }

  const origin = getCanvasPointFromClient(event.clientX, event.clientY);
  if (!origin) return;

  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  desktopSelectionStateRef.current = {
    pointerId: event.pointerId,
    origin,
  };
  setDesktopSelectionRect({ x: origin.x, y: origin.y, width: 0, height: 0 });
  setSelectedTaskIds([]);
}, [desktopCanvasPanReady, getCanvasPointFromClient]);

const handleDesktopCanvasPointerMove = useCallback((event) => {
  if (desktopSelectionStateRef.current.pointerId === event.pointerId) {
    const nextPoint = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!nextPoint || !desktopSelectionStateRef.current.origin) return;

    const nextRect = getDesktopSelectionRect(desktopSelectionStateRef.current.origin, nextPoint);
    setDesktopSelectionRect(nextRect);
    updateDesktopSelectionFromRect(nextRect);
    return;
  }

  if (!desktopCanvasPanActive || desktopCanvasPanStateRef.current.pointerId !== event.pointerId) return;

  const dx = (event.clientX - desktopCanvasPanStateRef.current.startX) / DESKTOP_APP_WINDOW_SCALE;
  const dy = (event.clientY - desktopCanvasPanStateRef.current.startY) / DESKTOP_APP_WINDOW_SCALE;
  const nextPanX = desktopCanvasPanStateRef.current.startPanX + dx;
  const nextPanY = desktopCanvasPanStateRef.current.startPanY + dy;
  const nextVp = clampViewportPan({ ...viewportRef.current, panX: nextPanX, panY: nextPanY });
  viewportRef.current = nextVp;
  setViewport(nextVp);
}, [clampViewportPan, desktopCanvasPanActive, getCanvasPointFromClient, updateDesktopSelectionFromRect]);

const handleDesktopCanvasPointerEnd = useCallback((event) => {
  if (desktopSelectionStateRef.current.pointerId === event.pointerId) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    desktopSelectionStateRef.current = { pointerId: null, origin: null };
    setDesktopSelectionRect(null);
    return;
  }

  if (desktopCanvasPanStateRef.current.pointerId !== event.pointerId) return;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  desktopCanvasPanStateRef.current.pointerId = null;
  setDesktopCanvasPanActive(false);
}, []);
useEffect(() => {
  const handleKeyDown = (event) => {
    if (isEditableElement(event.target)) return;

    if (event.code === 'Space') {
      event.preventDefault();
      setDesktopCanvasPanReady(true);
    }

    if (event.shiftKey && event.key === '1') {
      event.preventDefault();
      fitDesktopCanvas();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !activeGroupView && !editingTaskId && !panelOpen) {
      if (selectedTaskIdsRef.current.size > 0) {
        event.preventDefault();
        const summary = getCanvasDeletionSummary(t, tasksRef.current, [...selectedTaskIdsRef.current]);
        if (summary) {
          setPendingCanvasDeletion(summary);
        }
      }
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      updateDesktopCanvasZoom(viewportRef.current.zoom + DESKTOP_CANVAS_SCALE_STEP);
    } else if (event.key === '-') {
      event.preventDefault();
      updateDesktopCanvasZoom(viewportRef.current.zoom - DESKTOP_CANVAS_SCALE_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      updateDesktopCanvasZoom(DESKTOP_CANVAS_DEFAULT_ZOOM);
    }
  };

  const handleKeyUp = (event) => {
    if (event.code === 'Space') {
      setDesktopCanvasPanReady(false);
      setDesktopCanvasPanActive(false);
      desktopCanvasPanStateRef.current.pointerId = null;
    }
  };

  const handleWindowBlur = () => {
    setDesktopCanvasPanReady(false);
    setDesktopCanvasPanActive(false);
    desktopCanvasPanStateRef.current.pointerId = null;
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleWindowBlur);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleWindowBlur);
  };
}, [activeGroupView, editingTaskId, fitDesktopCanvas, panelOpen, updateDesktopCanvasZoom]);
  return {
    viewport,
    viewportRef,
    viewportContainerRef,
    desktopCanvasPanReady,
    desktopCanvasPanActive,
    desktopZoomMenuOpen,
    setDesktopZoomMenuOpen,
    fitDesktopCanvas,
    getCanvasPointFromClient,
    getDragCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    updateDesktopCanvasZoom,
    handleDesktopCanvasWheel,
    handleDesktopCanvasPointerDown,
    handleDesktopCanvasPointerMove,
    handleDesktopCanvasPointerEnd,
  };
};
