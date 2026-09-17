import { getDesktopCanvasEntryTaskIds } from './canvasEntries.js';
import { getCanvasDragTaskIds } from './canvasDragSession.js';

// Converts the rendered Canvas selection into one stable drag-session snapshot.
// No DOM or React state is changed here, so this can be reused/tested separately.
export const buildCanvasDragStart = ({
  task,
  entries,
  tasks,
  sourceCanvasPosition,
}) => {
  const isGroup = !!task.isGroupInitiator;
  // Canvas selection is intentionally for batch delete only.  Using it here
  // meant a stale box-selection could silently replace the card the user was
  // actually dragging, producing a detached preview for the wrong item.
  const movingTaskIds = getCanvasDragTaskIds(task);
  const entryPositionMap = new Map();
  entries.forEach((entry) => {
    getDesktopCanvasEntryTaskIds(entry).forEach((taskId) => {
      entryPositionMap.set(taskId, { x: entry.x, y: entry.y });
    });
  });
  const anchorPosition = entryPositionMap.get(task.id) || sourceCanvasPosition || { x: 0, y: 0 };
  const originPositions = new Map(movingTaskIds.map((taskId) => [
    taskId,
    entryPositionMap.get(taskId) || anchorPosition,
  ]));
  const anchorEntry = entries.find((entry) => getDesktopCanvasEntryTaskIds(entry).includes(task.id)) || null;
  const isDetachedGroupTask = !isGroup && !!task.desktopGroupId && movingTaskIds.length === 1;
  const resolvedTask = tasks.find((candidate) => candidate.id === task.id) || task;
  const resolvedGroupTasks = anchorEntry?.type === 'group'
    ? anchorEntry.tasks
    : tasks.filter((candidate) => Array.isArray(task.groupTaskIds) && task.groupTaskIds.includes(candidate.id));

  return {
    anchorEntry,
    anchorPosition,
    isDetachedGroupTask,
    isGroup,
    movingTaskIds,
    originPositions,
    overlaySnapshot: {
      taskId: task.id,
      type: isGroup ? 'group' : 'task',
      baseX: anchorPosition.x,
      baseY: anchorPosition.y,
      task: isGroup ? null : { ...resolvedTask },
      tasks: isGroup ? resolvedGroupTasks.map((item) => ({ ...item })) : null,
    },
  };
};
