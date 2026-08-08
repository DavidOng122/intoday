import {
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
  DESKTOP_GROUP_OVERLAP_THRESHOLD,
} from './canvasConstants';
import { getDesktopCollapsedGroupVisibleCount, getDesktopGroupCardHeight } from '../../pack';
import { isFiniteCanvasCoordinate } from '../../../lib/domUtils';
import { expandDesktopCanvasRect, getRectCenterPoint, getDesktopCanvasRectIntersectionArea, isDesktopCanvasPointInsideRect } from './canvasGeometry';
import { getDesktopCanvasTaskHeight } from '../../../lib/taskOrder';

export const getDefaultDesktopCanvasPosition = (index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: column * (DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP),
    y: row * (DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP),
  };
};

export const getDesktopCanvasEntryHeight = (entry) => (
  entry?.type === 'group'
    ? getDesktopGroupCardHeight(entry.tasks, getDesktopCollapsedGroupVisibleCount(entry.tasks))
    : getDesktopCanvasTaskHeight(entry?.task)
);

export const getCanvasEntryIdentity = (entry) => (
  entry?.type === 'group' ? entry.id : entry?.task?.id
);

export const getDesktopCanvasEntryTaskIds = (entry) => (
  entry?.type === 'group'
    ? entry.tasks.map((task) => task.id)
    : entry?.task?.id !== undefined && entry?.task?.id !== null
      ? [entry.task.id]
      : []
);

export const resolveDesktopCanvasEntries = (tasks) => {
  const selectedTasks = tasks.slice().sort((a, b) => {
    const layerA = Number.isFinite(a.desktopZ) ? a.desktopZ : 0;
    const layerB = Number.isFinite(b.desktopZ) ? b.desktopZ : 0;
    return layerA - layerB || Number(a.id) - Number(b.id);
  });
  const processedGroupIds = new Set();

  const entries = selectedTasks.reduce((resolvedEntries, task, index) => {
    const fallback = getDefaultDesktopCanvasPosition(index);
    if (task.desktopGroupId) {
      if (processedGroupIds.has(task.desktopGroupId)) return resolvedEntries;
      const groupedTasks = selectedTasks.filter((item) => item.desktopGroupId === task.desktopGroupId);
      if (groupedTasks.length > 0) {
        processedGroupIds.add(task.desktopGroupId);
        const anchorTask = groupedTasks.find((item) => (
          isFiniteCanvasCoordinate(item.desktopCanvasX) && isFiniteCanvasCoordinate(item.desktopCanvasY)
        )) || task;
        resolvedEntries.push({
          type: 'group',
          id: task.desktopGroupId,
          task: groupedTasks[0],
          tasks: groupedTasks,
          x: isFiniteCanvasCoordinate(anchorTask.desktopCanvasX) ? anchorTask.desktopCanvasX : fallback.x,
          y: isFiniteCanvasCoordinate(anchorTask.desktopCanvasY) ? anchorTask.desktopCanvasY : fallback.y,
        });
        return resolvedEntries;
      }
    }

    resolvedEntries.push({
      type: 'task',
      task,
      x: isFiniteCanvasCoordinate(task.desktopCanvasX) ? task.desktopCanvasX : fallback.x,
      y: isFiniteCanvasCoordinate(task.desktopCanvasY) ? task.desktopCanvasY : fallback.y,
    });
    return resolvedEntries;
  }, []);

  const occupiedPositions = new Set();
  let maxBottom = 0;
  return entries.map((entry) => {
    const positionKey = `${Number(entry.x).toFixed(1)}:${Number(entry.y).toFixed(1)}`;
    const resolvedEntry = occupiedPositions.has(positionKey)
      ? { ...entry, x: 0, y: maxBottom + DESKTOP_CANVAS_CARD_GAP }
      : entry;
    occupiedPositions.add(`${Number(resolvedEntry.x).toFixed(1)}:${Number(resolvedEntry.y).toFixed(1)}`);
    maxBottom = Math.max(maxBottom, resolvedEntry.y + getDesktopCanvasEntryHeight(resolvedEntry));
    return resolvedEntry;
  });
};

export const constrainDesktopCanvasEntries = (entries, bounds) => {
  const width = Math.max(DESKTOP_CANVAS_CARD_WIDTH, Number(bounds?.width) || DESKTOP_MAIN_CONTENT_MAX_WIDTH);
  const height = Math.max(DESKTOP_CANVAS_CARD_HEIGHT, Number(bounds?.height) || DESKTOP_CANVAS_CARD_HEIGHT);

  return entries.map((entry) => ({
    ...entry,
    x: Math.min(Math.max(0, width - DESKTOP_CANVAS_CARD_WIDTH), Math.max(0, entry.x)),
    y: Math.min(
      Math.max(0, height - getDesktopCanvasEntryHeight(entry)),
      Math.max(0, entry.y),
    ),
  }));
};

