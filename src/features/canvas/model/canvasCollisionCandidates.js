import { resolveDesktopCanvasEntries } from './canvasEntries.js';
import { getCanvasEntryIdentity } from './canvasEntryIdentity.js';

export const getCanvasRectFromClientRect = (rect, getCanvasPointFromClient) => {
  if (!rect) return null;
  const topLeft = getCanvasPointFromClient(rect.left, rect.top);
  const bottomRight = getCanvasPointFromClient(rect.right, rect.bottom);
  if (!topLeft || !bottomRight) return null;
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(0, bottomRight.x - topLeft.x),
    height: Math.max(0, bottomRight.y - topLeft.y),
  };
};

export const buildCanvasCollisionCandidates = (tasks, getCanvasPointFromClient) => {
  const entryNodes = new Map(
    [...document.querySelectorAll('.desktop-canvas-card-node[data-desktop-entry-id]')]
      .map((node) => [node.dataset.desktopEntryId, node]),
  );
  return resolveDesktopCanvasEntries(tasks).map((entry) => {
    const node = entryNodes.get(String(getCanvasEntryIdentity(entry)));
    if (!node) return null;
    return {
      entry,
      rect: getCanvasRectFromClientRect(node.getBoundingClientRect(), getCanvasPointFromClient),
    };
  }).filter((candidate) => candidate?.rect);
};
