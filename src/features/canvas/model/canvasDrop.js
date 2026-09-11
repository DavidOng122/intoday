import { normalizeTask } from '../../../lib/taskNormalize.js';

export const CANVAS_DROP_ACTIONS = {
  MOVE: 'MOVE',
  RETURN_TO_PACK: 'RETURN_TO_PACK',
  PROMPT_GROUP: 'PROMPT_GROUP',
};

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
