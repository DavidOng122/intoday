// A merge confirmation is intentionally limited to Pack-on-Pack drops.
// Ordinary task movement and task-on-task overlap should only change position.
export const shouldPromptForPackMerge = ({ isGroupDrag, overlapEntry }) => (
  isGroupDrag === true && overlapEntry?.type === 'group'
);

export const isDroppingBackIntoOriginalPack = ({ movingTasks, overlapEntry }) => (
  overlapEntry?.type === 'group'
  && movingTasks.length > 0
  && movingTasks.every((task) => task.desktopGroupId === overlapEntry.id)
);
