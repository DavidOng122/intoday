import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_HITBOX_HORIZONTAL_PADDING,
  DESKTOP_CANVAS_HITBOX_VERTICAL_PADDING,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from './canvasConstants';

export const doDesktopRectsIntersect = (first, second) => !(
  first.x + first.width < second.x
  || second.x + second.width < first.x
  || first.y + first.height < second.y
  || second.y + second.height < first.y
);

export const getDesktopSelectionRect = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const getDesktopCanvasRectIntersectionArea = (first, second) => {
  const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return overlapWidth * overlapHeight;
};

export const getRectCenterPoint = (rect) => ({
  x: rect.x + (rect.width / 2),
  y: rect.y + (rect.height / 2),
});

export const expandDesktopCanvasRect = (
  rect,
  horizontal = DESKTOP_CANVAS_HITBOX_HORIZONTAL_PADDING,
  vertical = DESKTOP_CANVAS_HITBOX_VERTICAL_PADDING,
) => ({
  x: rect.x - horizontal,
  y: rect.y - vertical,
  width: rect.width + (horizontal * 2),
  height: rect.height + (vertical * 2),
});

export const isDesktopCanvasPointInsideRect = (point, rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
);

const getEntryTaskIds = (entry) => (
  entry?.type === 'group'
    ? entry.tasks.map((task) => task.id)
    : entry?.task?.id !== undefined && entry?.task?.id !== null
      ? [entry.task.id]
      : []
);

export const findDesktopDragOverlap = ({
  movingRect,
  candidates,
  movingTaskIds,
  threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD,
}) => {
  if (!movingRect || !candidates || candidates.length === 0) return null;

  const movingHitRect = expandDesktopCanvasRect(movingRect);
  const movingCenter = getRectCenterPoint(movingRect);
  const movingArea = Math.max(1, movingRect.width * movingRect.height);
  let bestMatch = null;
  let bestRatio = 0;
  let bestTargetRect = null;

  candidates.forEach(({ entry, rect }) => {
    const entryTaskIds = getEntryTaskIds(entry);
    const isMovingExactSameItems = entryTaskIds.length === movingTaskIds.size
      && entryTaskIds.every((id) => movingTaskIds.has(id));
    if (isMovingExactSameItems) return;

    const targetRect = rect;
    if (!targetRect) return;

    const targetHitRect = expandDesktopCanvasRect(targetRect);
    const targetCenter = getRectCenterPoint(targetRect);
    const overlapArea = getDesktopCanvasRectIntersectionArea(movingHitRect, targetHitRect);
    const movingCenterInsideTarget = isDesktopCanvasPointInsideRect(movingCenter, targetHitRect);
    const targetCenterInsideMoving = isDesktopCanvasPointInsideRect(targetCenter, movingHitRect);
    if (overlapArea <= 0 && !movingCenterInsideTarget && !targetCenterInsideMoving) return;

    const targetArea = Math.max(1, targetRect.width * targetRect.height);
    const movingCoverageRatio = overlapArea / movingArea;
    const targetCoverageRatio = overlapArea / targetArea;
    const overlapRatio = Math.max(movingCoverageRatio, targetCoverageRatio);
    const qualifies = (
      movingCoverageRatio >= threshold
      || targetCoverageRatio >= threshold
      || movingCenterInsideTarget
      || targetCenterInsideMoving
    );
    if (qualifies && overlapRatio >= bestRatio) {
      bestRatio = overlapRatio;
      bestMatch = entry;
      bestTargetRect = targetRect;
    }
  });

  if (!bestMatch || !bestTargetRect) return null;

  const movingCenterPoint = getRectCenterPoint(movingRect);
  const targetCenterPoint = getRectCenterPoint(bestTargetRect);
  const targetHitRect = expandDesktopCanvasRect(bestTargetRect);
  const centerAligned = (
    isDesktopCanvasPointInsideRect(movingCenterPoint, targetHitRect)
    || isDesktopCanvasPointInsideRect(targetCenterPoint, movingHitRect)
  );

  return { entry: bestMatch, ratio: bestRatio, rect: movingRect, centerAligned };
};
