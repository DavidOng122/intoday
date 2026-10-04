import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createConnectionOperationsForReplacement,
  createDesktopConnection,
  migrateLegacyConnections,
  removeConnectionsForGroupIds,
  rewireConnectionsForPackMerge,
} from '../model/canvasConnections.js';
import { getPackGroupIdFromReactFlowNodeId } from '../adapters/reactFlowAdapter.js';
import {
  hasCompletedConnectionMigration,
  markConnectionMigrationComplete,
  readLegacyConnections,
  readPendingConnectionOperations,
  readWorkspaceConnections,
  writePendingConnectionOperations,
  writeWorkspaceConnections,
} from '../data/connectionStorage.js';
import {
  drainConnectionOperations,
  executeConnectionOperation,
  isConnectionCloudSyncEnabled,
  loadCloudConnections,
} from '../data/connectionRepository.js';

export const useDesktopConnections = ({
  entries,
  onStatus,
  tasks,
  userId,
  workspaceId,
}) => {
  const ownerId = userId || 'guest';
  const cloudEnabled = Boolean(userId) && isConnectionCloudSyncEnabled();
  const [connections, setConnections] = useState([]);
  const connectionsRef = useRef([]);
  const entriesRef = useRef(entries);
  const tasksRef = useRef(tasks);
  const pendingOperationsByScopeRef = useRef(new Map());
  const syncInFlightByScopeRef = useRef(new Map());
  const hydratedScopeRef = useRef(null);
  const syncErrorShownRef = useRef(false);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const flushPendingOperations = useCallback(async () => {
    const scopeKey = `${ownerId}:${workspaceId}`;
    const getPendingOperations = () => (
      pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId)
    );
    const setPendingOperations = (operations) => {
      pendingOperationsByScopeRef.current.set(scopeKey, operations);
      writePendingConnectionOperations(ownerId, workspaceId, operations);
    };
    if (!cloudEnabled || !userId) return { remaining: getPendingOperations(), error: null };
    const existingRun = syncInFlightByScopeRef.current.get(scopeKey);
    if (existingRun) return existingRun;

    const run = async () => {
      while (getPendingOperations().length > 0) {
        const queued = getPendingOperations();
        const result = await drainConnectionOperations(
          queued,
          (operation) => executeConnectionOperation(userId, operation),
        );
        const appended = getPendingOperations().slice(queued.length);
        const remaining = [...result.remaining, ...appended];
        setPendingOperations(remaining);
        if (result.error) {
          if (!syncErrorShownRef.current) {
            syncErrorShownRef.current = true;
            onStatus?.('Connection saved locally. Cloud sync will retry.');
          }
          return { ...result, remaining };
        }
        syncErrorShownRef.current = false;
      }
      return { completed: 0, remaining: [], error: null };
    };

    const runPromise = run().finally(() => {
      syncInFlightByScopeRef.current.delete(scopeKey);
    });
    syncInFlightByScopeRef.current.set(scopeKey, runPromise);
    return runPromise;
  }, [cloudEnabled, onStatus, ownerId, userId, workspaceId]);

  const enqueueOperations = useCallback((operations) => {
    if (!cloudEnabled || operations.length === 0) return;
    const scopeKey = `${ownerId}:${workspaceId}`;
    const pending = pendingOperationsByScopeRef.current.get(scopeKey)
      ?? readPendingConnectionOperations(ownerId, workspaceId);
    const nextPending = [...pending, ...operations];
    pendingOperationsByScopeRef.current.set(scopeKey, nextPending);
    writePendingConnectionOperations(ownerId, workspaceId, nextPending);
    void flushPendingOperations();
  }, [cloudEnabled, flushPendingOperations, ownerId, workspaceId]);

  useEffect(() => {
    const scopeKey = `${ownerId}:${workspaceId}`;
    if (hydratedScopeRef.current === scopeKey) return undefined;
    hydratedScopeRef.current = scopeKey;
    let cancelled = false;

    if (!userId || !cloudEnabled) {
      const stored = readWorkspaceConnections(ownerId, workspaceId);
      const migrated = stored.length > 0
        ? stored
        : migrateLegacyConnections({
          legacyConnections: readLegacyConnections(),
          tasks: tasksRef.current,
          defaultWorkspaceId: workspaceId,
        }).filter((connection) => connection.workspaceId === workspaceId);
      connectionsRef.current = migrated;
      window.queueMicrotask(() => {
        if (!cancelled) setConnections(migrated);
      });
      writeWorkspaceConnections(ownerId, workspaceId, migrated);
      pendingOperationsByScopeRef.current.set(
        scopeKey,
        readPendingConnectionOperations(ownerId, workspaceId),
      );
      return undefined;
    }

    const stored = readWorkspaceConnections(ownerId, workspaceId);
    pendingOperationsByScopeRef.current.set(
      scopeKey,
      readPendingConnectionOperations(ownerId, workspaceId),
    );

    const hydrateCloud = async () => {
      try {
        const cloudConnections = await loadCloudConnections(userId, workspaceId);
        if (cancelled) return;

        const migrationCompleted = hasCompletedConnectionMigration(ownerId, workspaceId);
        if (cloudConnections.length === 0 && !migrationCompleted && stored.length > 0) {
          for (const connection of stored) {
            await executeConnectionOperation(userId, { type: 'upsert', connection });
          }
          markConnectionMigrationComplete(ownerId, workspaceId);
        } else if (cloudConnections.length === 0 && !migrationCompleted && stored.length === 0) {
          markConnectionMigrationComplete(ownerId, workspaceId);
        }

        const finalConnections = await loadCloudConnections(userId, workspaceId);
        if (cancelled) return;

        connectionsRef.current = finalConnections;
        setConnections(finalConnections);
        writeWorkspaceConnections(ownerId, workspaceId, finalConnections);
      } catch {
        if (!cancelled && !syncErrorShownRef.current) {
          syncErrorShownRef.current = true;
          onStatus?.('Connection cloud data is unavailable. Using local data.');
        }
      }
    };

    void hydrateCloud();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, flushPendingOperations, onStatus, ownerId, userId, workspaceId]);

  const replaceConnections = useCallback((updater) => {
    const previous = connectionsRef.current;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    const operations = createConnectionOperationsForReplacement(previous, next, workspaceId);
    connectionsRef.current = next;
    setConnections(next);
    writeWorkspaceConnections(ownerId, workspaceId, next);
    enqueueOperations(operations);
    return next;
  }, [enqueueOperations, ownerId, workspaceId]);

  useEffect(() => {
    if (!cloudEnabled || !userId) return undefined;
    const retryAndRefresh = async () => {
      const result = await flushPendingOperations();
      if (result.error || result.remaining.length > 0) return;
      try {
        const cloudConnections = await loadCloudConnections(userId, workspaceId);
        connectionsRef.current = cloudConnections;
        setConnections(cloudConnections);
        writeWorkspaceConnections(ownerId, workspaceId, cloudConnections);
      } catch {
        // Keep the local snapshot; the next focus/online event will retry.
      }
    };
    const handleOnline = () => void retryAndRefresh();
    const handleFocus = () => void retryAndRefresh();
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cloudEnabled, flushPendingOperations, ownerId, userId, workspaceId]);

  const removeConnection = useCallback((connectionId) => {
    replaceConnections((current) => current.filter((connection) => connection.id !== connectionId));
  }, [replaceConnections]);

  const rewirePackConnections = useCallback((sourceGroupId, targetGroupId) => {
    replaceConnections((current) => rewireConnectionsForPackMerge(current, {
      workspaceId,
      sourceGroupId,
      targetGroupId,
    }));
  }, [replaceConnections, workspaceId]);

  const removeGroupConnections = useCallback((groupIds) => {
    replaceConnections((current) => removeConnectionsForGroupIds(current, workspaceId, groupIds));
  }, [replaceConnections, workspaceId]);

  const isValidConnection = useCallback((connection) => {
    const sourceGroupId = getPackGroupIdFromReactFlowNodeId(connection?.source);
    const targetGroupId = getPackGroupIdFromReactFlowNodeId(connection?.target);
    const sourceSide = connection?.sourceHandle;
    const targetSide = connection?.targetHandle;
    if (
      !sourceGroupId
      || !targetGroupId
      || sourceGroupId === targetGroupId
      || (sourceSide !== 'left' && sourceSide !== 'right')
      || (targetSide !== 'left' && targetSide !== 'right')
    ) return false;

    const visiblePackIds = new Set(
      entriesRef.current
        .filter((entry) => entry?.type === 'group')
        .map((entry) => String(entry.id)),
    );
    if (!visiblePackIds.has(sourceGroupId) || !visiblePackIds.has(targetGroupId)) return false;

    const candidate = createDesktopConnection({
      workspaceId,
      sourceGroupId,
      sourceSide,
      targetGroupId,
      targetSide,
    });
    return Boolean(candidate) && !connectionsRef.current.some(
      (existingConnection) => existingConnection.id === candidate.id,
    );
  }, [workspaceId]);

  const createConnectionFromFlow = useCallback((flowConnection) => {
    if (!isValidConnection(flowConnection)) return;

    const connection = createDesktopConnection({
      workspaceId,
      sourceGroupId: getPackGroupIdFromReactFlowNodeId(flowConnection.source),
      sourceSide: flowConnection.sourceHandle,
      targetGroupId: getPackGroupIdFromReactFlowNodeId(flowConnection.target),
      targetSide: flowConnection.targetHandle,
    });
    if (!connection) return;

    replaceConnections((current) => (
      current.some((item) => item.id === connection.id) ? current : [...current, connection]
    ));
  }, [isValidConnection, replaceConnections, workspaceId]);

  return {
    connections,
    isValidConnection,
    createConnectionFromFlow,
    removeConnection,
    removeGroupConnections,
    rewirePackConnections,
  };
};
