import { DESKTOP_CANVAS_CARD_WIDTH } from './canvasConstants.js';
import { getDesktopCanvasEntryHeight } from './canvasEntries.js';

export const LEGACY_CONNECTIONS_STORAGE_KEY = 'desktop_canvas_group_connections_v1';
export const CONNECTION_SIDE_VALUES = new Set(['left', 'right']);

const normalizeId = (value) => (typeof value === 'string' ? value.trim() : String(value || '').trim());
const normalizeSide = (value, fallback) => (CONNECTION_SIDE_VALUES.has(value) ? value : fallback);
const toIsoTimestamp = (value = Date.now()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const canonicalizeEndpoints = ({ sourceGroupId, sourceSide, targetGroupId, targetSide }) => {
  const sourceId = normalizeId(sourceGroupId);
  const targetId = normalizeId(targetGroupId);
  if (!sourceId || !targetId || sourceId === targetId) return null;
  if (sourceId < targetId) {
    return {
      sourceGroupId: sourceId,
      sourceSide: normalizeSide(sourceSide, 'right'),
      targetGroupId: targetId,
      targetSide: normalizeSide(targetSide, 'left'),
    };
  }
  return {
    sourceGroupId: targetId,
    sourceSide: normalizeSide(targetSide, 'left'),
    targetGroupId: sourceId,
    targetSide: normalizeSide(sourceSide, 'right'),
  };
};

export const getDesktopConnectionId = (workspaceId, firstGroupId, secondGroupId) => {
  const workspace = normalizeId(workspaceId);
  const first = normalizeId(firstGroupId);
  const second = normalizeId(secondGroupId);
  if (!workspace || !first || !second || first === second) return null;
  const [source, target] = first < second ? [first, second] : [second, first];
  return `connection:${encodeURIComponent(workspace)}:${encodeURIComponent(source)}:${encodeURIComponent(target)}`;
};

export const normalizeDesktopConnection = (value, fallbackWorkspaceId = null) => {
  if (!value || typeof value !== 'object') return null;
  const workspaceId = normalizeId(value.workspaceId || fallbackWorkspaceId);
  const endpoints = canonicalizeEndpoints(value);
  const id = endpoints
    ? getDesktopConnectionId(workspaceId, endpoints.sourceGroupId, endpoints.targetGroupId)
    : null;
  if (!workspaceId || !endpoints || !id) return null;
  const createdAt = toIsoTimestamp(value.createdAt);
  return {
    id,
    workspaceId,
    ...endpoints,
    createdAt,
    updatedAt: toIsoTimestamp(value.updatedAt || createdAt),
  };
};

export const createDesktopConnection = ({
  workspaceId,
  sourceGroupId,
  sourceSide = 'right',
  targetGroupId,
  targetSide = 'left',
  now = Date.now(),
}) => normalizeDesktopConnection({
  workspaceId,
  sourceGroupId,
  sourceSide,
  targetGroupId,
  targetSide,
  createdAt: now,
  updatedAt: now,
});

export const dedupeDesktopConnections = (connections, workspaceId = null) => {
  const byId = new Map();
  (Array.isArray(connections) ? connections : []).forEach((connection) => {
    const normalized = normalizeDesktopConnection(connection, workspaceId);
    if (!normalized) return;
    const existing = byId.get(normalized.id);
    if (!existing || normalized.updatedAt >= existing.updatedAt) byId.set(normalized.id, normalized);
  });
  return [...byId.values()];
};

export const getWorkspaceConnections = (connections, workspaceId) => (
  dedupeDesktopConnections(connections).filter((connection) => connection.workspaceId === workspaceId)
);

export const getGroupHandleCoordinates = (entry, side = 'right') => {
  if (!entry) return { x: 0, y: 0 };
  const height = getDesktopCanvasEntryHeight(entry);
  return {
    x: side === 'left' ? entry.x : entry.x + DESKTOP_CANVAS_CARD_WIDTH,
    y: entry.y + (height / 2),
  };
};

export const findConnectionTargetAtPoint = (entries, point, {
  edgeThreshold = 30,
  verticalMargin = 24,
} = {}) => {
  if (!point) return null;
  let best = null;
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (entry?.type !== 'group') return;
    const height = getDesktopCanvasEntryHeight(entry);
    if (point.y < entry.y - verticalMargin || point.y > entry.y + height + verticalMargin) return;
    const leftDistance = Math.abs(point.x - entry.x);
    const rightDistance = Math.abs(point.x - (entry.x + DESKTOP_CANVAS_CARD_WIDTH));
    const distance = Math.min(leftDistance, rightDistance);
    if (distance > edgeThreshold || (best && best.distance <= distance)) return;
    best = {
      targetGroupId: entry.id,
      targetSide: leftDistance <= rightDistance ? 'left' : 'right',
      distance,
    };
  });
  return best;
};

