import { DESKTOP_GROUP_CARD_MIN_HEIGHT, DESKTOP_GROUP_CARD_ITEM_HEIGHT } from './desktopConstants';
import { deriveTaskDisplayTitle } from './taskDisplayUtils';
import { getPackMetadataTextFromItems } from './packMetadata';
import { getPackIconFromTasks, getPackTagsFromTasks } from './packPageUtils';
import { normalizeCardType } from '../taskCardUtils';
import { normalizeTask } from './taskNormalize';

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

export const getDesktopGroupCardHeight = (itemCount, visibleItemCount = itemCount, actualContentHeight = null) => {
  if (typeof actualContentHeight === 'number') {
    return Math.max(DESKTOP_GROUP_CARD_MIN_HEIGHT, actualContentHeight + 12);
  }
  const visibleCount = Math.max(1, Math.min(visibleItemCount, itemCount));
  const hasExtra = itemCount > visibleCount;
  const padding = hasExtra ? 20 : 12;
  return Math.max(
    DESKTOP_GROUP_CARD_MIN_HEIGHT,
    70 + (visibleCount * DESKTOP_GROUP_CARD_ITEM_HEIGHT) + padding,
  );
};