import { DESKTOP_APP_WINDOW_SCALE, DESKTOP_GROUP_OVERLAP_THRESHOLD, DESKTOP_CANVAS_CARD_HEIGHT, DESKTOP_CANVAS_CARD_WIDTH } from './desktopConstants';
import { getDesktopGroupCardHeight } from './groupMetadata';
import { resolveDesktopCanvasEntries, getDesktopCanvasEntryHeight } from './canvasEntries';

// Converts screen-space coordinates to canvas-space given the current viewport.
export const screenToCanvas = (screenX, screenY, viewport) => ({
  x: (screenX - viewport.panX) / viewport.zoom,
  y: (screenY - viewport.panY) / viewport.zoom,
});

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

export const getDesktopCanvasOverlapEntry = (tasks, dateString, movingTaskIds, nextPosition, threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return null;

  const movingHeight = movingTasks.length > 1
    ? getDesktopGroupCardHeight(movingTasks.length)
    : DESKTOP_CANVAS_CARD_HEIGHT;
  const movingRect = {
    x: nextPosition.x,
    y: nextPosition.y,
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: movingHeight,
  };

  let bestMatch = null;
  let bestRatio = 0;
  resolveDesktopCanvasEntries(tasks, dateString).forEach((entry) => {
    const entryTaskIds = entry.type === 'group' ? entry.tasks.map((item) => item.id) : [entry.task.id];

    // Ignore this entry ONLY if we are moving the exact same set of tasks (all of them).
    // This allows pulling 1 task out of a group and then "putting it back" (overlapping with the group).
    const isMovingExactSameItems = entryTaskIds.length === movingTaskIds.size && entryTaskIds.every(id => movingTaskIds.has(id));
    if (isMovingExactSameItems) return;

    const targetWidth = DESKTOP_CANVAS_CARD_WIDTH;
    const targetHeight = getDesktopCanvasEntryHeight(entry);
    const targetArea = targetWidth * targetHeight;
    const movingArea = movingRect.width * movingRect.height;

    const overlapArea = getDesktopCanvasRectIntersectionArea(movingRect, {
      x: entry.x,
      y: entry.y,
      width: targetWidth,
      height: targetHeight,
    });

    if (overlapArea <= 0) return;

    const overlapRatio = overlapArea / Math.min(movingArea, targetArea);
    if (overlapRatio >= threshold && overlapRatio > bestRatio) {
      bestRatio = overlapRatio;
      bestMatch = entry;
    }
  });

  return bestMatch ? { entry: bestMatch, ratio: bestRatio } : null;
};