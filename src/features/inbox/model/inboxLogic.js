import { COLLECTION_STATES } from './collectionState.js';

const PACK_FIELDS = [
  'desktopGroupName',
  'desktopGroupIcon',
  'desktopGroupCover',
  'desktopGroupTags',
  'desktopGroupActiveDurationType',
  'desktopGroupActiveFrom',
  'desktopGroupActiveUntil',
];

const findTaskIndex = (tasks, taskId) => tasks.findIndex((task) => task.id === taskId);

const requireTask = (tasks, taskId) => {
  const index = findTaskIndex(tasks, taskId);
  if (index < 0) throw new Error(`Task ${taskId} was not found`);
  return { index, task: tasks[index] };
};

const requirePosition = (position) => {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    throw new Error('A finite canvas position is required');
  }
};

const replaceAt = (tasks, index, task) => tasks.map((current, currentIndex) => (
  currentIndex === index ? task : current
));

const clearPackFields = (task) => ({
  ...task,
  desktopGroupId: null,
  desktopGroupName: null,
  desktopGroupIcon: null,
  desktopGroupCover: null,
  desktopGroupTags: [],
  desktopGroupActiveDurationType: null,
  desktopGroupActiveFrom: null,
  desktopGroupActiveUntil: null,
});

export const isInboxItem = (task) => task?.collectionState === COLLECTION_STATES.INBOX;

export const isLibraryItem = (task) => !isInboxItem(task);

export const getInboxItems = (tasks) => tasks
  .filter(isInboxItem)
  .sort((a, b) => Number(b.id) - Number(a.id));

export const getLibraryItems = (tasks) => tasks.filter(isLibraryItem);

export const getInboxCount = (tasks) => tasks.reduce(
  (count, task) => count + (isInboxItem(task) ? 1 : 0),
  0,
);

export const getInboxTargetPacks = (tasks) => {
  const packs = new Map();

  tasks.forEach((task) => {
    if (!isLibraryItem(task) || !task.desktopGroupId) return;

    const packId = task.desktopGroupId;
    const storedName = typeof task.desktopGroupName === 'string' ? task.desktopGroupName.trim() : '';
    const fallbackName = typeof task.text === 'string' ? task.text.trim() : '';
    const existing = packs.get(packId);

    if (!existing) {
      packs.set(packId, {
        id: packId,
        name: storedName || fallbackName || 'Untitled pack',
        icon: task.desktopGroupIcon || null,
        itemCount: 1,
      });
      return;
    }

    existing.itemCount += 1;
    if (storedName) existing.name = storedName;
    if (!existing.icon && task.desktopGroupIcon) existing.icon = task.desktopGroupIcon;
  });

  return [...packs.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const createInboxTask = (task) => ({
  ...clearPackFields(task),
  collectionState: COLLECTION_STATES.INBOX,
  desktopCanvasX: null,
  desktopCanvasY: null,
  desktopSlot: null,
});

export const placeInboxItem = (tasks, taskId, position, updatedAt) => {
  requirePosition(position);
  const { index, task } = requireTask(tasks, taskId);
  if (!isInboxItem(task)) throw new Error(`Task ${taskId} is not in Inbox`);

  return replaceAt(tasks, index, {
    ...clearPackFields(task),
    collectionState: COLLECTION_STATES.LIBRARY,
    desktopCanvasX: position.x,
    desktopCanvasY: position.y,
    desktopSlot: null,
    desktopZ: Number.isFinite(position.z) ? position.z : Date.now(),
    updatedAt: updatedAt ?? task.updatedAt,
  });
};

export const moveInboxItemToPack = (tasks, taskId, targetPackId, updatedAt) => {
  const { index, task } = requireTask(tasks, taskId);
  if (!isInboxItem(task)) throw new Error(`Task ${taskId} is not in Inbox`);

  const packTask = tasks.find((candidate) => (
    isLibraryItem(candidate) && candidate.desktopGroupId === targetPackId
  ));
  if (!packTask) throw new Error(`Pack ${targetPackId} was not found`);

  const inheritedPackFields = Object.fromEntries(PACK_FIELDS.map((field) => [field, packTask[field]]));
  return replaceAt(tasks, index, {
    ...task,
    ...inheritedPackFields,
    collectionState: COLLECTION_STATES.LIBRARY,
    desktopGroupId: targetPackId,
    desktopCanvasX: packTask.desktopCanvasX,
    desktopCanvasY: packTask.desktopCanvasY,
    desktopSlot: null,
    desktopZ: packTask.desktopZ,
    updatedAt: updatedAt ?? task.updatedAt,
  });
};

export const removeItemFromPack = (tasks, taskId, position, updatedAt) => {
  requirePosition(position);
  const { index, task } = requireTask(tasks, taskId);
  if (!task.desktopGroupId) throw new Error(`Task ${taskId} is not in a Pack`);

  return replaceAt(tasks, index, {
    ...clearPackFields(task),
    collectionState: COLLECTION_STATES.LIBRARY,
    desktopCanvasX: position.x,
    desktopCanvasY: position.y,
    desktopSlot: null,
    desktopZ: Number.isFinite(position.z) ? position.z : Date.now(),
    updatedAt: updatedAt ?? task.updatedAt,
  });
};