export const rewireConnectionsForPackMerge = (
  connections,
  { workspaceId, sourceGroupId, targetGroupId, now = Date.now() },
) => {
  const sourceId = normalizeId(sourceGroupId);
  const targetId = normalizeId(targetGroupId);
  const updatedAt = toIsoTimestamp(now);
  const rewired = getWorkspaceConnections(connections, workspaceId).map((connection) => {
    const nextSourceId = connection.sourceGroupId === sourceId ? targetId : connection.sourceGroupId;
    const nextTargetId = connection.targetGroupId === sourceId ? targetId : connection.targetGroupId;
    if (nextSourceId === nextTargetId) return null;
    return normalizeDesktopConnection({
      ...connection,
      sourceGroupId: nextSourceId,
      targetGroupId: nextTargetId,
      updatedAt,
    });
  }).filter(Boolean);
  return dedupeDesktopConnections(rewired);
};

export const removeConnectionsForGroupIds = (connections, workspaceId, groupIds) => {
  const ids = new Set(groupIds || []);
  return getWorkspaceConnections(connections, workspaceId).filter((connection) => (
    !ids.has(connection.sourceGroupId) && !ids.has(connection.targetGroupId)
  ));
};

export const migrateLegacyConnections = ({ legacyConnections, tasks, defaultWorkspaceId }) => {
  const groupWorkspaces = new Map();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (!task?.desktopGroupId) return;
    const workspaceId = normalizeId(task.desktopWorkspaceId || defaultWorkspaceId);
    if (!workspaceId) return;
    const current = groupWorkspaces.get(task.desktopGroupId);
    if (current && current !== workspaceId) groupWorkspaces.set(task.desktopGroupId, null);
    else if (current === undefined) groupWorkspaces.set(task.desktopGroupId, workspaceId);
  });

  const migrated = (Array.isArray(legacyConnections) ? legacyConnections : []).map((connection) => {
    const sourceWorkspace = groupWorkspaces.get(connection?.sourceGroupId);
    const targetWorkspace = groupWorkspaces.get(connection?.targetGroupId);
    if (!sourceWorkspace || sourceWorkspace !== targetWorkspace) return null;
    return normalizeDesktopConnection({ ...connection, workspaceId: sourceWorkspace });
  }).filter(Boolean);
  return dedupeDesktopConnections(migrated);
};

export const applyConnectionOperations = (connections, operations, workspaceId) => {
  const byId = new Map(getWorkspaceConnections(connections, workspaceId).map((connection) => [connection.id, connection]));
  (Array.isArray(operations) ? operations : []).forEach((operation) => {
    if (operation?.workspaceId !== workspaceId) return;
    if (operation.type === 'delete') byId.delete(operation.connectionId);
    if (operation.type === 'upsert') {
      const normalized = normalizeDesktopConnection(operation.connection, workspaceId);
      if (normalized) byId.set(normalized.id, normalized);
    }
  });
  return [...byId.values()];
};

export const createConnectionOperationsForReplacement = (previous, next, workspaceId) => {
  const previousById = new Map(getWorkspaceConnections(previous, workspaceId).map((connection) => [connection.id, connection]));
  const nextById = new Map(getWorkspaceConnections(next, workspaceId).map((connection) => [connection.id, connection]));
  const operations = [];
  previousById.forEach((connection, id) => {
    if (!nextById.has(id)) operations.push({ type: 'delete', workspaceId, connectionId: id });
  });
  nextById.forEach((connection, id) => {
    if (previousById.get(id)?.updatedAt !== connection.updatedAt) {
      operations.push({ type: 'upsert', workspaceId, connection });
    }
  });
  return operations;
};
