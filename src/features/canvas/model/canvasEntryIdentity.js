export const getCanvasEntryIdentity = (entry) => (
  entry?.type === 'group' ? entry.id : entry?.task?.id
);
