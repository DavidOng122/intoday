import { DESKTOP_BASE_SLOT_COUNT, DAY_TASK_TIME_ORDER, DESKTOP_PHOTO_CARD_HEIGHT, DESKTOP_CANVAS_CARD_HEIGHT } from './desktopConstants';
import { normalizeCardType, CARD_TYPES } from '../taskCardUtils';

export const resolveDesktopSectionSlots = (tasks) => {
  const slots = Array.from({ length: getDesktopSlotCapacity(tasks) }, () => null);
  const orderedTasks = tasks
    .map((task, index) => ({
      task,
      index,
      preferredSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
    }))
    .sort((a, b) => {
      const aHasSlot = a.preferredSlot !== null;
      const bHasSlot = b.preferredSlot !== null;
      if (aHasSlot && bHasSlot) {
        return a.preferredSlot - b.preferredSlot || a.index - b.index;
      }
      if (aHasSlot) return -1;
      if (bHasSlot) return 1;
      return a.index - b.index;
    });

  orderedTasks.forEach(({ task, preferredSlot }) => {
    let slot = preferredSlot;
    if (slot === null || slots[slot]) {
      slot = slots.findIndex((entry) => entry === null);
    }
    slots[slot] = normalizeTask({ ...task, desktopSlot: slot });
  });

  return { slots };
};

export const getDesktopSlotCapacity = (tasks) => {
  const preferredSlotCount = tasks.reduce((max, task) => (
    isValidDesktopSlot(task.desktopSlot) ? Math.max(max, task.desktopSlot + 1) : max
  ), 0);
  const itemCount = Math.max(tasks.length, preferredSlotCount);
  return Math.max(
    DESKTOP_BASE_SLOT_COUNT,
    itemCount <= DESKTOP_BASE_SLOT_COUNT ? DESKTOP_BASE_SLOT_COUNT : Math.ceil(itemCount / 2) * 2,
  );
};

export const getFirstAvailableDesktopSlot = (tasks, dateString, timeOfDay) => {
  const { slots } = resolveDesktopSectionSlots(
    tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay),
  );
  const index = slots.findIndex((task) => task === null);
  return index === -1 ? null : index;
};

export const getDesktopSectionTaskOrder = (tasks, dateString, timeOfDay) => {
  const sectionTasks = tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay);
  const { slots } = resolveDesktopSectionSlots(sectionTasks);
  return slots.filter(Boolean);
};

export const getDayTaskOrder = (tasks, dateString) => tasks
  .map((task, index) => ({ task, index }))
  .filter(({ task }) => task.dateString === dateString)
  .sort((a, b) => {
    const timeRankA = DAY_TASK_TIME_ORDER.indexOf(a.task.timeOfDay);
    const timeRankB = DAY_TASK_TIME_ORDER.indexOf(b.task.timeOfDay);
    const normalizedTimeRankA = timeRankA === -1 ? DAY_TASK_TIME_ORDER.length : timeRankA;
    const normalizedTimeRankB = timeRankB === -1 ? DAY_TASK_TIME_ORDER.length : timeRankB;
    const slotA = isValidDesktopSlot(a.task.desktopSlot) ? a.task.desktopSlot : Number.POSITIVE_INFINITY;
    const slotB = isValidDesktopSlot(b.task.desktopSlot) ? b.task.desktopSlot : Number.POSITIVE_INFINITY;

    return normalizedTimeRankA - normalizedTimeRankB || slotA - slotB || a.index - b.index;
  })
  .map(({ task }) => task);

export const getDesktopCanvasTaskHeight = (task) => (
  normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO
    ? DESKTOP_PHOTO_CARD_HEIGHT
    : DESKTOP_CANVAS_CARD_HEIGHT
);

export const getDesktopDragTaskIds = (task) => (
  task?.isGroupInitiator && Array.isArray(task?.groupTaskIds) && task.groupTaskIds.length > 0
    ? task.groupTaskIds
    : task?.id !== undefined && task?.id !== null
      ? [task.id]
      : []
);