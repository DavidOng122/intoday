import { normalizeTask } from '../../../lib/taskNormalize.js';
import { resolvePackMetadata } from '../../../entities/pack/model/packSelectors.js';
import { getDesktopGroupDisplayTags } from '../../pack/model/groupMetadata.js';

export const CANVAS_DROP_ACTIONS = {
  MOVE: 'MOVE',
  RETURN_TO_PACK: 'RETURN_TO_PACK',
  PROMPT_GROUP: 'PROMPT_GROUP',
  APPLY_PACK: 'APPLY_PACK',
  CANCEL_PACK_MERGE: 'CANCEL_PACK_MERGE',
};

export const createPackDropAction = ({ prompt, groupName, tasks, updatedAt, timestamp }) => {
  const isMergePacks = prompt?.mode === 'merge-packs';
  const groupedTaskIds = [...new Set([
    ...(prompt?.movingTaskIds || []),
    ...(prompt?.targetTaskIds || []),
  ])];
  const groupedIdSet = new Set(groupedTaskIds);
  const groupedTasks = tasks.filter((task) => groupedIdSet.has(task.id));
  const targetTasks = tasks.filter((task) => (prompt?.targetTaskIds || []).includes(task.id));
  const targetMetadata = isMergePacks && targetTasks.length > 0
    ? resolvePackMetadata(targetTasks)
    : null;

  return {
    type: CANVAS_DROP_ACTIONS.APPLY_PACK,
    taskIds: groupedTaskIds,
    groupId: prompt?.groupId,
    dateString: targetMetadata?.dateString || prompt?.targetDateKey,
    position: roundedPosition({ x: prompt?.overlapX || 0, y: prompt?.overlapY || 0 }),
    timestamp,
    updatedAt,
    metadata: targetMetadata || {
      desktopGroupName: groupName.trim() || 'New group',
      desktopGroupIcon: null,
      desktopGroupCover: null,
      desktopGroupTags: getDesktopGroupDisplayTags(groupedTasks),
      desktopGroupActiveDurationType: null,
      desktopGroupActiveFrom: null,
      desktopGroupActiveUntil: null,
    },
  };
};

export const createCancelledPackMergeAction = (prompt, timestamp) => ({
  type: CANVAS_DROP_ACTIONS.CANCEL_PACK_MERGE,
  taskIds: prompt?.movingTaskIds || [],
  position: prompt?.fallbackPosition ? roundedPosition(prompt.fallbackPosition) : null,
  timestamp,
});

const roundedPosition = (position) => ({
  x: Number(position.x.toFixed(1)),
  y: Number(position.y.toFixed(1)),
});

export const calculateCanvasDrop = ({
  draggedIds,
  originPositions,
  previewPositions,
  activeDateKey,
  timestamp,
  detachFromPack,
  overlapEntry,
  isReturningToPack,
}) => {
  const positions = Object.fromEntries(draggedIds.map((id) => [
    id,
    roundedPosition(previewPositions[id] || originPositions[id]),
  ]));

  const move = {
    type: CANVAS_DROP_ACTIONS.MOVE,
    draggedIds,
    positions,
    activeDateKey,
    timestamp,
    detachFromPack,
  };

  if (isReturningToPack && overlapEntry) {
    const position = roundedPosition({ x: overlapEntry.x, y: overlapEntry.y });
    return {
      type: CANVAS_DROP_ACTIONS.RETURN_TO_PACK,
      draggedIds,
      positions: Object.fromEntries(draggedIds.map((id) => [id, position])),
      activeDateKey,
      timestamp,
    };
  }

  return overlapEntry
    ? { type: CANVAS_DROP_ACTIONS.PROMPT_GROUP, move, overlapEntry }
    : move;
};

export const reduceCanvasDrop = (tasks, action) => {
  if (action?.type === CANVAS_DROP_ACTIONS.APPLY_PACK) {
    const taskIds = new Set(action.taskIds);
    return tasks.map((task) => (
      taskIds.has(task.id)
        ? normalizeTask({
          ...task,
          dateString: action.dateString,
          updatedAt: action.updatedAt,
          desktopSlot: null,
          desktopCanvasX: action.position.x,
          desktopCanvasY: action.position.y,
          desktopGroupId: action.groupId,
          ...action.metadata,
          desktopZ: action.timestamp,
        })
        : task
    ));
  }
  if (action?.type === CANVAS_DROP_ACTIONS.CANCEL_PACK_MERGE && action.position) {
    const taskIds = new Set(action.taskIds);
    return tasks.map((task) => (
      taskIds.has(task.id)
        ? normalizeTask({
          ...task,
          desktopCanvasX: action.position.x,
          desktopCanvasY: action.position.y,
          desktopZ: action.timestamp,
        })
        : task
    ));
  }
  if (!action || ![CANVAS_DROP_ACTIONS.MOVE, CANVAS_DROP_ACTIONS.RETURN_TO_PACK].includes(action.type)) {
    return tasks;
  }
  const movingIds = new Set(action.draggedIds);
  return tasks.map((task) => {
    if (!movingIds.has(task.id)) return task;
    const position = action.positions[task.id];
    if (!position) return task;
    const clearPack = action.type === CANVAS_DROP_ACTIONS.MOVE && action.detachFromPack;
    return normalizeTask({
      ...task,
      ...(clearPack ? {
        desktopGroupId: null,
        desktopGroupName: null,
        desktopGroupIcon: null,
        desktopGroupTags: [],
        desktopGroupCover: null,
      } : {}),
      dateString: action.activeDateKey,
      desktopSlot: null,
      desktopCanvasX: position.x,
      desktopCanvasY: position.y,
      desktopZ: action.timestamp,
    });
  });
};
