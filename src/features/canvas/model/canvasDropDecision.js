import { getPackDisplayName } from '../../../entities/pack/model/packSelectors.js';
import { getSuggestedDesktopGroupName } from '../../pack/model/groupMetadata.js';
import {
  isDroppingBackIntoOriginalPack,
  shouldPromptForGroupDrop,
  shouldPromptForPackMerge,
} from '../../pack/model/packMergePolicy.js';
import { DESKTOP_CANVAS_CARD_GAP } from './canvasConstants.js';
import { getDesktopCanvasEntryHeight, getDesktopCanvasResolvedPosition } from './canvasEntries.js';
import { calculateCanvasDrop } from './canvasDrop.js';

// Turns a measured collision into a state transition decision. It does not
// mutate tasks, show a modal, or persist anything.
export const decideCanvasDrop = ({
  tasks,
  movingTaskIds,
  originPositions,
  anchorPosition,
  nextPosition,
  delta,
  activeDateKey,
  timestamp,
  isGroupDrag,
  isDetachedGroupTask,
  overlapEntry,
}) => {
  const taskIds = [...movingTaskIds];
  const isMultiDrag = taskIds.length > 1;
  const movingTasks = tasks.filter((task) => movingTaskIds.has(task.id));
  const isPutBack = isDroppingBackIntoOriginalPack({ movingTasks, overlapEntry });
  const shouldPrompt = shouldPromptForGroupDrop({ overlapEntry }) && !isPutBack;
  const previewPositions = Object.fromEntries(taskIds.map((id) => {
    const origin = originPositions[id] || anchorPosition;
    return [id, isDetachedGroupTask ? nextPosition : {
      x: origin.x + delta.x,
      y: origin.y + delta.y,
    }];
  }));
  const drop = calculateCanvasDrop({
    draggedIds: taskIds,
    originPositions,
    previewPositions,
    activeDateKey,
    timestamp,
    detachFromPack: !isGroupDrag && !isMultiDrag,
    overlapEntry,
    isReturningToPack: isPutBack,
  });

  if (!shouldPrompt) return { drop, prompt: null, suggestedGroupName: null };

  const isMergePacks = shouldPromptForPackMerge({ isGroupDrag, overlapEntry });
  const targetGroupName = overlapEntry.type === 'group'
    ? getPackDisplayName(overlapEntry.tasks)
    : null;
  return {
    drop,
    suggestedGroupName: isMergePacks
      ? targetGroupName || ''
      : getSuggestedDesktopGroupName(movingTasks, overlapEntry),
    prompt: {
      mode: isMergePacks ? 'merge-packs' : 'create-group',
      movingTaskIds: taskIds,
      targetTaskIds: overlapEntry.type === 'group'
        ? overlapEntry.tasks.map((task) => task.id)
        : [overlapEntry.task.id],
      groupId: overlapEntry.type === 'group' ? overlapEntry.id : `desktop-group-${timestamp}`,
      targetGroupName,
      targetDateKey: activeDateKey,
      overlapX: overlapEntry.x,
      overlapY: overlapEntry.y,
      dropX: nextPosition.x,
      dropY: nextPosition.y,
      fallbackPosition: getDesktopCanvasResolvedPosition(tasks, movingTaskIds, {
        x: overlapEntry.x,
        y: overlapEntry.y + getDesktopCanvasEntryHeight(overlapEntry) + DESKTOP_CANVAS_CARD_GAP,
      }),
    },
  };
};
