import { DESKTOP_CANVAS_MIN_SCALE, DESKTOP_CANVAS_MAX_SCALE } from './desktopConstants';

export const isValidDesktopSlot = (value) => Number.isInteger(value) && value >= 0;

export const isFiniteCanvasCoordinate = (value) => Number.isFinite(value) && value >= 0;

export const isEditableElement = (target) => (
  target instanceof HTMLElement
  && Boolean(target.closest('input, textarea, button, select, [contenteditable="true"], [role="dialog"]'))
);

export const clampDesktopCanvasScale = (value) => Math.min(DESKTOP_CANVAS_MAX_SCALE, Math.max(DESKTOP_CANVAS_MIN_SCALE, value));

export const getCanvasDeletionSummary = (tasks, selectedTaskIds) => {
  const selectedTaskIdSet = new Set(selectedTaskIds);
  const selectedTasks = tasks.filter((task) => selectedTaskIdSet.has(task.id));
  if (!selectedTasks.length) return null;

  const groupMembership = tasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());
  const selectedGroupCounts = selectedTasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());

  let packCount = 0;
  let looseItemCount = 0;
  selectedTasks.forEach((task) => {
    if (!task.desktopGroupId) {
      looseItemCount += 1;
      return;
    }
    if (selectedGroupCounts.get(task.desktopGroupId) === groupMembership.get(task.desktopGroupId)) {
      if (task.id === selectedTasks.find((item) => item.desktopGroupId === task.desktopGroupId)?.id) {
        packCount += 1;
      }
      return;
    }
    looseItemCount += 1;
  });

  let title = 'Delete selected objects?';
  if (packCount === 0) {
    title = looseItemCount === 1
      ? 'Delete this item?'
      : `Delete ${looseItemCount} selected items?`;
  } else if (looseItemCount === 0) {
    title = packCount === 1
      ? 'Delete this pack and its contents?'
      : `Delete ${packCount} selected packs and their contents?`;
  } else {
    const itemLabel = `${looseItemCount} ${looseItemCount === 1 ? 'item' : 'items'}`;
    const packLabel = `${packCount} ${packCount === 1 ? 'pack' : 'packs'}`;
    title = `Delete ${itemLabel} and ${packLabel}?`;
  }

  return {
    title,
    packCount,
    looseItemCount,
    taskIds: selectedTasks.map((task) => task.id),
  };
};