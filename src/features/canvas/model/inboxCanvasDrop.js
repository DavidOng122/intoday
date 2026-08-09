import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from './canvasConstants.js';
import { getDesktopCanvasEntryHeight } from './canvasEntries.js';
import { getDesktopCanvasRectIntersectionArea } from './canvasGeometry.js';

const isFinitePoint = (point) => (
  Number.isFinite(point?.x) && Number.isFinite(point?.y)
);

const isPointInsideBounds = (point, bounds) => (
  isFinitePoint(point)
  && Number.isFinite(bounds?.width)
  && Number.isFinite(bounds?.height)
  && point.x >= 0
  && point.y >= 0
  && point.x <= bounds.width
  && point.y <= bounds.height
);

const clampPosition = (position, bounds, cardSize) => ({
  x: Math.min(Math.max(0, bounds.width - cardSize.width), Math.max(0, position.x)),
  y: Math.min(Math.max(0, bounds.height - cardSize.height), Math.max(0, position.y)),
});

export const resolveInboxCanvasDrop = ({
  entries = [],
  position,
  pointerPosition,
  canvasBounds,
  cardSize = {
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: DESKTOP_CANVAS_CARD_HEIGHT,
  },
  overlapThreshold = DESKTOP_GROUP_OVERLAP_THRESHOLD,
}) => {
  if (!isFinitePoint(position) || !isPointInsideBounds(pointerPosition, canvasBounds)) {
    return { kind: 'cancelled' };
  }

  const resolvedPosition = clampPosition(position, canvasBounds, cardSize);
  const movingRect = { ...resolvedPosition, ...cardSize };
  const movingArea = cardSize.width * cardSize.height;
  const targetPack = entries
    .filter((entry) => entry?.type === 'group' && entry.id)
    .map((entry) => ({
      entry,
      ratio: getDesktopCanvasRectIntersectionArea(movingRect, {
        x: entry.x,
        y: entry.y,
        width: DESKTOP_CANVAS_CARD_WIDTH,
        height: getDesktopCanvasEntryHeight(entry),
      }) / movingArea,
    }))
    .filter(({ ratio }) => ratio >= overlapThreshold)
    .sort((left, right) => right.ratio - left.ratio)[0]?.entry;

  return targetPack
    ? { kind: 'pack', packId: targetPack.id, position: resolvedPosition }
    : { kind: 'canvas', position: resolvedPosition };
};
