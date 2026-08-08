import {
  DESKTOP_GROUP_CARD_BASE_HEIGHT,
  DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT,
  DESKTOP_GROUP_CARD_ITEM_HEIGHT,
  DESKTOP_GROUP_CARD_MIN_HEIGHT,
  DESKTOP_GROUP_CARD_MORE_LABEL_HEIGHT,
  DESKTOP_GROUP_CARD_ROW_GAP,
} from '../../canvas/model/canvasConstants.js';
import { getPackIconFromTasks, getPackTagsFromTasks } from './packPageUtils.js';
import { CARD_TYPES, normalizeCardType } from '../../../entities/task/model/taskCardPresentation.js';
import { normalizeTask } from '../../../lib/taskNormalize.js';
import { getDesktopGroupDisplayName, getPackDisplayName } from '../../../entities/pack/index.js';

export { getDesktopGroupDisplayName, getPackDisplayName };

export const getDesktopGroupIcon = (tasks) => getPackIconFromTasks(tasks);

export const getDesktopGroupTags = (tasks) => getPackTagsFromTasks(tasks);

export const getDesktopGroupDisplayTags = (tasks) => {
  const storedTags = getDesktopGroupTags(tasks);
  if (storedTags.length > 0) return storedTags;
  return getDesktopGroupChips(tasks);
};

export const getDesktopGroupChips = (tasks) => {
  const uniqueTypes = [...new Set(tasks.map((task) => normalizeCardType(task.cardType)).filter(Boolean))];
  if (uniqueTypes.length === 0) return [];
  if (uniqueTypes.length > 1) {
    return ['Mixed Content', formatDesktopGroupChipLabel(uniqueTypes[0])];
  }
  return [formatDesktopGroupChipLabel(uniqueTypes[0])];
};

export const formatDesktopGroupChipLabel = (value) => {
  if (!value) return '';
  if (value === 'text') return 'Note';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const getSuggestedDesktopGroupName = (movingTasks, overlapEntry) => {
  const overlapTasks = overlapEntry?.type === 'group' ? overlapEntry.tasks : overlapEntry?.task ? [overlapEntry.task] : [];
  const existingName = getDesktopGroupDisplayName([...movingTasks, ...overlapTasks]);
  return existingName || 'New group';
};

export const cleanupDesktopGroupMetadata = (tasks) => {
  const groupCounts = tasks.reduce((map, task) => {
    if (!task.desktopGroupId) return map;
    map.set(task.desktopGroupId, (map.get(task.desktopGroupId) || 0) + 1);
    return map;
  }, new Map());

  return tasks.map((task) => {
    if (!task.desktopGroupId) return task;
    if ((groupCounts.get(task.desktopGroupId) || 0) <= 1) {
      return normalizeTask({
        ...task,
        desktopGroupId: null,
        desktopGroupName: null,
        desktopGroupIcon: null,
        desktopGroupCover: null,
        desktopGroupTags: [],
      });
    }
    return task;
  });
};

export const getDesktopEstimatedGroupRowHeight = (task) => {
  const normalizedType = normalizeCardType(task?.cardType);
  if (normalizedType === CARD_TYPES.PHOTO) return 40;
  return DESKTOP_GROUP_CARD_ITEM_HEIGHT;
};

export const getDesktopGroupListHeight = (tasks, visibleItemCount = tasks?.length ?? 0) => {
  if (!tasks || tasks.length === 0 || visibleItemCount <= 0) return 0;
  const visibleTasks = tasks.slice(0, visibleItemCount);
  const rowsHeight = visibleTasks.reduce((sum, task) => sum + getDesktopEstimatedGroupRowHeight(task), 0);
  const gapsHeight = Math.max(0, visibleTasks.length - 1) * DESKTOP_GROUP_CARD_ROW_GAP;
  return rowsHeight + gapsHeight;
};

export const getDesktopGroupCardHeight = (tasks, visibleItemCount = tasks?.length ?? 0) => {
  if (!tasks || tasks.length === 0) return DESKTOP_GROUP_CARD_MIN_HEIGHT;
  const listHeight = getDesktopGroupListHeight(tasks, visibleItemCount);
  const showMoreLabel = tasks.length > visibleItemCount;
  const extraLabelHeight = showMoreLabel ? DESKTOP_GROUP_CARD_MORE_LABEL_HEIGHT : 0;
  const calculatedHeight = DESKTOP_GROUP_CARD_BASE_HEIGHT + listHeight + extraLabelHeight;
  return Math.max(DESKTOP_GROUP_CARD_MIN_HEIGHT, Math.min(DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT, calculatedHeight));
};

export const getDesktopVisibleGroupTaskCount = (tasks, maxHeight = DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT) => {
  if (!tasks || tasks.length === 0) return 0;
  let currentHeight = DESKTOP_GROUP_CARD_BASE_HEIGHT;
  let count = 0;

  for (let index = 0; index < tasks.length; index += 1) {
    const itemHeight = getDesktopEstimatedGroupRowHeight(tasks[index]);
    const gap = index > 0 ? DESKTOP_GROUP_CARD_ROW_GAP : 0;
    const isLast = index === tasks.length - 1;
    const extraLabel = isLast ? 0 : DESKTOP_GROUP_CARD_MORE_LABEL_HEIGHT;
    const nextHeight = currentHeight + itemHeight + gap + extraLabel;

    if (nextHeight <= maxHeight || count === 0) {
      currentHeight += itemHeight + gap;
      count += 1;
    } else {
      break;
    }
  }

  return Math.max(1, Math.min(tasks.length, count));
};
