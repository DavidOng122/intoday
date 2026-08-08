import { DESKTOP_CANVAS_CARD_WIDTH } from './canvasConstants.js';
import { getDesktopCanvasEntryHeight } from './canvasEntries.js';

export const STORAGE_KEY_CONNECTIONS = 'desktop_canvas_group_connections_v1';

export const loadDesktopConnections = () => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveDesktopConnections = (connections) => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
  } catch (error) {
    console.error('Failed to save desktop connections:', error);
  }
};

export const getGroupHandleCoordinates = (entry, side = 'right') => {
  if (!entry) return { x: 0, y: 0 };
  const height = getDesktopCanvasEntryHeight(entry);
  const x = side === 'left' ? entry.x : entry.x + DESKTOP_CANVAS_CARD_WIDTH;
  const y = entry.y + (height / 2);
  return { x, y };
};

export const createDesktopConnection = ({
  sourceGroupId,
  sourceSide = 'right',
  targetGroupId,
  targetSide = 'left',
  dateKey,
}) => ({
  id: `connection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sourceGroupId,
  sourceSide,
  targetGroupId,
  targetSide,
  dateKey,
  createdAt: Date.now(),
});
