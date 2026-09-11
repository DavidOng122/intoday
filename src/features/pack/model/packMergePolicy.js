// This is evaluated only from the drag-end handler. An overlap entry already means
// the card has passed the canvas collision threshold, so free movement never opens
// a dialog. A task-on-task (or task-on-Pack) drop creates a Pack; Pack-on-Pack
// uses the merge mode below.
export const shouldPromptForGroupDrop = ({ overlapEntry }) => Boolean(overlapEntry);

export const shouldPromptForPackMerge = ({ isGroupDrag, overlapEntry }) => (
  isGroupDrag === true && overlapEntry?.type === 'group'
);

export const isDroppingBackIntoOriginalPack = ({ movingTasks, overlapEntry }) => (
  overlapEntry?.type === 'group'
  && movingTasks.length > 0
  && movingTasks.every((task) => task.desktopGroupId === overlapEntry.id)
);
