import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_GAP,
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

const entryRect = (entry) => ({
  x: entry.x,
  y: entry.y,
  width: DESKTOP_CANVAS_CARD_WIDTH,
  height: getDesktopCanvasEntryHeight(entry),
});

const overlapsEntry = (position, entries, cardSize) => {
  const movingRect = { ...position, ...cardSize };
  return entries.some((entry) => (
    getDesktopCanvasRectIntersectionArea(movingRect, entryRect(entry)) > 0
  ));
};

// An Inbox item may be dropped anywhere, including on a standalone card. It
// must not look like a stale drag preview after placement, so choose the first
// nearby non-overlapping slot without turning that contact into a Pack.
const findNearestOpenCanvasPosition = (position, entries, canvasBounds, cardSize) => {
  if (!overlapsEntry(position, entries, cardSize)) return position;

  const horizontalStep = cardSize.width + DESKTOP_CANVAS_CARD_GAP;
  const verticalStep = cardSize.height + DESKTOP_CANVAS_CARD_GAP;
  const seen = new Set();
  for (let distance = 1; distance <= 8; distance += 1) {
    const offsets = [
      [distance, 0], [-distance, 0], [0, distance], [0, -distance],
      [distance, distance], [distance, -distance], [-distance, distance], [-distance, -distance],
    ];
    for (const [offsetX, offsetY] of offsets) {
      const candidate = clampPosition({
        x: position.x + (offsetX * horizontalStep),
        y: position.y + (offsetY * verticalStep),
      }, canvasBounds, cardSize);
      const key = `${candidate.x}:${candidate.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!overlapsEntry(candidate, entries, cardSize)) return candidate;
    }
  }
  return position;
};

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

  if (targetPack) {
    return { kind: 'pack', packId: targetPack.id, position: resolvedPosition };
  }

  return {
    kind: 'canvas',
    position: findNearestOpenCanvasPosition(resolvedPosition, entries, canvasBounds, cardSize),
  };
};
