import { DESKTOP_CANVAS_CARD_WIDTH, DESKTOP_CANVAS_CARD_GAP, DESKTOP_CANVAS_MIN_HEIGHT, DESKTOP_CANVAS_CARD_HEIGHT, DESKTOP_MAIN_CONTENT_MAX_WIDTH, DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING } from './desktopConstants';
import { getDesktopGroupCardHeight } from './groupMetadata';
import { getDesktopCanvasTaskHeight } from './taskOrder';
import { doDesktopRectsIntersect, getDesktopCanvasOverlapEntry } from './canvasGeometry';
import { isFiniteCanvasCoordinate } from './domUtils';
import { isPackActiveOnDate } from './packPageUtils';

export const resolveDesktopCanvasEntries = (tasks, dateString) => {
  const selectedTasks = tasks
    .filter((task) => isPackActiveOnDate(task, dateString))
    .sort((a, b) => {
      const layerA = Number.isFinite(a.desktopZ) ? a.desktopZ : 0;
      const layerB = Number.isFinite(b.desktopZ) ? b.desktopZ : 0;
      return layerA - layerB || Number(a.id) - Number(b.id);
    });
  const processedGroupIds = new Set();

  return selectedTasks.reduce((entries, task, index) => {
    const fallback = getDefaultDesktopCanvasPosition(index);
    if (task.desktopGroupId) {
      if (processedGroupIds.has(task.desktopGroupId)) {
        return entries;
      }
      const activeGroupTasks = selectedTasks.filter((item) => item.desktopGroupId === task.desktopGroupId);
      const groupedTasks = tasks.filter((item) => item.desktopGroupId === task.desktopGroupId);
      if (groupedTasks.length > 1) {
        processedGroupIds.add(task.desktopGroupId);
        const anchorTask = activeGroupTasks.find((item) => (
          isFiniteCanvasCoordinate(item.desktopCanvasX) && isFiniteCanvasCoordinate(item.desktopCanvasY)
        )) || groupedTasks.find((item) => (
          isFiniteCanvasCoordinate(item.desktopCanvasX) && isFiniteCanvasCoordinate(item.desktopCanvasY)
        )) || task;
        entries.push({
          type: 'group',
          id: task.desktopGroupId,
          task: groupedTasks[0],
          tasks: groupedTasks,
          x: isFiniteCanvasCoordinate(anchorTask.desktopCanvasX) ? anchorTask.desktopCanvasX : fallback.x,
          y: isFiniteCanvasCoordinate(anchorTask.desktopCanvasY) ? anchorTask.desktopCanvasY : fallback.y,
        });
        return entries;
      }
    }

    entries.push({
      type: 'task',
      task,
      x: isFiniteCanvasCoordinate(task.desktopCanvasX) ? task.desktopCanvasX : fallback.x,
      y: isFiniteCanvasCoordinate(task.desktopCanvasY) ? task.desktopCanvasY : fallback.y,
    });
    return entries;
  }, []);
};

export const getDesktopCanvasHeight = (entries) => Math.max(
  DESKTOP_CANVAS_MIN_HEIGHT,
  entries.reduce((max, entry) => Math.max(max, entry.y + getDesktopCanvasEntryHeight(entry) + 96), 0),
);

export const getNextDesktopCanvasPosition = (tasks, dateString) => {
  const entries = resolveDesktopCanvasEntries(tasks, dateString);
  if (entries.length === 0) return getDefaultDesktopCanvasPosition(0);

  const maxBottom = entries.reduce((max, entry) => Math.max(max, entry.y + getDesktopCanvasEntryHeight(entry)), 0);
  return { x: 0, y: maxBottom + DESKTOP_CANVAS_CARD_GAP };
};

export const getDesktopCanvasResolvedPosition = (tasks, dateString, movingTaskIds, preferredPosition) => {
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  if (movingTasks.length === 0) return preferredPosition;

  const movingHeight = movingTasks.length > 1
    ? getDesktopGroupCardHeight(movingTasks.length)
    : DESKTOP_CANVAS_CARD_HEIGHT;
  const maxX = Math.max(0, DESKTOP_MAIN_CONTENT_MAX_WIDTH - DESKTOP_CANVAS_CARD_WIDTH);
  const clampedX = Math.max(0, Math.min(maxX, preferredPosition.x));
  const stepY = DESKTOP_CANVAS_CARD_GAP + 12;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = {
      x: clampedX,
      y: Math.max(0, preferredPosition.y + (attempt * stepY)),
    };
    const result = getDesktopCanvasOverlapEntry(tasks, dateString, movingTaskIds, candidate, 0.01);
    if (!result) return candidate;
    const overlapEntry = result.entry;
    preferredPosition = {
      x: overlapEntry.x,
      y: overlapEntry.y + getDesktopCanvasEntryHeight(overlapEntry) + DESKTOP_CANVAS_CARD_GAP,
    };
  }

  return {
    x: clampedX,
    y: Math.max(0, preferredPosition.y),
  };
};

export const getDesktopCanvasEntryHeight = (entry) => (
  entry?.type === 'group'
    ? getDesktopGroupCardHeight(entry.tasks.length)
    : getDesktopCanvasTaskHeight(entry?.task)
);

export const getDesktopCanvasEntryTaskIds = (entry) => (
  entry?.type === 'group'
    ? entry.tasks.map((task) => task.id)
    : entry?.task?.id !== undefined && entry?.task?.id !== null
      ? [entry.task.id]
      : []
);

export const getDefaultDesktopCanvasPosition = (index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: column * (DESKTOP_CANVAS_CARD_WIDTH + DESKTOP_CANVAS_CARD_GAP),
    y: row * (DESKTOP_CANVAS_CARD_HEIGHT + DESKTOP_CANVAS_CARD_GAP),
  };
};