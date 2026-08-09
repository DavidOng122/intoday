import {
  dedupeDesktopConnections,
  LEGACY_CONNECTIONS_STORAGE_KEY,
} from '../model/canvasConnections.js';

const CONNECTIONS_STORAGE_PREFIX = 'desktop_canvas_group_connections_v2';
const PENDING_STORAGE_PREFIX = 'desktop_canvas_group_connection_operations_v1';
const MIGRATION_STORAGE_PREFIX = 'desktop_canvas_group_connections_migrated_v1';

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const getConnectionsStorageKey = (ownerId, workspaceId) => (
  `${CONNECTIONS_STORAGE_PREFIX}:${encodeURIComponent(ownerId || 'guest')}:${encodeURIComponent(workspaceId)}`
);

export const readWorkspaceConnections = (ownerId, workspaceId) => (
  dedupeDesktopConnections(readJson(getConnectionsStorageKey(ownerId, workspaceId), []), workspaceId)
);

export const writeWorkspaceConnections = (ownerId, workspaceId, connections) => (
  writeJson(
    getConnectionsStorageKey(ownerId, workspaceId),
    dedupeDesktopConnections(connections, workspaceId),
  )
);

export const readLegacyConnections = () => readJson(LEGACY_CONNECTIONS_STORAGE_KEY, []);

const getPendingStorageKey = (ownerId, workspaceId) => (
  `${PENDING_STORAGE_PREFIX}:${encodeURIComponent(ownerId || 'guest')}:${encodeURIComponent(workspaceId)}`
);

export const readPendingConnectionOperations = (ownerId, workspaceId) => {
  const value = readJson(getPendingStorageKey(ownerId, workspaceId), []);
  return Array.isArray(value) ? value : [];
};

export const writePendingConnectionOperations = (ownerId, workspaceId, operations) => (
  writeJson(getPendingStorageKey(ownerId, workspaceId), Array.isArray(operations) ? operations : [])
);

const getMigrationStorageKey = (ownerId, workspaceId) => (
  `${MIGRATION_STORAGE_PREFIX}:${encodeURIComponent(ownerId || 'guest')}:${encodeURIComponent(workspaceId)}`
);

export const hasCompletedConnectionMigration = (ownerId, workspaceId) => {
  try {
    return localStorage.getItem(getMigrationStorageKey(ownerId, workspaceId)) === 'true';
  } catch {
    return false;
  }
};

export const markConnectionMigrationComplete = (ownerId, workspaceId) => {
  try {
    localStorage.setItem(getMigrationStorageKey(ownerId, workspaceId), 'true');
    return true;
  } catch {
    return false;
  }
};