export const getNextDesktopCanvasPosition = (tasks) => {
  const entries = resolveDesktopCanvasEntries(tasks);
  if (entries.length === 0) return getDefaultDesktopCanvasPosition(0);
  const maxBottom = entries.reduce((max, entry) => Math.max(max, entry.y + getDesktopCanvasEntryHeight(entry)), 0);
  return { x: 0, y: maxBottom + DESKTOP_CANVAS_CARD_GAP };
};

export const getDesktopCanvasResolvedPosition = (tasks, movingTaskIds, preferredPosition) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return preferredPosition;

  const maxX = Math.max(0, DESKTOP_MAIN_CONTENT_MAX_WIDTH - DESKTOP_CANVAS_CARD_WIDTH);
  const clampedX = Math.max(0, Math.min(maxX, preferredPosition.x));
  const stepY = DESKTOP_CANVAS_CARD_GAP + 12;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = { x: clampedX, y: Math.max(0, preferredPosition.y + (attempt * stepY)) };
    const result = getDesktopCanvasOverlapEntry(tasks, movingTaskIds, candidate, 0.01);
    if (!result) return candidate;
    preferredPosition = {
      x: result.entry.x,
      y: result.entry.y + getDesktopCanvasEntryHeight(result.entry) + DESKTOP_CANVAS_CARD_GAP,
    };
  }

  return { x: clampedX, y: Math.max(0, preferredPosition.y) };
};


export const getDesktopCanvasOverlapEntry = (
  tasks,
  movingTaskIds,
  nextPosition,
  threshold = DESKTOP_GROUP_OVERLAP_THRESHOLD,
) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return null;

  const movingHeight = movingTasks.length > 1
    ? getDesktopGroupCardHeight(movingTasks, getDesktopCollapsedGroupVisibleCount(movingTasks))
    : DESKTOP_CANVAS_CARD_HEIGHT;
  const movingRect = {
    x: nextPosition.x,
    y: nextPosition.y,
    width: DESKTOP_CANVAS_CARD_WIDTH,
    height: movingHeight,
  };
  const movingHitRect = expandDesktopCanvasRect(movingRect);
  const movingCenter = getRectCenterPoint(movingRect);

  let bestMatch = null;
  let bestRatio = 0;
  resolveDesktopCanvasEntries(tasks).forEach((entry) => {
    const entryTaskIds = entry.type === 'group' ? entry.tasks.map((item) => item.id) : [entry.task.id];
    const isMovingExactSameItems = entryTaskIds.length === movingTaskIds.size
      && entryTaskIds.every((id) => movingTaskIds.has(id));
    if (isMovingExactSameItems) return;

    const targetRect = {
      x: entry.x,
      y: entry.y,
      width: DESKTOP_CANVAS_CARD_WIDTH,
      height: getDesktopCanvasEntryHeight(entry),
    };
    const targetHitRect = expandDesktopCanvasRect(targetRect);
    const targetCenter = getRectCenterPoint(targetRect);
    const overlapArea = getDesktopCanvasRectIntersectionArea(movingHitRect, targetHitRect);
    const movingCenterInsideTarget = isDesktopCanvasPointInsideRect(movingCenter, targetHitRect);
    const targetCenterInsideMoving = isDesktopCanvasPointInsideRect(targetCenter, movingHitRect);
    if (overlapArea <= 0 && !movingCenterInsideTarget && !targetCenterInsideMoving) return;

    const movingArea = Math.max(1, movingRect.width * movingRect.height);
    const targetArea = Math.max(1, targetRect.width * targetRect.height);
    const movingCoverageRatio = overlapArea / movingArea;
    const targetCoverageRatio = overlapArea / targetArea;
    const overlapRatio = Math.max(movingCoverageRatio, targetCoverageRatio);
    const qualifies = movingCoverageRatio >= threshold
      || targetCoverageRatio >= threshold
      || movingCenterInsideTarget
      || targetCenterInsideMoving;
    if (qualifies && overlapRatio >= bestRatio) {
      bestRatio = overlapRatio;
      bestMatch = entry;
    }
  });

  return bestMatch ? { entry: bestMatch, ratio: bestRatio } : null;
};
