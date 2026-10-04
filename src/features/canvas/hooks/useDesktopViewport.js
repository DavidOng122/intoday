import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  DESKTOP_APP_WINDOW_SCALE,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_TOP_PADDING,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from '../model/canvasConstants';

const DEFAULT_CANVAS_BOUNDS = {
  width: DESKTOP_MAIN_CONTENT_MAX_WIDTH,
  height: 560,
};

const DEFAULT_CANVAS_VIEWPORT_SIZE = {
  width: DESKTOP_MAIN_CONTENT_MAX_WIDTH * DESKTOP_APP_WINDOW_SCALE,
  height: 560 * DESKTOP_APP_WINDOW_SCALE,
};

const getFiniteViewportMetrics = (container = null) => {
  if (typeof window === 'undefined') {
    return {
      bounds: DEFAULT_CANVAS_BOUNDS,
      canvasViewportSize: DEFAULT_CANVAS_VIEWPORT_SIZE,
    };
  }

  const rect = container?.getBoundingClientRect?.();
  const viewportWidth = rect?.width || window.innerWidth;
  const viewportHeight = rect?.height || window.innerHeight;
  return {
    bounds: {
      width: Math.max(
        DESKTOP_CANVAS_CARD_WIDTH,
        window.innerWidth / DESKTOP_APP_WINDOW_SCALE,
      ),
      height: Math.max(
        DESKTOP_CANVAS_CARD_HEIGHT,
        (window.innerHeight / DESKTOP_APP_WINDOW_SCALE) - DESKTOP_CANVAS_TOP_PADDING,
      ),
    },
    canvasViewportSize: {
      width: viewportWidth,
      height: Math.max(
        0,
        viewportHeight - (DESKTOP_CANVAS_TOP_PADDING * DESKTOP_APP_WINDOW_SCALE),
      ),
    },
  };
};

export const useDesktopViewport = ({
  desktopDragAnchorPointerOffsetRef,
  desktopDragAnchorSizeRef,
}) => {
  const initialMetrics = getFiniteViewportMetrics();
  const viewportContainerRef = useRef(null);
  const flowInstanceRef = useRef(null);
  const [canvasBounds, setCanvasBounds] = useState(initialMetrics.bounds);
  const canvasBoundsRef = useRef(initialMetrics.bounds);
  const [canvasViewportSize, setCanvasViewportSize] = useState(initialMetrics.canvasViewportSize);

  useLayoutEffect(() => {
    const container = viewportContainerRef.current;
    if (!container) return undefined;

    const updateFiniteViewport = () => {
      const {
        bounds: nextBounds,
        canvasViewportSize: nextCanvasViewportSize,
      } = getFiniteViewportMetrics(container);
      canvasBoundsRef.current = nextBounds;
      setCanvasBounds(nextBounds);
      setCanvasViewportSize(nextCanvasViewportSize);
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

  const getCanvasPointFromClient = useCallback((clientX, clientY) => {
    const flowInstance = flowInstanceRef.current;
    if (!flowInstance) return null;
    return flowInstance.screenToFlowPosition({ x: clientX, y: clientY });
  }, []);

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

  return {
    viewportContainerRef,
    flowInstanceRef,
    canvasBounds,
    canvasBoundsRef,
    canvasViewportSize,
    clampCanvasPosition,
    getCanvasPointFromClient,
    getDesktopDragAnchorPosition,
  };
};
