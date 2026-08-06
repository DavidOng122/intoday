import {
  DESKTOP_GROUP_CARD_BASE_HEIGHT,
  DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT,
  DESKTOP_GROUP_CARD_ITEM_HEIGHT,
  DESKTOP_GROUP_CARD_MIN_HEIGHT,
  DESKTOP_GROUP_CARD_MORE_LABEL_HEIGHT,
  DESKTOP_GROUP_CARD_ROW_GAP,
} from '../../canvas';
import { getPackIconFromTasks, getPackTagsFromTasks } from './packPageUtils';
import { CARD_TYPES, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';
import { normalizeTask } from '../../../lib/taskNormalize';

export const getDesktopGroupDisplayName = (tasks) => (
  tasks.find((task) => typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim())?.desktopGroupName
  || tasks[0]?.text
  || 'Untitled group'
);

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

  return tasks.map((task) => (
    task.desktopGroupId && (groupCounts.get(task.desktopGroupId) || 0) <= 1
      ? normalizeTask({
        ...task,
        desktopGroupId: null,
        desktopGroupName: null,
        desktopGroupIcon: null,
        desktopGroupCover: null,
        desktopGroupTags: [],
        desktopGroupActiveDurationType: null,
        desktopGroupActiveFrom: null,
        desktopGroupActiveUntil: null,
      })
      : task
  ));
};

export const getDesktopEstimatedGroupRowHeight = (task) => (
  normalizeCardType(task?.cardType) === 'photo' ? 232 : DESKTOP_GROUP_CARD_ITEM_HEIGHT
);

export const getDesktopVisibleGroupTaskCount = (tasks, maxHeight) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;

  let totalHeight = 0;
  let visibleCount = 0;
  for (let index = 0; index < tasks.length; index += 1) {
    const rowHeight = getDesktopEstimatedGroupRowHeight(tasks[index]);
    const nextHeight = totalHeight + (index > 0 ? DESKTOP_GROUP_CARD_ROW_GAP : 0) + rowHeight;
    if (visibleCount > 0 && nextHeight > maxHeight) break;
    totalHeight = nextHeight;
    visibleCount += 1;
  }

  return Math.max(1, Math.min(visibleCount, tasks.length));
};

export const getDesktopGroupListHeight = (tasks, visibleItemCount = tasks.length) => {
  if (!Array.isArray(tasks) || tasks.length === 0 || visibleItemCount <= 0) return 0;
  return tasks.slice(0, visibleItemCount).reduce((total, task, index) => (
    total + getDesktopEstimatedGroupRowHeight(task) + (index > 0 ? DESKTOP_GROUP_CARD_ROW_GAP : 0)
  ), 0);
};

export const getDesktopCollapsedGroupVisibleCount = (tasks) => (
  getDesktopVisibleGroupTaskCount(tasks, DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT)
);

export const getDesktopGroupCardHeight = (tasks, visibleItemCount = tasks?.length ?? 0) => {
  const itemCount = Array.isArray(tasks) ? tasks.length : 0;
  const visibleCount = Math.max(1, Math.min(visibleItemCount, itemCount || 1));
  const hasExtra = itemCount > visibleCount;
  const listHeight = getDesktopGroupListHeight(tasks, visibleCount);
  return Math.max(
    DESKTOP_GROUP_CARD_MIN_HEIGHT,
    DESKTOP_GROUP_CARD_BASE_HEIGHT
      + listHeight
      + (hasExtra ? DESKTOP_GROUP_CARD_MORE_LABEL_HEIGHT : 12),
  );
};
