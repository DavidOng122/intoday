import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DESKTOP_APP_WINDOW_SCALE,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_TOP_PADDING,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from '../model/canvasConstants.js';
import { getDesktopCanvasEntryHeight, getDesktopCanvasEntryTaskIds } from '../model/canvasEntries.js';
import { doDesktopRectsIntersect } from '../model/canvasGeometry.js';

const DEFAULT_CANVAS_BOUNDS = {
  width: DESKTOP_MAIN_CONTENT_MAX_WIDTH,
  height: 560,
};

const getFiniteViewportMetrics = () => {
  if (typeof window === 'undefined') {
    return {
      viewport: { panX: 0, panY: 0, zoom: 1 },
      bounds: DEFAULT_CANVAS_BOUNDS,
    };
  }

  const width = window.innerWidth / DESKTOP_APP_WINDOW_SCALE;
  const height = window.innerHeight / DESKTOP_APP_WINDOW_SCALE;
  return {
    viewport: {
      panX: 0,
      panY: 0,
      zoom: 1,
    },
    bounds: {
      width: Math.max(DESKTOP_CANVAS_CARD_WIDTH, width),
      height: Math.max(DESKTOP_CANVAS_CARD_HEIGHT, height - DESKTOP_CANVAS_TOP_PADDING),
    },
  };
};

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
  desktopSelectionStateRef,
  getCanvasDeletionSummary,
  selectedDayEntriesRef,
  selectedTaskIdsRef,
  setDesktopSelectionRect,
  setPendingCanvasDeletion,
  setSelectedTaskIds,
  t,
  tasksRef,
}) => {
  const initialMetrics = getFiniteViewportMetrics();
  const [viewport, setViewport] = useState(initialMetrics.viewport);
  const viewportRef = useRef(viewport);
  const viewportContainerRef = useRef(null);
  const [canvasBounds, setCanvasBounds] = useState(initialMetrics.bounds);
  const canvasBoundsRef = useRef(initialMetrics.bounds);

  useLayoutEffect(() => {
    const container = viewportContainerRef.current;
    if (!container) return undefined;

    const updateFiniteViewport = () => {
      const { viewport: nextViewport, bounds: nextBounds } = getFiniteViewportMetrics();

      viewportRef.current = nextViewport;
      canvasBoundsRef.current = nextBounds;
      setViewport(nextViewport);
      setCanvasBounds(nextBounds);
    };

    updateFiniteViewport();
    const frameId = window.requestAnimationFrame(updateFiniteViewport);
    const resizeObserver = new ResizeObserver(updateFiniteViewport);
    resizeObserver.observe(container);
    window.addEventListener('resize', updateFiniteViewport);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateFiniteViewport);
    };
  }, []);

  const getCanvasPointFromRect = useCallback((clientX, clientY, rect) => {
    const screenX = (clientX - rect.left) / DESKTOP_APP_WINDOW_SCALE;
    const screenY = (clientY - rect.top) / DESKTOP_APP_WINDOW_SCALE;
    return {
      x: (screenX - viewportRef.current.panX) / viewportRef.current.zoom,
      y: ((screenY - viewportRef.current.panY) / viewportRef.current.zoom) - DESKTOP_CANVAS_TOP_PADDING,
    };
  }, []);

  const getCanvasPointFromClient = useCallback((clientX, clientY) => {
    const container = viewportContainerRef.current;
    if (!container) return null;
    return getCanvasPointFromRect(clientX, clientY, container.getBoundingClientRect());
  }, [getCanvasPointFromRect]);

  const getDragCanvasPointFromClient = useCallback((clientX, clientY) => {
    const rect = desktopDragContainerRectRef.current;
    return rect
      ? getCanvasPointFromRect(clientX, clientY, rect)
      : getCanvasPointFromClient(clientX, clientY);
  }, [desktopDragContainerRectRef, getCanvasPointFromClient, getCanvasPointFromRect]);

  const clampCanvasPosition = useCallback((position, size = null) => {
    const bounds = canvasBoundsRef.current;
    const resolvedSize = size || {
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: DESKTOP_CANVAS_CARD_HEIGHT,
    };
    return {
      x: Math.min(Math.max(0, bounds.width - resolvedSize.width), Math.max(0, position.x)),
      y: Math.min(Math.max(0, bounds.height - resolvedSize.height), Math.max(0, position.y)),
    };
  }, []);

  const getDesktopDragAnchorPosition = useCallback((canvasPoint) => {
    if (!canvasPoint) return null;

    const pointerOffset = desktopDragAnchorPointerOffsetRef.current;
    const anchorSize = desktopDragAnchorSizeRef.current || {
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: DESKTOP_CANVAS_CARD_HEIGHT,
    };
    const position = pointerOffset
      ? {
        x: canvasPoint.x - pointerOffset.x,
        y: canvasPoint.y - pointerOffset.y,
      }
      : {
        x: canvasPoint.x - (anchorSize.width / 2),
        y: canvasPoint.y - (anchorSize.height / 2),
      };

    return clampCanvasPosition(position, anchorSize);
  }, [clampCanvasPosition, desktopDragAnchorPointerOffsetRef, desktopDragAnchorSizeRef]);

  const clampCanvasPoint = useCallback((point) => ({
    x: Math.min(canvasBoundsRef.current.width, Math.max(0, point.x)),
    y: Math.min(canvasBoundsRef.current.height, Math.max(0, point.y)),
  }), []);

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
  }, [selectedDayEntriesRef, setSelectedTaskIds]);

  const handleDesktopCanvasPointerDown = useCallback((event) => {
    if (event.button !== 0 || isEditableElement(event.target)) return;
    if (event.target instanceof HTMLElement && event.target.closest('.desktop-task-card, .desktop-task-group-row')) return;

    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    const origin = clampCanvasPoint(point);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    desktopSelectionStateRef.current = { pointerId: event.pointerId, origin };
    setDesktopSelectionRect({ x: origin.x, y: origin.y, width: 0, height: 0 });
    setSelectedTaskIds([]);
  }, [clampCanvasPoint, desktopSelectionStateRef, getCanvasPointFromClient, setDesktopSelectionRect, setSelectedTaskIds]);

  const handleDesktopCanvasPointerMove = useCallback((event) => {
    if (desktopSelectionStateRef.current.pointerId !== event.pointerId) return;
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point || !desktopSelectionStateRef.current.origin) return;

    const nextRect = getDesktopSelectionRect(
      desktopSelectionStateRef.current.origin,
      clampCanvasPoint(point),
    );
    setDesktopSelectionRect(nextRect);
    updateDesktopSelectionFromRect(nextRect);
  }, [clampCanvasPoint, desktopSelectionStateRef, getCanvasPointFromClient, setDesktopSelectionRect, updateDesktopSelectionFromRect]);

  const handleDesktopCanvasPointerEnd = useCallback((event) => {
    if (desktopSelectionStateRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    desktopSelectionStateRef.current = { pointerId: null, origin: null };
    setDesktopSelectionRect(null);
  }, [desktopSelectionStateRef, setDesktopSelectionRect]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableElement(event.target)) return;
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || activeGroupView) return;
      if (selectedTaskIdsRef.current.size === 0) return;

      event.preventDefault();
      const summary = getCanvasDeletionSummary(t, tasksRef.current, [...selectedTaskIdsRef.current]);
      if (summary) setPendingCanvasDeletion(summary);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGroupView, getCanvasDeletionSummary, selectedTaskIdsRef, setPendingCanvasDeletion, t, tasksRef]);

  return {
    viewport,
    viewportContainerRef,
    canvasBounds,
    canvasBoundsRef,
    clampCanvasPosition,
    getCanvasPointFromClient,
    getDragCanvasPointFromClient,
    getDesktopDragAnchorPosition,
    handleDesktopCanvasPointerDown,
    handleDesktopCanvasPointerMove,
    handleDesktopCanvasPointerEnd,
  };
};
