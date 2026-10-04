export const filterCanvasFlowDragChanges = (changes, activeNodeId) => (
  activeNodeId === null
    ? changes
    : changes.filter((change) => change.type !== 'position' || change.id === activeNodeId)
);
