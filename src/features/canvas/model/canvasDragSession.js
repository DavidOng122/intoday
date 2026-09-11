export const getCanvasDragTaskIds = (task) => (
  Array.isArray(task?.groupTaskIds) && task.groupTaskIds.length > 0
    ? task.groupTaskIds
    : task?.id !== undefined && task?.id !== null
      ? [task.id]
      : []
);

export const createCanvasDragSession = ({ pointerId, type, draggedIds, startPointer, originPositions }) => ({
  pointerId,
  type,
  draggedIds,
  startPointer: { ...startPointer },
  originPositions: Object.fromEntries(originPositions),
  previewPositions: Object.fromEntries(originPositions),
  collisionTargetId: null,
});

export const getCanvasPreviewPositions = ({ draggedIds, originPositions, delta }) => (
  Object.fromEntries(draggedIds.map((id) => {
    const origin = originPositions.get(id);
    return [id, { x: origin.x + delta.x, y: origin.y + delta.y }];
  }))
);
